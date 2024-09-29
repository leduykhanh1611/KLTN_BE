// routes/services.js

const express = require('express');
const router = express.Router();
const {
  addService,
  getAllServices,
  getServiceById,
  updateService,
  softDeleteService
} = require('../controllers/serviceController');
const auth = require('../middleware/auth');
const isAdmin = require('../middleware/isAdmin');

// @route   POST /api/services
// @desc    Thêm dịch vụ mới
// @access  Private (chỉ admin)
router.post('/', [auth, isAdmin], addService);

// @route   GET /api/services
// @desc    Lấy tất cả dịch vụ
// @access  Public
router.get('/', getAllServices);

// @route   GET /api/services/:serviceId
// @desc    Lấy chi tiết dịch vụ
// @access  Public
router.get('/:serviceId', getServiceById);

// @route   PUT /api/services/:serviceId
// @desc    Cập nhật dịch vụ
// @access  Private (chỉ admin)
router.put('/:serviceId', [auth, isAdmin], updateService);

// @route   DELETE /api/services/:serviceId
// @desc    Xóa mềm dịch vụ
// @access  Private (chỉ admin)
router.delete('/:serviceId', [auth, isAdmin], softDeleteService);

module.exports = router;
