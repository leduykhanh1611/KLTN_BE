const express = require('express');
const router = express.Router();
const { generateInvoice, createPaymentLink } = require('../controllers/paymentController');
const auth = require('../middleware/auth');

// @route   POST /api/payments/generate-invoice/:appointmentId
// @desc    Xuất hóa đơn thanh toán cho khách hàng dựa trên lịch hẹn
// @access  Private (phải đăng nhập)
router.post('/generate-invoice/:appointmentId', auth, generateInvoice);

// @route   POST /api/payments/create-payment-link/:invoiceId
// @desc    Tạo liên kết thanh toán cho hóa đơn
// @access  Private (phải đăng nhập)
router.post('/create-payment-link/:invoiceId', createPaymentLink);

module.exports = router;