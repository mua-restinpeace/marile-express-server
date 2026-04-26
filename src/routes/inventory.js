const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { restock, adjust, getLogs, getLowStock } = require('../controllers/inventoryController');

const router = express.Router();

router.use(authenticate);
router.use(authorize('admin'));

router.post('/restock', restock);
router.post('/adjust', adjust);
router.get('/logs', getLogs);
router.get('/low-stock', getLowStock);

module.exports = router;