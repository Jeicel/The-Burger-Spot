const express = require("express");
const app = express();
const fs = require('fs');
const cors = require("cors");
const path = require("path");
require("dotenv").config();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve ALL static files (HTML, CSS, JS, images, videos)
app.use(express.static(path.join(__dirname)));

// Import routes
// Auto-detect ES module default export OR CommonJS module.exports
let routes = require("./routes/routes");
if (routes.default) {
  routes = routes.default;
}

// Mount routes
app.use("/api", routes);

// API status route
app.get("/api/status", (req, res) => {
  res.send("Backend API is running successfully 🎉");
});
// Port (used by startup routine)
const PORT = process.env.PORT || 5000;

// Run migrations on startup (idempotent). This helps ensure tables exist on deploy platforms.
async function runMigrationsThenStart() {
  // Import pool (support both CommonJS and ESM default export)
  let poolModule = require('./db');
  const pool = poolModule && poolModule.default ? poolModule.default : poolModule;
  
  if (!pool) {
    console.warn('No database pool available — skipping migrations and DB-powered endpoints.');

    app.get('/api/db-test', (req, res) => {
      return res.status(500).json({ ok: false, error: 'DATABASE_URL not configured on this environment.' });
    });

    // Frontend fallback (important for HTML navigation)
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "index.html"));
    });

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT} (DB disabled)`);
    });

    return; // done starting without DB
  }

  const sqlPath = path.join(__dirname, 'migrations.sql');
  try {
    if (fs.existsSync(sqlPath)) {
      const sql = fs.readFileSync(sqlPath, 'utf8');
      console.log('Running migrations from', sqlPath);
      try {
        await pool.query(sql);
        console.log('Migrations applied (or already present)');
      } catch (merr) {
        console.error('Error running migrations:', merr);
        // continue startup even if migrations fail; logs will show the issue
      }
    } else {
      console.warn('No migrations.sql found at', sqlPath);
    }
  } catch (err) {
    console.error('Failed to run migrations check:', err);
  }

  // Add a simple DB test endpoint to verify connectivity
  app.get('/api/db-test', async (req, res) => {
    try {
      const { rows } = await pool.query('SELECT COUNT(*)::int AS user_count FROM public.users');
      return res.json({ ok: true, user_count: rows[0].user_count });
    } catch (e) {
      console.error('DB test failed', e);
      return res.status(500).json({ ok: false, error: String(e) });
    }
  });

  // Frontend fallback (important for HTML navigation)
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
  });

  // Start server after migrations and route registration
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });

}

// Export app and start function so this file can be used both as a
// standalone server (node server.js) and imported by Netlify Functions.
async function startApp() {
  await runMigrationsThenStart();
}

// If run directly, start the server. When imported as a function (Netlify)
// we only export `app` and `startApp` and avoid automatically listening.
if (require.main === module) {
  startApp();
}

module.exports = { app, startApp };
// server is started inside runMigrationsThenStart() when run directly
