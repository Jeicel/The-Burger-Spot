import pkg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pkg;
const connectionString = process.env.DATABASE_URL || process.env.NEON_CONNECTION || '';

let pool = null;

if (!connectionString) {
  console.warn('db.js: No DATABASE_URL or NEON_CONNECTION found in environment. Database features will be disabled.');
  pool = null;
} else {
  const useSsl = !/(localhost|127\.0\.0\.1)/i.test(connectionString);
  const source = process.env.DATABASE_URL ? 'DATABASE_URL' : 'NEON_CONNECTION';
  console.log(`db.js: Using ${source} — creating Pool (ssl=${useSsl})`);
  pool = new Pool({
    connectionString,
    ssl: useSsl ? { rejectUnauthorized: false } : false,
  });
  pool.on('error', (err) => {
    console.error('Unexpected idle client error', err);
  });
}

export default pool;
