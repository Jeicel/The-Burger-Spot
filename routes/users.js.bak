const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');

// Import pool (support both CommonJS and ESM default export)
let poolModule = require('../db');
const pool = poolModule && poolModule.default ? poolModule.default : poolModule;

router.post('/', async (req, res) => {
  const { name, email, password, phone } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });

  try {
    const normalized = (email || '').trim().toLowerCase();
    const exists = await pool.query('SELECT id FROM public.users WHERE email = $1', [normalized]);
    if (exists.rows && exists.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const hash = await bcrypt.hash(password, 10);
    const insert = await pool.query(
      `INSERT INTO public.users (email, name, phone, role, password_hash)
       VALUES ($1,$2,$3,$4,$5) RETURNING id, email, name, phone, role, created_at`,
      [normalized, name || null, phone || null, 'customer', hash]
    );

    const user = insert.rows[0];
    return res.status(201).json({ user });
  } catch (err) {
    console.error('users.create error', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
