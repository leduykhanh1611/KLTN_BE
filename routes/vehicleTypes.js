// routes/vehicleTypes.js

const express = require('express');
const router = express.Router();
const {
  addVehicleType,
  updateVehicleType,
  softDeleteVehicleType,
  getAllVehicleTypes
} = require('../controllers/vehicleTypeController');
const auth = require('../middleware/auth');
const isAdmin = require('../middleware/isAdmin');

// @route   POST /api/vehicle-types
// @desc    Thêm loại xe mới
// @access  Private (Chỉ admin)
router.post('/', [auth, isAdmin], addVehicleType);

// @route   PUT /api/vehicle-types/:id
// @desc    Sửa thông tin loại xe
// @access  Private (Chỉ admin)
router.put('/:id', [auth, isAdmin], updateVehicleType);

// @route   DELETE /api/vehicle-types/:id
// @desc    Xóa mềm loại xe
// @access  Private (Chỉ admin)
router.delete('/:id', [auth, isAdmin], softDeleteVehicleType);

// @route   GET /api/vehicle-types
// @desc    Lấy danh sách tất cả loại xe (không bao gồm các loại xe đã bị xóa mềm)
// @access  Private (Admin hoặc user có quyền)
router.get('/', auth, getAllVehicleTypes);

module.exports = router;
