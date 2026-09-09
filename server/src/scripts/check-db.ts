import 'dotenv/config';
import { Client } from 'pg';

async function checkDb(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('❌ DATABASE_URL not found in .env');
    process.exit(1);
  }

  const client = new Client({ connectionString });

  try {
    await client.connect();
    const result = await client.query('SELECT 1');
    console.log('✅ Database connection successful — SELECT 1 returned:', result.rows[0]);
  } catch (error) {
    console.error('❌ Database connection failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

checkDb();
