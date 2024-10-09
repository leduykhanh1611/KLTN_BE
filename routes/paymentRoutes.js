const express = require('express');
const router = express.Router();
const { generateInvoice, createPaymentLink, handlePaymentWebhook, getInvoiceAndGeneratePDF } = require('../controllers/paymentController');
const auth = require('../middleware/auth');

// @route   POST /api/payments/generate-invoice/:appointmentId
// @desc    Xuất hóa đơn thanh toán cho khách hàng dựa trên lịch hẹn
// @access  Private (phải đăng nhập)
router.post('/generate-invoice/:appointmentId/employee/:employeeId', auth, generateInvoice);

// @route   POST /api/payments/create-payment-link/:invoiceId
// @desc    Tạo liên kết thanh toán cho hóa đơn
// @access  Private (phải đăng nhập)
router.post('/create-payment-link/:invoiceId', createPaymentLink);

// @route   POST /api/payments/webhook
// @desc    Xử lý webhook trả về kết quả thanh toán
// @access  Public
router.post('/webhook', handlePaymentWebhook);

// @route   GET /api/payments/invoice/:invoiceId/pdf
// @desc    Lấy thông tin hóa đơn và in ra bản PDF
// @access  Private (phải đăng nhập)
router.get('/invoice/:invoiceId/pdf', auth, getInvoiceAndGeneratePDF);
module.exports = router;