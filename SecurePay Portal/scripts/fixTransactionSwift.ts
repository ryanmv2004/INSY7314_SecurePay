import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';

dotenv.config();
const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/securepay';

async function run() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();
    const res = await db.collection('payment_transactions').updateMany(
      { $or: [{ swift_code: { $exists: false } }, { swift_code: null }] },
      { $set: { swift_code: 'NWBKGB2L', updated_at: new Date() } }
    );
    console.log('Updated transactions:', res.modifiedCount);
  } catch (e) {
    console.error('Error updating transactions', e);
  } finally {
    await client.close();
  }
}

run();
