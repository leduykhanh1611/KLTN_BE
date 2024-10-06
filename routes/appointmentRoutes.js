const express = require('express');
const router = express.Router();
const {
  registerAppointmentWithServices,
  getAppointmentDetailsWithTotalCost,
  cancelAppointment,
  getSlotById,
} = require('../controllers/appointmentController');

const auth = require('../middleware/auth');

// @route   POST /api/appointments
// @desc    Đăng ký lịch hẹn với nhiều dịch vụ
// @access  Private (phải đăng nhập)
router.post('/', auth, registerAppointmentWithServices);

// @route   GET /api/appointments/:appointmentId
// @desc    Lấy thông tin lịch hẹn cùng các dịch vụ liên quan và tổng phí
// @access  Private (phải đăng nhập)
router.get('/:appointmentId', auth, getAppointmentDetailsWithTotalCost);

// @route   DELETE /api/appointments/:appointmentId
// @desc    Hủy lịch hẹn (xóa mềm)
// @access  Private (phải đăng nhập)
router.delete('/:appointmentId', auth, cancelAppointment);

// @route   GET /api/slots/:slotId
// @desc    Lấy thông tin slot cùng các lịch hẹn và dịch vụ liên quan
// @access  Private (phải đăng nhập)
router.get('/slots/:slotId', auth, getSlotById);

module.exports = router;