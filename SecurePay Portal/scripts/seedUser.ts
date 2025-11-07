import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';

dotenv.config();

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/securepay';

async function seed() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();

  const username = process.argv[2] || 'admin';
  const email = process.argv[3] || 'admin@example.com';
  const password = process.argv[4] || 'P@ssw0rd!';
  // Optional 5th argument 'true' will mark the seeded user as staff (is_staff = true)
  const isStaff = (process.argv[5] || 'true') === 'true';

    const saltRounds = 12;
    const password_hash = await bcrypt.hash(password, saltRounds);

    const result = await db.collection('users').insertOne({
      username,
      email,
      password_hash,
      full_name: 'Seeded User',
      phone_number: null,
      address: null,
      is_verified: true,
      is_active: true,
      is_staff: isStaff,
      created_at: new Date(),
      updated_at: new Date(),
    });

    console.log('Inserted user id:', result.insertedId);
  } catch (err) {
    console.error('Seeding error', err);
  } finally {
    await client.close();
  }
}

seed();
