const { Client } = require('pg');

exports.handler = async function(event, context) {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const conn = process.env.NEON_CONNECTION;
  if (!conn) {
    return { statusCode: 500, body: 'NEON_CONNECTION not configured' };
  }

  const client = new Client({ connectionString: conn });
  try {
    await client.connect();
    const res = await client.query('SELECT * FROM orders ORDER BY created_at DESC LIMIT 200');
    await client.end();
    return { statusCode: 200, body: JSON.stringify({ orders: res.rows }) };
  } catch (err) {
    console.error('get-orders error', err);
    try { await client.end(); } catch (_) {}
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
