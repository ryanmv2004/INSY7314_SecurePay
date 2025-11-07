import { MongoClient, ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';

dotenv.config();

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/securepay';

function generateReferenceNumber() {
  const timestamp = Date.now().toString();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `INT${timestamp.slice(-6)}${random}`;
}

async function seed() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();

    console.log('Connected to DB. Ensuring indexes...');

    // Users
    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    try {
      await db.collection('users').createIndex({ username: 1 }, { unique: true, sparse: true });
    } catch (e) {
      console.warn('Could not create username sparse index (may already exist):', String(e));
    }

    // Sessions
    try {
      await db.collection('user_sessions').createIndex({ session_token: 1 }, { unique: true });
      // TTL index (expireAfterSeconds requires a Date field) - keep as example, value set server-side
      await db.collection('user_sessions').createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 });
    } catch (e) {
      console.warn('user_sessions index warning:', String(e));
    }

    // Payment transactions
    await db.collection('payment_transactions').createIndex({ user_id: 1 });
    try {
      await db.collection('payment_transactions').createIndex({ reference_number: 1 }, { unique: true });
    } catch (e) {
      console.warn('payment_transactions reference_number index warning:', String(e));
    }

    // Seed staff user
    const staffEmail = 'test12345@gmail.com';
    const staffPassword = 'P@ssw0rd!';
    const existingStaff = await db.collection('users').findOne({ email: staffEmail });
    let staffId: any = null;
    if (!existingStaff) {
      const password_hash = await bcrypt.hash(staffPassword, 12);
      const staffInsert = await db.collection('users').insertOne({
        email: staffEmail,
        password_hash,
        full_name: 'Seeded Staff',
        phone_number: null,
        address: null,
        is_verified: true,
        is_active: true,
        is_staff: true,
        created_at: new Date(),
        updated_at: new Date(),
      });
      staffId = staffInsert.insertedId;
      console.log('Inserted staff user id:', staffId.toString());
    } else {
      staffId = existingStaff._id;
      // Ensure seeded staff password matches the known seeded password (reset if different)
      try {
        const newHash = await bcrypt.hash(staffPassword, 12);
        // Ensure the existing user is marked as staff and verified for seeded credentials
        await db.collection('users').updateOne(
          { _id: staffId },
          { $set: { password_hash: newHash, is_staff: true, is_verified: true, full_name: 'Seeded Staff', updated_at: new Date() } }
        );
        console.log('Existing staff user found; password reset and staff flag set for id:', staffId.toString());
      } catch (e) {
        console.warn('Failed to reset staff password for existing user:', String(e));
        console.log('Staff user already exists with id:', staffId.toString());
      }
    }

    // Seed a customer user
    const customerEmail = 'customer1@example.com';
    const customerPassword = 'CustP@ss1!';
    let customerId: any = null;
    const existingCustomer = await db.collection('users').findOne({ email: customerEmail });
    if (!existingCustomer) {
      const password_hash = await bcrypt.hash(customerPassword, 12);
      const custInsert = await db.collection('users').insertOne({
        email: customerEmail,
        password_hash,
        full_name: 'Customer One',
        account_number: 'ACC123456',
        id_number: '8001015009087',
        phone_number: null,
        address: null,
        is_verified: false,
        is_active: true,
        is_staff: false,
        created_at: new Date(),
        updated_at: new Date(),
      });
      customerId = custInsert.insertedId;
      console.log('Inserted customer user id:', customerId.toString());
    } else {
      customerId = existingCustomer._id;
      console.log('Customer already exists with id:', customerId.toString());
    }

    // Seed a sample pending payment linked to the customer
    const referenceNumber = generateReferenceNumber();
    const amount = 1500.0;
    const transactionFee = amount * 0.02;

    const paymentDoc = {
      user_id: customerId,
      user_account: 'ACC123456',
      swift_code: 'NWBKGB2L',
      recipient_name: 'JOHN SMITH',
      recipient_account: 'GB82WEST12345698765432',
      recipient_bank: 'HSBC Bank',
      recipient_country: 'United Kingdom',
      amount,
      currency: 'USD',
      exchange_rate: null,
      converted_amount: null,
      purpose: 'Test payment',
      reference_number: referenceNumber,
      status: 'pending',
      transaction_fee: transactionFee,
      is_processed: false,
      processed_at: null,
      created_at: new Date(),
      updated_at: new Date(),
    };

    const existingTxn = await db.collection('payment_transactions').findOne({ reference_number: referenceNumber });
    if (!existingTxn) {
      const txnRes = await db.collection('payment_transactions').insertOne(paymentDoc);
      console.log('Inserted sample transaction id:', txnRes.insertedId.toString());
    } else {
      console.log('Sample transaction already exists with reference:', referenceNumber);
    }

    console.log('Seeding complete. Staff credentials:', staffEmail, '/', staffPassword);
    console.log('Customer credentials:', customerEmail, '/', customerPassword);

  } catch (err) {
    console.error('Seeding error', err);
  } finally {
    await client.close();
    console.log('DB connection closed');
  }
}

seed();
