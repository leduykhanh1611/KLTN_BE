const express = require('express');
const Payment = require('../models/Payment');
const Invoice = require('../models/Invoice');
const Cus = require('../models/Customer');
const router = express.Router();
const { generateInvoice, createPaymentLink, handlePaymentWebhook, getInvoiceAndGeneratePDF, getInvoice, createRefundInvoice } = require('../controllers/paymentController');
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
router.post('/webhook', async (req, res) => {
    console.log('req.body', req.body);
    // Tìm thông tin thanh toán theo orderCode
    const payment = await Payment.findOne({ order_code: req.body.data.orderCode });
    if (!payment) {
        return res.status(200).json({ msg: 'Không tìm thấy thông tin thanh toán' });
    }

    // Cập nhật trạng thái thanh toán
    // payment.payment_status = payment_status;
    payment.code = req.body.code;
    payment.desc = req.body.desc;
    await payment.save();
    console.log('payment', payment);


    // Nếu thanh toán thành công, cập nhật trạng thái hóa đơn
    if (req.body.code === '00') {
        const invoice = await Invoice.findById(payment.invoice_id);
        if (invoice) {
            invoice.status = 'paid';
            await invoice.save();
            console.log('invoice', invoice);

        }
        const user = await Cus.findById(invoice.customer_id);
        if (user) {
            user.total_spending += invoice.final_amount;
            await user.save();
            console.log('user', user);

        }
    } else {
        const invoice = await Invoice.findById(payment.invoice_id);
        if (invoice) {
            invoice.status = 'cancelled';
            await invoice.save();
            console.log('invoice 2', invoice);

        }
    }
    res.json();
});

// @route   GET /api/payments/invoice/:invoiceId
// @desc    Lấy thông tin hóa đơn
// @access  Private (phải đăng nhập)
router.get('/invoice/:invoiceId', auth, getInvoice);

// @route   GET /api/payments/invoice/:invoiceId/pdf
// @desc    Lấy thông tin hóa đơn và in ra bản PDF
// @access  Private (phải đăng nhập)
router.get('/invoice/:invoiceId/pdf', getInvoiceAndGeneratePDF);

// @route   POST /api/payments/refundInvoice
// @desc    trả hóa đơn
// @access  Public
router.post('/refundInvoice',auth, createRefundInvoice);
module.exports = router;