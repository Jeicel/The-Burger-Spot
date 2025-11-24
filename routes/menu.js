const express = require("express");
const pool = require("../db.js");
const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM menu_items");
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching menu items:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
