const express = require('express');
const router = express.Router();
const { getRevenueByTimePeriod, getAppointmentsByTimePeriod,exportPromotionStatisticsToExcel,getServiceRevenueStatistics, getMonthlyStatistics, exportStatisticsToExcel, exportRevenueStatisticsToExcel, getRevenueStatistics, getPromotionStatistics } = require('../controllers/statisticsController');

// @route   GET /api/statistics/revenue
// @desc    Lấy doanh thu theo khoảng thời gian
// @access  Private (Chỉ admin hoặc nhân viên)
router.get('/revenue', getRevenueByTimePeriod);

// @route   GET /api/statistics/appointments
// @desc    Lấy lịch hẹn theo khoảng thời gian
// @access  Private (Chỉ admin hoặc nhân viên)
router.get('/appointments', getAppointmentsByTimePeriod);

// @route   GET /api/statistics/serviceRevenue
// @desc    Lấy những hóa đơn trả
// @access  Private (Chỉ admin hoặc nhân viên)
router.get('/serviceRevenue', getServiceRevenueStatistics);

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
router.get('/export2', exportRevenueStatisticsToExcel);


// @route   GET /api/statistics/revenue
// @desc    Lấy doanh thu theo khoảng thời gian
// @access  Private (Chỉ admin hoặc nhân viên)
router.get('/getAll/revenue', getRevenueStatistics);

// @route   GET /api/statistics/promotion
// @desc    Lấy thống kê khuyến mãi
// @access  Private (Chỉ admin hoặc nhân viên)
router.get('/getAll/promotion', getPromotionStatistics);

// @route   GET /api/statistics/exportPromotion
// @desc    Xuất thống kê khuyến mãi ra file Excel
// @access  Private (Chỉ admin hoặc nhân viên)
router.get('/exportPromotion', exportPromotionStatisticsToExcel);

module.exports = router;
