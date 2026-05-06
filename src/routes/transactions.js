const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { createTransaction, listTransactions, getTransaction, voidTransaction } = require('../controllers/transactionController');

const router = express.Router();

router.use(authenticate);

router.post('/', authorize('admin', 'cashier'), createTransaction);
router.get('/', authorize('admin', 'cashier'), listTransactions);
router.get('/:id', authorize('admin', 'cashier'), getTransaction);
router.post('/:id/void', authorize('admin', 'cashier'), voidTransaction);

module.exports = router;