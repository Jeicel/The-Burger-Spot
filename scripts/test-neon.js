const { Client } = require('pg');

(async () => {
  const conn = process.env.NEON_CONNECTION || process.env.DATABASE_URL;
  if (!conn) {
    console.error('NEON_CONNECTION or DATABASE_URL is not set. Set one in this shell and re-run.');
    process.exit(2);
  }

  // For many node versions and environments, passing ssl: { rejectUnauthorized: false }
  // is needed when the connection string includes `sslmode=require`.
  const client = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    const res = await client.query('SELECT now() as now');
    console.log('Connected to Neon. Server time:', res.rows[0].now);
    // Optionally create a lightweight test table (safe to run multiple times)
    await client.query(`CREATE TABLE IF NOT EXISTS test_connection (id serial primary key, created_at timestamptz default now())`);
    await client.query(`INSERT INTO test_connection DEFAULT VALUES`);
    const r2 = await client.query('SELECT id, created_at FROM test_connection ORDER BY id DESC LIMIT 1');
    console.log('Inserted test row:', r2.rows[0]);
    await client.end();
    process.exit(0);
  } catch (err) {
    console.error('Connection or query failed:', err.message || err);
    try { await client.end(); } catch (_) {}
    process.exit(1);
  }
})();
