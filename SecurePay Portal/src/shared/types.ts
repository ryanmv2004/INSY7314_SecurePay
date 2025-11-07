import z from "zod";

// User schemas
export const UserSchema = z.object({
  id: z.string(), // MongoDB uses string IDs
  email: z.string().email().optional(),
  username: z.string().optional(),
  id_number: z.string().optional(),
  account_number: z.string().optional(),
  password_hash: z.string(),
  full_name: z.string(),
  phone_number: z.string().nullable(),
  address: z.string().nullable(),
  is_verified: z.boolean(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const LoginSchema = z.object({
  email: z.string().email("Invalid email format").max(254, "Email too long").optional(),
  account_number: z.string()
    .min(6, "Account number must be at least 6 characters")
    .max(64, "Account number too long")
    .regex(/^[A-Z0-9\-]+$/i, "Invalid account number format")
    .optional(),
  password: z.string().min(8, "Password must be at least 8 characters"),
}).refine((data) => !!(data.email || data.account_number), {
  message: 'Either email or account_number is required',
  path: ['email'],
});

export const RegisterSchema = z.object({
  // For now registration only requires email and password
  email: z.string().email("Invalid email format").max(254, "Email too long"),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    // Anchor and require at least one of each class; allow only the selected characters
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/,
      "Password must contain at least one uppercase letter, one lowercase letter, one number and one special character"),
});

// Payment transaction schemas
export const PaymentTransactionSchema = z.object({
  id: z.string(), // MongoDB uses string IDs
  user_id: z.string(), // MongoDB uses string IDs
  recipient_name: z.string(),
  recipient_account: z.string(),
  recipient_bank: z.string(),
  recipient_country: z.string(),
  swift_code: z.string(),
  amount: z.number(),
  currency: z.string(),
  exchange_rate: z.number().nullable(),
  converted_amount: z.number().nullable(),
  purpose: z.string().nullable(),
  reference_number: z.string(),
  status: z.string(),
  transaction_fee: z.number(),
  is_processed: z.boolean(),
  processed_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const CreatePaymentSchema = z.object({
  recipient_name: z.string()
    .min(2, "Recipient name must be at least 2 characters")
    .max(100, "Recipient name too long")
    .regex(/^[a-zA-Z\s\-\.]+$/, "Recipient name can only contain letters, spaces, hyphens and dots"),
  recipient_account: z.string()
    .min(8, "Account number must be at least 8 characters")
    .max(64, "Account number too long")
    .regex(/^[A-Z0-9\-]+$/, "Invalid account number format"),
  recipient_bank: z.string()
    .min(2, "Bank name is required")
    .max(100, "Bank name too long")
    .regex(/^[a-zA-Z\s\-\.]+$/, "Bank name can only contain letters, spaces, hyphens and dots"),
  recipient_country: z.string()
    .min(2, "Country is required")
    .max(56, "Country name too long")
    .regex(/^[a-zA-Z\s]+$/, "Country can only contain letters and spaces"),
  swift_code: z.string()
    .min(8, "SWIFT code must be 8 or 11 characters")
    .max(11, "SWIFT code must be 8 or 11 characters")
    .regex(/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/, "Invalid SWIFT code format"),
  amount: z.number()
    .min(1, "Amount must be at least 1")
    .max(50000, "Amount cannot exceed 50,000"),
  currency: z.string()
    .length(3, "Currency must be a 3-letter code")
    .regex(/^[A-Z]{3}$/, "Currency must be uppercase letters"),
  purpose: z.string()
    .max(200, "Purpose cannot exceed 200 characters")
    .regex(/^[a-zA-Z0-9\s\-\.\,]+$/, "Purpose contains invalid characters")
    .optional(),
});

// Session schema
export const UserSessionSchema = z.object({
  id: z.string(), // MongoDB uses string IDs
  user_id: z.string(), // MongoDB uses string IDs
  session_token: z.string(),
  expires_at: z.string(),
  ip_address: z.string().nullable(),
  user_agent: z.string().nullable(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

// API Response schemas
export const ApiResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  data: z.any().optional(),
  error: z.string().optional(),
});

// Type exports
export type User = z.infer<typeof UserSchema>;
export type LoginRequest = z.infer<typeof LoginSchema>;
export type RegisterRequest = z.infer<typeof RegisterSchema>;
export type PaymentTransaction = z.infer<typeof PaymentTransactionSchema>;
export type CreatePaymentRequest = z.infer<typeof CreatePaymentSchema>;
export type UserSession = z.infer<typeof UserSessionSchema>;
export type ApiResponse = z.infer<typeof ApiResponseSchema>;
