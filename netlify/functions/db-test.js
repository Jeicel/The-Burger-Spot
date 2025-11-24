const { Pool } = require('pg');

exports.handler = async function (event) {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'DATABASE_URL not configured' }) };
  }

  const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
  try {
    const { rows } = await pool.query('SELECT COUNT(*)::int AS user_count FROM public.users');
    return { statusCode: 200, body: JSON.stringify({ ok: true, user_count: rows[0].user_count }) };
  } catch (err) {
    console.error('db-test error', err);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: String(err) }) };
  } finally {
    try { await pool.end(); } catch (e) { /* ignore */ }
  }
};
