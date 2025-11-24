const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config();

const sqlPath = path.join(__dirname, '..', 'migrations.sql');
if (!fs.existsSync(sqlPath)) {
  console.warn('migrations.sql not found at', sqlPath, '-- skipping migrations');
  process.exit(0);
}

const sql = fs.readFileSync(sqlPath, 'utf8');

async function run() {
  const raw = process.env.DATABASE_URL || process.env.NEON_CONNECTION || '';

  if (!raw) {
    console.log('No DATABASE_URL or NEON_CONNECTION provided — skipping migrations.');
    process.exit(0);
  }

  // Common mistake: users paste placeholders like `<user>` or `...` into the string.
  if (/[<>]|\.\.\.|your_neon|your_neon_connection_string/i.test(raw)) {
    console.error('Provided connection string looks like a placeholder. Replace it with your actual Neon/Postgres connection string.');
    console.error("Example: postgres://username:password@ep-example.us-east-1.neon.tech:5432/dbname");
    process.exit(1);
  }

  let client;
  try {
    const useSsl = !/(localhost|127\.0\.0\.1)/i.test(raw);
    client = new Client({ connectionString: raw, ssl: useSsl ? { rejectUnauthorized: false } : false });
  } catch (e) {
    console.error('Failed to parse connection string. Ensure it is a valid Postgres connection string.');
    console.error('Provided connection string (sanitized):', String(raw).replace(/:[^:@]+@/, ':*****@'));
    console.error('Error:', e.message || e);
    process.exit(1);
  }

  try {
    await client.connect();
    console.log('Running migrations (single multi-statement execution)');
    await client.query(sql);
    console.log('Migrations finished successfully');
    await client.end();
    process.exit(0);
  } catch (err) {
    console.error('Migration error:', err);
    try { await client.end(); } catch(e){}
    process.exit(1);
  }
}

run();
