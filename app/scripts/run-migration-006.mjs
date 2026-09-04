import 'dotenv/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import pg from 'pg';

const { Client } = pg;

const projectRef = 'dfciopeufpcqljgpgcwh';
const poolerHost = 'aws-0-ap-northeast-2.pooler.supabase.com';
const dbPassword = process.env.SUPABASE_DB_PASSWORD || process.env.DB_PASSWORD || process.env.SUPABASE_PASSWORD;

if (!dbPassword) {
  console.error('ERROR: No database password found.');
  console.error('Set SUPABASE_DB_PASSWORD in .env.local (your Supabase database password from Dashboard > Settings > Database).');
  process.exit(1);
}

const connectionString = `postgresql://postgres.${projectRef}:${encodeURIComponent(dbPassword)}@${poolerHost}:5432/postgres`;

const sql = readFileSync(join(process.cwd(), 'supabase/migrations/006_support_analytics.sql'), 'utf8');

const client = new Client({ connectionString });

try {
  await client.connect();
  console.log('Connected to Supabase. Running migration...');
  await client.query(sql);
  console.log('Migration 006_support_analytics.sql executed successfully.');
} catch (err) {
  console.error('Migration failed:', err.message);
  process.exit(1);
} finally {
  await client.end();
}
