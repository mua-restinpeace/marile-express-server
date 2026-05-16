const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { listUsers, createUser, updateUser, deleteUser, changePassword } = require('../controllers/userController');

const router = express.Router();
router.use(authenticate);

router.get('/', authorize('admin'), listUsers);
router.post('/', authorize('admin'),  createUser);
router.put('/:id', authorize('admin', 'cashier'), updateUser);
router.delete('/:id', authorize('admin'), deleteUser);

// admin can change anyone password, chasier can change only thier own
router.put('/:id/password', authorize('admin', 'cashier'), changePassword);

module.exports = router;