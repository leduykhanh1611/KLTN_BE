const express = require('express');
const router = express.Router();
const { getRevenueByTimePeriod, getAppointmentsByTimePeriod, getMonthlyStatistics, exportStatisticsToExcel, exportMonthlyStatisticsToExcel } = require('../controllers/statisticsController');

// @route   GET /api/statistics/revenue
// @desc    Lấy doanh thu theo khoảng thời gian
// @access  Private (Chỉ admin hoặc nhân viên)
router.get('/revenue', getRevenueByTimePeriod);

// @route   GET /api/statistics/appointments
// @desc    Lấy lịch hẹn theo khoảng thời gian
// @access  Private (Chỉ admin hoặc nhân viên)
router.get('/appointments', getAppointmentsByTimePeriod);

// @route   GET /api/statistics/monthly
// @desc    Lấy thống kê theo tháng
// @access  Private (Chỉ admin hoặc nhân viên)
router.get('/monthly', getMonthlyStatistics);

// @route   GET /api/statistics/export
// @desc    Xuất thống kê ra file Excel
// @access  Private (Chỉ admin hoặc nhân viên)
router.get('/export', exportStatisticsToExcel);

// @route   GET /api/statistics/export2
// @desc    Xuất thống kê ra file Excel
// @access  Private (Chỉ admin hoặc nhân viên)
router.get('/export2', exportMonthlyStatisticsToExcel);
module.exports = router;
