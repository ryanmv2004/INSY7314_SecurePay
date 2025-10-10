import express, { Request, Response, NextFunction } from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import { LoginSchema, RegisterSchema, CreatePaymentSchema } from '../shared/types';
import cors from 'cors';
import * as dotenv from 'dotenv';
import path from 'path';
import helmet from 'helmet';

// Determine project root directory in a way that works for CommonJS and ts-node
// Avoid using import.meta so compilation does not require ES module settings.
const PROJECT_ROOT = process.cwd();
const __dirname = PROJECT_ROOT;

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// MongoDB connection
let db: any;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/securepay';

async function connectToDatabase() {
  try {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    db = client.db();
    console.log('Connected to MongoDB');
    
    // Create indexes for better performance
    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    // Ensure username index is unique but sparse (so multiple null/missing usernames are allowed)
    try {
      const indexes = await db.collection('users').indexInformation({ full: true });
      const usernameIndex = indexes.find((ix: any) => ix.name === 'username_1');
      if (usernameIndex) {
        // If the existing index is not sparse, drop it and recreate as sparse
        if (!usernameIndex.sparse) {
          console.log('Dropping non-sparse username index and recreating as sparse to avoid null-duplicates');
          await db.collection('users').dropIndex('username_1');
          await db.collection('users').createIndex({ username: 1 }, { unique: true, sparse: true });
        }
      } else {
        await db.collection('users').createIndex({ username: 1 }, { unique: true, sparse: true });
      }
    } catch (err) {
      // indexInformation may throw on some drivers/permissions — fall back to safe createIndex
      try {
        await db.collection('users').createIndex({ username: 1 }, { unique: true, sparse: true });
      } catch (e) {
        console.warn('Could not ensure sparse username index:', e);
      }
    }
    await db.collection('user_sessions').createIndex({ session_token: 1 }, { unique: true });
    await db.collection('user_sessions').createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 });
    await db.collection('payment_transactions').createIndex({ user_id: 1 });
    await db.collection('payment_transactions').createIndex({ reference_number: 1 }, { unique: true });
    
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    process.exit(1);
  }
}

// Middleware
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// Security headers
app.use(helmet());

// Enforce HTTPS in production (behind proxy/load balancer)
app.use((req: Request, res: Response, next: NextFunction) => {
  if (process.env.NODE_ENV === 'production') {
    if (req.headers['x-forwarded-proto'] && req.headers['x-forwarded-proto'] !== 'https') {
      const host = req.headers.host;
      return res.redirect(301, `https://${host}${req.url}`);
    }
  }
  next();
});

app.use(express.json());
app.use(express.static(path.join(__dirname, '../../dist')));

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
async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authorization = req.headers.authorization;
  if (!authorization || !authorization.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  const token = authorization.split(" ")[1];
  const session = await db.collection('user_sessions').findOne({
    session_token: token,
    is_active: true,
    expires_at: { $gt: new Date() }
  });

  if (!session) {
    return res.status(401).json({ success: false, error: "Invalid or expired session" });
  }

  // Get user details
  const user = await db.collection('users').findOne({ _id: session.user_id });
  if (!user) {
    return res.status(401).json({ success: false, error: "User not found" });
  }

  req.user = { ...session, ...user };
  next();
}

// Validation middleware factory
function validateRequest(schema: any) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validatedData = schema.parse(req.body);
      req.body = validatedData;
      next();
    } catch (error: any) {
      return res.status(400).json({ 
        success: false, 
        error: error.errors?.[0]?.message || "Validation failed" 
      });
    }
  };
}

// Register endpoint
app.post("/api/auth/register", validateRequest(RegisterSchema), async (req: Request, res: Response) => {
  const clientIP = req.ip || req.connection.remoteAddress || "unknown";
  
  if (!checkRateLimit(clientIP, 3, 300000)) { // 3 attempts per 5 minutes
    return res.status(429).json({ success: false, error: "Too many registration attempts. Please try again later." });
  }

  const { email, password } = req.body;
  const username = null;
  const id_number = null;
  const account_number = null;

  try {
    // Check if user already exists by email
    const existingUser = await db.collection('users').findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, error: "Email already registered" });
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Build insert document without storing null username to avoid unique index collisions on null
    const newUser: any = {
      email,
      password_hash: passwordHash,
      is_verified: false,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    };

    // Only add optional fields if present (avoid null values for unique sparse indexes)
    if (username) newUser.username = username;
  if (id_number) newUser.id_number = id_number;
  if (account_number) newUser.account_number = account_number;

    const result = await db.collection('users').insertOne(newUser);

    res.json({
      success: true,
      message: "Registration successful",
      data: { userId: result.insertedId }
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ success: false, error: "Registration failed" });
  }
});

// Login endpoint
app.post("/api/auth/login", validateRequest(LoginSchema), async (req: Request, res: Response) => {
  const clientIP = req.ip || req.connection.remoteAddress || "unknown";
  const userAgent = req.headers['user-agent'] || "";
  
  if (!checkRateLimit(clientIP, 5, 900000)) { // 5 attempts per 15 minutes
    return res.status(429).json({ success: false, error: "Too many login attempts. Please try again later." });
  }

  const { account_number, email, password } = req.body as any;

  try {
    // Get user by account_number or email
    const query: any = { is_active: true };
    if (account_number) query.account_number = account_number;
    if (email) query.email = email;

    const user = await db.collection('users').findOne(query);

    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return res.status(401).json({ success: false, error: "Invalid email or password" });
    }

    // Generate session
    const sessionToken = generateSessionToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await db.collection('user_sessions').insertOne({
      user_id: user._id,
      session_token: sessionToken,
      expires_at: expiresAt,
      ip_address: clientIP,
      user_agent: userAgent,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date()
    });

    res.json({
      success: true,
      message: "Login successful",
      data: {
        token: sessionToken,
        user: {
          id: user._id?.toString ? user._id.toString() : String(user._id),
          email: user.email || null,
          account_number: user.account_number || null,
          username: user.username || null,
          full_name: user.full_name || null,
          is_verified: !!user.is_verified
        }
      }
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ success: false, error: "Login failed" });
  }
});

// Logout endpoint
app.post("/api/auth/logout", authMiddleware, async (req: Request, res: Response) => {
  const user = req.user;
  
  try {
    await db.collection('user_sessions').updateOne(
      { session_token: user.session_token },
      { $set: { is_active: false, updated_at: new Date() } }
    );

    res.json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ success: false, error: "Logout failed" });
  }
});

// Get user profile
app.get("/api/user/profile", authMiddleware, async (req: Request, res: Response) => {
  const user = req.user;
  
  res.json({
    success: true,
    data: {
      id: user._id?.toString ? user._id.toString() : String(user._id),
      email: user.email || null,
      username: user.username || null,
      full_name: user.full_name || null,
      is_verified: !!user.is_verified
    }
  });
});

// Create payment transaction
app.post("/api/payments/create", authMiddleware, validateRequest(CreatePaymentSchema), async (req: Request, res: Response) => {
  const user = req.user;
  const clientIP = req.ip || req.connection.remoteAddress || "unknown";
  
  if (!checkRateLimit(clientIP, 10, 3600000)) { // 10 payments per hour
    return res.status(429).json({ success: false, error: "Payment limit exceeded. Please try again later." });
  }

  const paymentData = req.body;

  try {
    // Whitelist checks for recipient data
    if (!/^[a-zA-Z\s\-\.]{2,}$/.test(paymentData.recipient_name)) {
      return res.status(400).json({ success: false, error: 'Invalid recipient name' });
    }
    if (!/^[A-Z0-9\-]{8,}$/i.test(paymentData.recipient_account)) {
      return res.status(400).json({ success: false, error: 'Invalid recipient account format' });
    }
    if (!/^[a-zA-Z\s\-\.]{2,}$/.test(paymentData.recipient_bank)) {
      return res.status(400).json({ success: false, error: 'Invalid recipient bank name' });
    }
    if (!/^[a-zA-Z\s]{2,}$/.test(paymentData.recipient_country)) {
      return res.status(400).json({ success: false, error: 'Invalid recipient country' });
    }
    const referenceNumber = generateReferenceNumber();
    
    // Calculate transaction fee (2% of amount)
    const transactionFee = paymentData.amount * 0.02;
    
    // Insert payment transaction
    const result = await db.collection('payment_transactions').insertOne({
      user_id: user._id,
      user_account: user.account_number || null,
      recipient_name: paymentData.recipient_name,
      recipient_account: paymentData.recipient_account,
      recipient_bank: paymentData.recipient_bank,
      recipient_country: paymentData.recipient_country,
      amount: paymentData.amount,
      currency: paymentData.currency,
      exchange_rate: null,
      converted_amount: null,
      purpose: paymentData.purpose || null,
      reference_number: referenceNumber,
      status: 'pending',
      transaction_fee: transactionFee,
      is_processed: false,
      processed_at: null,
      created_at: new Date(),
      updated_at: new Date()
    });

    res.json({
      success: true,
      message: "Payment initiated successfully",
      data: {
        transactionId: result.insertedId,
        referenceNumber,
        transactionFee,
        status: "pending"
      }
    });
  } catch (error) {
    console.error("Payment creation error:", error);
    res.status(500).json({ success: false, error: "Payment initiation failed" });
  }
});

// Get user transactions
app.get("/api/payments/history", authMiddleware, async (req: Request, res: Response) => {
  const user = req.user;
  
  try {
    const transactions = await db.collection('payment_transactions')
      .find({ user_id: user._id })
      .sort({ created_at: -1 })
      .limit(50)
      .toArray();

    res.json({
      success: true,
      data: transactions
    });
  } catch (error) {
    console.error("Transaction history error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch transaction history" });
  }
});

// Get transaction details
app.get("/api/payments/:id", authMiddleware, async (req: Request, res: Response) => {
  const user = req.user;
  const transactionId = req.params.id;
  
  try {
    if (!ObjectId.isValid(transactionId)) {
      return res.status(400).json({ success: false, error: "Invalid transaction ID" });
    }

    const transaction = await db.collection('payment_transactions').findOne({
      _id: new ObjectId(transactionId),
      user_id: user._id
    });

    if (!transaction) {
      return res.status(404).json({ success: false, error: "Transaction not found" });
    }

    res.json({
      success: true,
      data: transaction
    });
  } catch (error) {
    console.error("Transaction details error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch transaction details" });
  }
});

// Health check
app.get("/api/health", (req: Request, res: Response) => {
  res.json({ success: true, message: "SecurePay Portal API is running with MongoDB" });
});

// Admin endpoints - staff use (assumes staff sessions are stored in users with is_staff flag)
app.get('/api/admin/transactions', authMiddleware, async (req: Request, res: Response) => {
  const user = req.user;
  if (!user.is_staff) return res.status(403).json({ success: false, error: 'Forbidden' });

  const { status } = req.query;
  const filter: any = {};
  if (status) filter.status = status;

  try {
    const transactions = await db.collection('payment_transactions').find(filter).sort({ created_at: -1 }).limit(200).toArray();
    res.json({ success: true, data: transactions });
  } catch (error) {
    console.error('Admin transactions error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch transactions' });
  }
});

// Verify a transaction (mark processed and status=completed)
app.post('/api/admin/transactions/:id/verify', authMiddleware, async (req: Request, res: Response) => {
  const user = req.user;
  if (!user.is_staff) return res.status(403).json({ success: false, error: 'Forbidden' });

  const id = req.params.id;
  try {
    const result = await db.collection('payment_transactions').findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { is_processed: true, status: 'completed', processed_at: new Date(), updated_at: new Date() } },
      { returnDocument: 'after' }
    );

    if (!result.value) return res.status(404).json({ success: false, error: 'Transaction not found' });

    res.json({ success: true, data: result.value });
  } catch (error) {
    console.error('Verify transaction error:', error);
    res.status(500).json({ success: false, error: 'Failed to verify transaction' });
  }
});

// Serve React app for all other routes (catch-all fallback)
app.use((req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../../dist/index.html'));
});

// Start server
async function startServer() {
  await connectToDatabase();
  app.listen(PORT, () => {
    console.log(`SecurePay Portal server running on port ${PORT}`);
    console.log(`Frontend available at: http://localhost:${PORT}`);
    console.log(`API available at: http://localhost:${PORT}/api`);
  });
}

startServer().catch(console.error);
