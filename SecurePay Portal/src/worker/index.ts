import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { LoginSchema, RegisterSchema, CreatePaymentSchema } from "@/shared/types";
import bcrypt from "bcryptjs";

type Variables = {
  user: any;
};

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Security middleware
app.use("*", secureHeaders());
app.use("*", cors({
  origin: "*",
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
}));

// Rate limiting helper
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(ip: string, maxRequests = 5, windowMs = 60000): boolean {
  const now = Date.now();
  const userLimit = rateLimitMap.get(ip);
  
  if (!userLimit || now > userLimit.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
    return true;
  }
  
  if (userLimit.count >= maxRequests) {
    return false;
  }
  
  userLimit.count++;
  return true;
}

// Generate secure session token
function generateSessionToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Generate reference number
function generateReferenceNumber(): string {
  const timestamp = Date.now().toString();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `INT${timestamp.slice(-6)}${random}`;
}

// Hash password with salt
async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
}

// Verify password
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

// Authentication middleware
async function authMiddleware(c: any, next: any) {
  const authorization = c.req.header("Authorization");
  if (!authorization || !authorization.startsWith("Bearer ")) {
    return c.json({ success: false, error: "Unauthorized" }, 401);
  }

  const token = authorization.split(" ")[1];
  const session = await c.env.DB.prepare(
    "SELECT us.*, u.id as user_id, u.email, u.full_name FROM user_sessions us JOIN users u ON us.user_id = u.id WHERE us.session_token = ? AND us.is_active = 1 AND us.expires_at > datetime('now')"
  ).bind(token).first();

  if (!session) {
    return c.json({ success: false, error: "Invalid or expired session" }, 401);
  }

  c.set("user", session);
  await next();
}

// Register endpoint
app.post("/api/auth/register", zValidator("json", RegisterSchema), async (c) => {
  const clientIP = c.req.header("CF-Connecting-IP") || c.req.header("X-Forwarded-For") || "unknown";
  
  if (!checkRateLimit(clientIP, 3, 300000)) { // 3 attempts per 5 minutes
    return c.json({ success: false, error: "Too many registration attempts. Please try again later." }, 429);
  }

  const { email, password, full_name, phone_number, address } = c.req.valid("json");

  try {
    // Check if user already exists
    const existingUser = await c.env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
    if (existingUser) {
      return c.json({ success: false, error: "Email already registered" }, 400);
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Insert user
    const result = await c.env.DB.prepare(
      "INSERT INTO users (email, password_hash, full_name, phone_number, address) VALUES (?, ?, ?, ?, ?)"
    ).bind(email, passwordHash, full_name, phone_number || null, address || null).run();

    return c.json({
      success: true,
      message: "Registration successful",
      data: { userId: result.meta.last_row_id }
    });
  } catch (error) {
    console.error("Registration error:", error);
    return c.json({ success: false, error: "Registration failed" }, 500);
  }
});

// Login endpoint
app.post("/api/auth/login", zValidator("json", LoginSchema), async (c) => {
  const clientIP = c.req.header("CF-Connecting-IP") || c.req.header("X-Forwarded-For") || "unknown";
  const userAgent = c.req.header("User-Agent") || "";
  
  if (!checkRateLimit(clientIP, 5, 900000)) { // 5 attempts per 15 minutes
    return c.json({ success: false, error: "Too many login attempts. Please try again later." }, 429);
  }

  const { email, password } = c.req.valid("json");

  try {
    // Get user
    const user = await c.env.DB.prepare(
      "SELECT * FROM users WHERE email = ? AND is_active = 1"
    ).bind(email).first();

    if (!user || !(await verifyPassword(password, user.password_hash as string))) {
      return c.json({ success: false, error: "Invalid email or password" }, 401);
    }

    // Generate session
    const sessionToken = generateSessionToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

    await c.env.DB.prepare(
      "INSERT INTO user_sessions (user_id, session_token, expires_at, ip_address, user_agent) VALUES (?, ?, ?, ?, ?)"
    ).bind(user.id, sessionToken, expiresAt, clientIP, userAgent).run();

    return c.json({
      success: true,
      message: "Login successful",
      data: {
        token: sessionToken,
        user: {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          is_verified: user.is_verified
        }
      }
    });
  } catch (error) {
    console.error("Login error:", error);
    return c.json({ success: false, error: "Login failed" }, 500);
  }
});

// Logout endpoint
app.post("/api/auth/logout", authMiddleware, async (c) => {
  const user = c.get("user");
  
  try {
    await c.env.DB.prepare(
      "UPDATE user_sessions SET is_active = 0 WHERE session_token = ?"
    ).bind(user.session_token).run();

    return c.json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    return c.json({ success: false, error: "Logout failed" }, 500);
  }
});

// Get user profile
app.get("/api/user/profile", authMiddleware, async (c) => {
  const user = c.get("user");
  
  return c.json({
    success: true,
    data: {
      id: user.user_id,
      email: user.email,
      full_name: user.full_name,
      is_verified: user.is_verified
    }
  });
});

// Create payment transaction
app.post("/api/payments/create", authMiddleware, zValidator("json", CreatePaymentSchema), async (c) => {
  const user = c.get("user");
  const clientIP = c.req.header("CF-Connecting-IP") || c.req.header("X-Forwarded-For") || "unknown";
  
  if (!checkRateLimit(clientIP, 10, 3600000)) { // 10 payments per hour
    return c.json({ success: false, error: "Payment limit exceeded. Please try again later." }, 429);
  }

  const paymentData = c.req.valid("json");

  try {
    const referenceNumber = generateReferenceNumber();
    
    // Calculate transaction fee (2% of amount)
    const transactionFee = paymentData.amount * 0.02;
    
    // Insert payment transaction
    const result = await c.env.DB.prepare(`
      INSERT INTO payment_transactions 
      (user_id, recipient_name, recipient_account, recipient_bank, recipient_country, 
       amount, currency, purpose, reference_number, transaction_fee)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      user.user_id,
      paymentData.recipient_name,
      paymentData.recipient_account,
      paymentData.recipient_bank,
      paymentData.recipient_country,
      paymentData.amount,
      paymentData.currency,
      paymentData.purpose || null,
      referenceNumber,
      transactionFee
    ).run();

    return c.json({
      success: true,
      message: "Payment initiated successfully",
      data: {
        transactionId: result.meta.last_row_id,
        referenceNumber,
        transactionFee,
        status: "pending"
      }
    });
  } catch (error) {
    console.error("Payment creation error:", error);
    return c.json({ success: false, error: "Payment initiation failed" }, 500);
  }
});

// Get user transactions
app.get("/api/payments/history", authMiddleware, async (c) => {
  const user = c.get("user");
  
  try {
    const transactions = await c.env.DB.prepare(
      "SELECT * FROM payment_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50"
    ).bind(user.user_id).all();

    return c.json({
      success: true,
      data: transactions.results
    });
  } catch (error) {
    console.error("Transaction history error:", error);
    return c.json({ success: false, error: "Failed to fetch transaction history" }, 500);
  }
});

// Get transaction details
app.get("/api/payments/:id", authMiddleware, async (c) => {
  const user = c.get("user");
  const transactionId = c.req.param("id");
  
  try {
    const transaction = await c.env.DB.prepare(
      "SELECT * FROM payment_transactions WHERE id = ? AND user_id = ?"
    ).bind(transactionId, user.user_id).first();

    if (!transaction) {
      return c.json({ success: false, error: "Transaction not found" }, 404);
    }

    return c.json({
      success: true,
      data: transaction
    });
  } catch (error) {
    console.error("Transaction details error:", error);
    return c.json({ success: false, error: "Failed to fetch transaction details" }, 500);
  }
});

// Health check
app.get("/api/health", (c) => {
  return c.json({ success: true, message: "SecurePay Portal API is running" });
});

export default app;
