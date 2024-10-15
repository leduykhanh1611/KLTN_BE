const express = require('express');
const router = express.Router();
const {
  registerAppointmentWithServices,
  getAppointmentDetailsWithTotalCost,
  cancelAppointment,
  getSlotById,
  processAppointmentArrival,
  filterAppointmentsByDate,
  getCompletedAppointments,
  updateAppointment
} = require('../controllers/appointmentController');

const auth = require('../middleware/auth');

// @route   POST /api/appointments
// @desc    Đăng ký lịch hẹn với nhiều dịch vụ
// @access  Private (phải đăng nhập)
router.post('/', auth, registerAppointmentWithServices);

// @route   GET /api/appointments
// @desc    Lấy danh sách lịch hẹn theo ngày
// @access  Private (phải đăng nhập)
router.get('/', auth, filterAppointmentsByDate);

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

// @route   POST /api/appointments/:appointmentId/arrive
// @desc    Xác nhận khách hàng đã đến
// @access  Private (phải đăng nhập)
router.post('/:appointmentId/arrive', auth, processAppointmentArrival);

// @route   GET /api/appointments/completed
// @desc    Lấy danh sách lịch hẹn đã hoàn thành
// @access  Private (phải đăng nhập)
router.get('/get/completed', auth, getCompletedAppointments);

// @route   PUT /api/appointments/:appointmentId
// @desc    Cập nhật thông tin lịch hẹn
// @access  Private (phải đăng nhập)
router.put('/:appointmentId', auth, updateAppointment);


module.exports = router;