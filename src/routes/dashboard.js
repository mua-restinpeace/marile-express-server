const express = require("express");
const { authenticate, authorize } = require("../middleware/auth");
const { getSummary, getRevenueChart, getTopProducts, getSnapshot } = require("../controllers/dashboardController");

const router = express.Router();

router.use(authenticate);
router.use(authorize('admin'));

router.get('/summary', getSummary);
router.get('/revenue-chart', getRevenueChart);
router.get('/top-products', getTopProducts);
router.get('/snapshot', getSnapshot);

module.exports = router;