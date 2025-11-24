const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Invalid JSON' }) };
  }

  const { email, password, name } = body;
  if (!email || !password) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'email and password required' }) };
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'DATABASE_URL not configured' }) };
  }

  const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });

  try {
    const passwordHash = await bcrypt.hash(password, 10);

    const q = `
      INSERT INTO public.users (email, name, password_hash)
      VALUES ($1, $2, $3)
      RETURNING id, email, name, created_at
    `;
    const values = [email.toLowerCase().trim(), name || null, passwordHash];

    const res = await pool.query(q, values);
    const user = res.rows[0];
    return {
      statusCode: 201,
      body: JSON.stringify({ ok: true, user }),
    };
  } catch (err) {
    console.error('create-user error', err);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: String(err) }) };
  } finally {
    try { await pool.end(); } catch (e) { /* ignore */ }
  }
};
