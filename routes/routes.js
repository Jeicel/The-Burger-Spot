const express = require("express");
const orders = require("./orders.js");
const menu = require("./menu.js");
const users = require("./users.js");

const router = express.Router();

// Mount only the route modules that exist
router.use("/orders", orders);
router.use("/users", users);

// Mount both /menu and /products for backward compatibility
router.use("/menu", menu);
router.use("/products", menu);

module.exports = router;
