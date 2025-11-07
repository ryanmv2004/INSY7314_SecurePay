import express, { Request, Response, NextFunction } from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { LoginSchema, RegisterSchema, CreatePaymentSchema } from '../shared/types';
import cors from 'cors';
import * as dotenv from 'dotenv';
import path from 'path';
import helmet from 'helmet';
import crypto from 'crypto';


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


const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');

// MongoDB connection
let db: any;
const MONGODB_URI = process.env.MONGODB_URI || '';


function createInMemoryDb() {
  const collections: Record<string, any[]> = {
    users: [],
    user_sessions: [],
    payment_transactions: [],
  };

  function match(doc: any, query: any) {
    for (const key of Object.keys(query)) {
      const qv = query[key];
      const dv = doc[key];
      if (qv && typeof qv === 'object' && ('$gt' in qv || '$lt' in qv)) {
        if ('$gt' in qv && !(dv > qv['$gt'])) return false;
        if ('$lt' in qv && !(dv < qv['$lt'])) return false;
      } else if (qv instanceof RegExp) {
        if (!qv.test(dv)) return false;
      } else if (qv !== dv) {
        return false;
      }
    }
    return true;
  }

  function collection(name: string) {
    if (!collections[name]) collections[name] = [];

    return {
      __inMemory: true,
      async createIndex() { /* no-op for in-memory */ },
      async indexInformation() { return []; },
      async findOne(query: any) {
        return collections[name].find((d: any) => match(d, query)) || null;
      },
      async insertOne(doc: any) {
        const toInsert = { ...doc };
        if (!('_id' in toInsert)) {
          toInsert._id = crypto.randomUUID();
        }
        collections[name].push(toInsert);
        return { insertedId: toInsert._id };
      },
      async updateOne(filter: any, update: any) {
        const idx = collections[name].findIndex((d: any) => match(d, filter));
        if (idx === -1) return { matchedCount: 0, modifiedCount: 0 };
        const set = update.$set || {};
        collections[name][idx] = { ...collections[name][idx], ...set };
        return { matchedCount: 1, modifiedCount: 1 };
      },
      find(filter: any) {
        const results = collections[name].filter((d: any) => match(d, filter || {}));
        return {
          sort() { return this; },
          limit() { return this; },
          toArray: async () => results.slice(),
        };
      },
      async findOneAndUpdate(filter: any, update: any, opts?: any) {
        const idx = collections[name].findIndex((d: any) => match(d, filter));
        if (idx === -1) return { value: null };
        const set = update.$set || {};
        collections[name][idx] = { ...collections[name][idx], ...set };
        return { value: collections[name][idx] };
      }
    };
  }

  return { collection, __inMemory: true };
}

async function connectToDatabase() {
  if (!MONGODB_URI) {
    console.warn('No MongoDB connection string provided — falling back to in-memory DB.');
    db = createInMemoryDb();
    // Seed a demo staff user 
    try {
      const existing = await db.collection('users').findOne({ email: 'test12345@gmail.com' });
      if (!existing) {
        const passwordHash = await hashPassword('P@ssw0rd!');
        await db.collection('users').insertOne({
          email: 'test12345@gmail.com',
          password_hash: passwordHash,
          full_name: 'Demo Staff',
          is_verified: true,
          is_active: true,
          is_staff: true,
          created_at: new Date(),
          updated_at: new Date()
        });
        console.log('Seeded demo staff user: test12345@gmail.com / P@ssw0rd!');
      }
    } catch (e) {
      console.warn('Failed to seed demo staff user:', e);
    }
    return;
  }

  try {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    db = client.db();
    console.log('Connected to MongoDB');

    // Create indexes 
    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    // Ensure username index is unique 
    try {
      const indexes = await db.collection('users').indexInformation({ full: true });
      const usernameIndex = indexes.find((ix: any) => ix.name === 'username_1');
      if (usernameIndex) {
        if (!usernameIndex.sparse) {
          console.log('Dropping non-sparse username index and recreating as sparse to avoid null-duplicates');
          await db.collection('users').dropIndex('username_1');
          await db.collection('users').createIndex({ username: 1 }, { unique: true, sparse: true });
        }
      } else {
        await db.collection('users').createIndex({ username: 1 }, { unique: true, sparse: true });
      }
    } catch (err) {
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
    console.error('Failed to connect to MongoDB, falling back to in-memory DB:', error);
    db = createInMemoryDb();
    try {
      const existing = await db.collection('users').findOne({ email: 'test12345@gmail.com' });
      if (!existing) {
        const passwordHash = await hashPassword('P@ssw0rd!');
        await db.collection('users').insertOne({
          email: 'test12345@gmail.com',
          password_hash: passwordHash,
          full_name: 'Demo Staff',
          is_verified: true,
          is_active: true,
          is_staff: true,
          created_at: new Date(),
          updated_at: new Date()
        });
        console.log('Seeded demo staff user (fallback): test12345@gmail.com / P@ssw0rd!');
      }
    } catch (e) {
      console.warn('Failed to seed demo staff user in fallback DB:', e);
    }
  }
}

// Middleware
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
app.use(cors({
  origin: CORS_ORIGIN,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// Security headers

// Basic security headers.
app.use(helmet());
// Deny framing to mitigate clickjacking 
app.use(helmet.frameguard({ action: 'deny' }));

app.use(helmet.hsts({ maxAge: 31536000, includeSubDomains: true, preload: true }));

// Enforce HTTPS in production 
app.use((req: Request, res: Response, next: NextFunction) => {
  if (process.env.NODE_ENV === 'production') {
    if (req.headers['x-forwarded-proto'] && req.headers['x-forwarded-proto'] !== 'https') {
      const host = req.headers.host;
      return res.redirect(301, `https://${host}${req.url}`);
    }
  }
  next();
});

// Limit JSON payload size to mitigate some DoS
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '10kb' }));


function sanitizeValue(value: any, skipSanitization = false): any {
  if (skipSanitization) return value;
  
  if (typeof value === 'string') {
    // Drop script tags and their contents
    value = value.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
    // Escape angle brackets to prevent raw HTML being stored
    value = value.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return value;
  }
  if (Array.isArray(value)) return value.map(v => sanitizeValue(v, skipSanitization));
  if (value && typeof value === 'object') {
    const out: any = {};
    for (const k of Object.keys(value)) {
      // Don't sanitize password fields
      const shouldSkip = k === 'password' || k === 'password_hash';
      out[k] = sanitizeValue(value[k], shouldSkip);
    }
    return out;
  }
  return value;
}

function sanitizeInput(req: Request, _res: Response, next: NextFunction) {
  if (req.body) req.body = sanitizeValue(req.body);
  if (req.query && Object.keys(req.query).length > 0) {
    // req.query is read-only, so we need to sanitize in place
    const sanitized = sanitizeValue(req.query);
    Object.keys(req.query).forEach(key => delete (req.query as any)[key]);
    Object.assign(req.query, sanitized);
  }
  next();
}

app.use(sanitizeInput);
app.use(express.static(path.join(__dirname, '../../dist')));

// Rate limiting helper
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

 
function checkRateLimit(key: string, maxRequests = 5, windowMs = 60000): boolean {
  const now = Date.now();
  const userLimit = rateLimitMap.get(key);

  if (!userLimit || now > userLimit.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
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
  // Use Node's crypto to generate a secure random token
  return crypto.randomBytes(32).toString('hex');
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

// Sign a JWT for the given user id and claims.
function signJwt(userId: string, opts?: { expiresIn?: string }) {
  const payload = { sub: userId };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: opts?.expiresIn || '1h' });
}

// Helper to find a user by id 
async function findUserById(id: string) {
  const users = db.collection('users');
  if (users.__inMemory) {
    return await users.findOne({ _id: id });
  }
  try {
    if (ObjectId.isValid(id)) {
      return await users.findOne({ _id: new ObjectId(id) });
    }
  } catch (_) {
    
  }
  // Last resort: try string match
  return await users.findOne({ _id: id });
}

// Authentication middleware
async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authorization = req.headers.authorization;
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  const token = authorization.split(' ')[1];

  // Try session lookup
  const session = await db.collection('user_sessions').findOne({
    session_token: token,
    is_active: true,
    expires_at: { $gt: new Date() }
  });

  if (session) {
    // Get user details
    const user = await findUserById(String(session.user_id));
    if (!user) return res.status(401).json({ success: false, error: 'User not found' });

    const STRICT_BINDING = process.env.SESSION_STRICT_BINDING === 'true';
    if (STRICT_BINDING) {
      const incomingIP = req.ip || (req.connection && (req.connection as any).remoteAddress) || '';
      const incomingUA = req.headers['user-agent'] || '';
      if (session.ip_address && session.ip_address !== incomingIP) {
        return res.status(401).json({ success: false, error: 'Session IP mismatch' });
      }
      if (session.user_agent && String(session.user_agent) !== String(incomingUA)) {
        return res.status(401).json({ success: false, error: 'Session User-Agent mismatch' });
      }
    }

    const merged = { ...session, ...user };
    merged.is_staff = !!user.is_staff;
    req.user = merged;
    return next();
  }

  // If no session found, attempt JWT verification
  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);
    const userId = decoded?.sub;
    if (!userId) return res.status(401).json({ success: false, error: 'Invalid token payload' });

    const user = await findUserById(String(userId));
    if (!user) return res.status(401).json({ success: false, error: 'User not found' });

    // Build a minimal req.user from the user record
    const minimal = { ...user };
    minimal.is_staff = !!user.is_staff;
    req.user = minimal;
    return next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Invalid or expired session' });
  }
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
  
  // Use an action-prefixed key so registration attempts are limited separately from login
  if (!checkRateLimit(`register:${clientIP}`, 3, 300000)) { // 3 attempts per 5 minutes
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
      is_staff: false,
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
  
  if (!checkRateLimit(`login:${clientIP}`, 5, 900000)) { // 5 attempts per 15 minutes
    return res.status(429).json({ success: false, error: "Too many login attempts. Please try again later." });
  }

  const { account_number, email, password } = req.body as any;

  try {
    // Get user by account_number or email
    const query: any = { is_active: true };
    if (account_number) query.account_number = account_number;
    if (email) query.email = email;

    console.log('Login attempt with query:', { ...query, password: '***' });
    
    const user = await db.collection('users').findOne(query);
    
    console.log('User found:', user ? 'yes' : 'no');
    if (user) {
      console.log('User details:', { 
        email: user.email, 
        is_active: user.is_active,
        has_password_hash: !!user.password_hash 
      });
    }

    if (!user || !(await verifyPassword(password, user.password_hash))) {
      console.log('Login failed - user not found or password mismatch');
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
    // Also issue a JWT so clients can choose stateless auth if desired
    const jwtToken = signJwt(user._id?.toString ? user._id.toString() : String(user._id), { expiresIn: '1h' });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token: sessionToken,
        jwt: jwtToken,
        user: {
          id: user._id?.toString ? user._id.toString() : String(user._id),
          email: user.email || null,
          account_number: user.account_number || null,
          username: user.username || null,
          full_name: user.full_name || null,
          is_verified: !!user.is_verified,
          is_staff: !!user.is_staff
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
  
  if (!checkRateLimit(`payments:${clientIP}`, 10, 3600000)) { // 10 payments per hour
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
      swift_code: paymentData.swift_code || null,
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
    const paymentCollection = db.collection('payment_transactions');

    let transaction: any = null;
    // If using in-memory DB, 
    if (paymentCollection.__inMemory) {
      transaction = await paymentCollection.findOne({
        _id: transactionId,
        user_id: user._id
      });
    } else {
      if (!ObjectId.isValid(transactionId)) {
        return res.status(400).json({ success: false, error: "Invalid transaction ID" });
      }
      transaction = await paymentCollection.findOne({
        _id: new ObjectId(transactionId),
        user_id: user._id
      });
    }

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

// Admin endpoints - staff use 
app.get('/api/admin/transactions', authMiddleware, async (req: Request, res: Response) => {
  const user = req.user;
  if (!user.is_staff) return res.status(403).json({ success: false, error: 'Forbidden' });

  const { status } = req.query;
  const filter: any = {};
  if (status) filter.status = status;

  try {
    const paymentCollection = db.collection('payment_transactions');

    if (paymentCollection.__inMemory) {
    
      const txs: any[] = await paymentCollection.find(filter).sort({ created_at: -1 }).limit(200).toArray();
      const adapted: any[] = [];
      for (const t of txs) {
        let submitter: any = null;
        try {
          submitter = await db.collection('users').findOne({ _id: t.user_id });
        } catch (e) {
          submitter = null;
        }
        adapted.push({
          ...t,
          user_email: submitter?.email || t.user_email || '',
          user_name: submitter?.full_name || t.user_name || ''
        });
      }
      return res.json({ success: true, data: adapted });
    }

    
    const pipeline: any[] = [
      { $match: filter },
      { $sort: { created_at: -1 } },
      { $limit: 200 },
      {
        $lookup: {
          from: 'users',
          localField: 'user_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          user_email: { $ifNull: ['$user.email', ''] },
          user_name: { $ifNull: ['$user.full_name', ''] }
        }
      },
      {
        $project: {
          user: 0 
        }
      }
    ];

    const transactions = await db.collection('payment_transactions').aggregate(pipeline).toArray();
    res.json({ success: true, data: transactions });
  } catch (error) {
    console.error('Admin transactions error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch transactions' });
  }
});

// Verify a transaction 
app.post('/api/admin/transactions/:id/verify', authMiddleware, async (req: Request, res: Response) => {
  const user = req.user;
  if (!user.is_staff) return res.status(403).json({ success: false, error: 'Forbidden' });

  const id = req.params.id;
  try {
    const paymentCollection = db.collection('payment_transactions');
    let result: any;
    if (paymentCollection.__inMemory) {
      result = await paymentCollection.findOneAndUpdate(
        { _id: id },
        { $set: { is_processed: true, status: 'completed', processed_at: new Date(), updated_at: new Date() } },
        { returnDocument: 'after' }
      );
    } else {
      result = await paymentCollection.findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: { is_processed: true, status: 'completed', processed_at: new Date(), updated_at: new Date() } },
        { returnDocument: 'after' }
      );
    }

    if (!result.value) return res.status(404).json({ success: false, error: 'Transaction not found' });

    res.json({ success: true, data: result.value });
  } catch (error) {
    console.error('Verify transaction error:', error);
    res.status(500).json({ success: false, error: 'Failed to verify transaction' });
  }
});

// Serve React app for all other routes
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
