// routes/customerRanks.js

const express = require('express');
const router = express.Router();
const {
  addCustomerRank,
  updateCustomerRank,
  softDeleteCustomerRank,
  getAllCustomerRanks,
  getCustomerRankById,
  getCustomersByRank,
} = require('../controllers/customerRankController');
const auth = require('../middleware/auth');
const isAdmin = require('../middleware/isAdmin');

// @route   POST /api/customer-ranks
// @desc    Thêm hạng khách hàng mới
// @access  Private (chỉ admin)
router.post('/', [auth, isAdmin], addCustomerRank);

// @route   PUT /api/customer-ranks/:rankId
// @desc    Cập nhật hạng khách hàng
// @access  Private (chỉ admin)
router.put('/:rankId', [auth, isAdmin], updateCustomerRank);

// @route   DELETE /api/customer-ranks/:rankId
// @desc    Xóa mềm hạng khách hàng
// @access  Private (chỉ admin)
router.delete('/:rankId', [auth, isAdmin], softDeleteCustomerRank);

// @route   GET /api/customer-ranks
// @desc    Lấy tất cả hạng khách hàng (bỏ qua những hạng đã bị xóa mềm)
// @access  Public
router.get('/', getAllCustomerRanks);

// @route   GET /api/customer-ranks/:rankId
// @desc    Lấy chi tiết hạng khách hàng theo ID
// @access  Public
router.get('/:rankId', getCustomerRankById);

// @route   GET /api/customer-ranks/:rankId/customers
// @desc    Lấy tất cả khách hàng theo hạng của họ
// @access  Private (chỉ admin)
router.get('/:rankId/customers', [auth, isAdmin], getCustomersByRank);

module.exports = router;
