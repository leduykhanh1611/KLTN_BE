const express = require('express');
const router = express.Router();
const {
  addVehicle,
  updateVehicle,
  softDeleteVehicle
} = require('../controllers/vehicleController');
const auth = require('../middleware/auth');

// @route   POST /api/customers/:customerId/vehicles
// @desc    Thêm xe mới cho khách hàng
// @access  Private (Chỉ khách hàng hoặc admin)
router.post('/:customerId/vehicles', auth, addVehicle);

// @route   PUT /api/customers/:customerId/vehicles/:vehicleId
// @desc    Sửa thông tin xe của khách hàng
// @access  Private (Chỉ khách hàng hoặc admin)
router.put('/:customerId/vehicles/:vehicleId', auth, updateVehicle);

// @route   DELETE /api/customers/:customerId/vehicles/:vehicleId
// @desc    Xóa mềm xe của khách hàng
// @access  Private (Chỉ khách hàng hoặc admin)
router.delete('/:customerId/vehicles/:vehicleId', auth, softDeleteVehicle);

module.exports = router;
