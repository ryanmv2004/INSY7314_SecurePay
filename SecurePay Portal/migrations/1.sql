
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone_number TEXT,
  address TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE payment_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  recipient_name TEXT NOT NULL,
  recipient_account TEXT NOT NULL,
  recipient_bank TEXT NOT NULL,
  recipient_country TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT NOT NULL,
  exchange_rate REAL,
  converted_amount REAL,
  purpose TEXT,
  reference_number TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  transaction_fee REAL DEFAULT 0,
  is_processed BOOLEAN DEFAULT FALSE,
  processed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  session_token TEXT NOT NULL,
  expires_at DATETIME NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_transactions_user_id ON payment_transactions(user_id);
CREATE INDEX idx_transactions_status ON payment_transactions(status);
CREATE INDEX idx_sessions_token ON user_sessions(session_token);
CREATE INDEX idx_sessions_user_id ON user_sessions(user_id);
