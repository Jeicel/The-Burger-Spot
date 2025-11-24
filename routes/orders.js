const express = require("express");
const pool = require("../db.js");
const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { items, total_price } = req.body;

    // Insert order
    const order = await pool.query(
      "INSERT INTO orders (total_price) VALUES ($1) RETURNING id",
      [total_price]
    );

    const orderId = order.rows[0].id;

    // Insert ordered items
    for (let item of items) {
      await pool.query(
        "INSERT INTO order_items (order_id, item_id, quantity, price) VALUES ($1, $2, $3, $4)",
        [orderId, item.item_id, item.quantity, item.price]
      );
    }

    res.json({ success: true, order_id: orderId });

  } catch (err) {
    console.error("Error creating order:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
