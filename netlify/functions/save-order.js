const { Client } = require('pg');

exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  const conn = process.env.NEON_CONNECTION;
  if (!conn) {
    return { statusCode: 500, body: 'NEON_CONNECTION not configured' };
  }

  const client = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();

    // Create table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id text PRIMARY KEY,
        customer text,
        customer_email text,
        customer_phone text,
        address text,
        barangay text,
        city text,
        zip text,
        municipality text,
        items jsonb,
        order_notes text,
        payment_method text,
        payment_details jsonb,
        subtotal numeric,
        shipping_fee numeric,
        total numeric,
        status text,
        delivery_time text,
        created_at timestamptz DEFAULT now()
      )
    `);

    const q = `INSERT INTO orders (
      id, customer, customer_email, customer_phone, address, barangay, city, zip, municipality,
      items, order_notes, payment_method, payment_details, subtotal, shipping_fee, total, status, delivery_time
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
    RETURNING *`;

    const vals = [
      body.id,
      body.customer,
      body.customerEmail || body.customer_email || null,
      body.customerPhone || body.customer_phone || null,
      body.deliveryAddress || body.address || null,
      body.deliveryBarangay || body.barangay || null,
      body.deliveryCity || body.city || null,
      body.zip || null,
      body.municipality || null,
      // jsonb fields should be passed as stringified JSON to ensure correct insertion
      JSON.stringify(body.items || []),
      body.orderNotes || body.order_notes || null,
      body.paymentMethod || body.payment_method || null,
      JSON.stringify(body.paymentDetails || body.payment_details || {}),
      body.subtotal || 0,
      body.shippingFee || body.shipping_fee || 0,
      body.total || 0,
      body.status || 'preparing',
      body.deliveryTime || body.delivery_time || null
    ];

    // Debug: log what will be inserted (avoid logging sensitive payment details in production)
    console.log('save-order payload (partial):', {
      id: body.id,
      customer: body.customer,
      subtotal: body.subtotal,
      total: body.total
    });

    const res = await client.query(q, vals);
    console.log('save-order db result:', res.rowCount);
    await client.end();

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, order: res.rows[0] })
    };
  } catch (err) {
    console.error('save-order error', err);
    try { await client.end(); } catch (_) {}
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
