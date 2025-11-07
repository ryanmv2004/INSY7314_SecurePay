import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';

dotenv.config();

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/securepay';

async function run() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();
    const email = 'test12345@gmail.com';
    const users = await db.collection('users').find({ email }).toArray();
    console.log('Found users for', email, ':');
    users.forEach(u => {
      console.log(JSON.stringify(u, null, 2));
    });
  } catch (e) {
    console.error('Error', e);
  } finally {
    await client.close();
  }
}

run();
