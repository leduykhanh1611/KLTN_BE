const Appointment = require('../models/Appointment');
const AppointmentService = require('../models/AppointmentService');
const PriceLine = require('../models/PriceLine');
const Invoice = require('../models/Invoice');
const InvoiceDetail = require('../models/InvoiceDetail');
const PromotionHeader = require('../models/PromotionHeader');
const CustomerRank = require('../models/CustomerRank');
const PayOS = require('@payos/node');
const Payment = require('../models/Payment');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const Cus = require('../models/Customer');
const employee = require('../models/Employee');
const PromotionLine = require('../models/PromotionLine');
const PromotionDetail = require('../models/PromotionDetail');
const { console } = require('inspector');
const payOS = new PayOS(
    process.env.PAYOS_CLIENT_ID,
    process.env.PAYOS_API_KEY,
    process.env.PAYOS_CHECKSUM_KEY
);

// Tạo liên kết thanh toán cho khách hàng
exports.createPaymentLink = async (req, res) => {
    const { invoiceId } = req.params;
    try {
        // Tìm hóa đơn theo ID
        const invoice = await Invoice.findById(invoiceId);
        if (!invoice || invoice.is_deleted) {
            return res.status(404).json({ msg: 'Không tìm thấy hóa đơn hợp lệ' });
        }
        if (invoice.status === 'paid') {
            return res.status(400).json({ msg: 'Hóa đơn đã được thanh toán' });
        }
        // Lấy chi tiết hóa đơn
        const invoiceDetails = await InvoiceDetail.find({
            invoice_id: invoiceId,
            is_deleted: false,
        }).populate('service_id');

        // Tạo mã đơn hàng ngẫu nhiên 6 chữ số
        const orderCode = Math.floor(100000 + Math.random() * 900000);
        const amount = invoice.final_amount;
        // Tạo liên kết thanh toán bằng PayOS
        const paymentBody = {
            orderCode: orderCode,
            amount: amount,
            description: invoiceId,
            items: invoiceDetails.map(detail => ({
                name: detail.service_id.name,
                quantity: detail.quantity,
                price: detail.price,
            })),
            cancelUrl: 'https://auto-tech-mu.vercel.app/appointments/completed',
            returnUrl: 'https://auto-tech-mu.vercel.app/appointments/completed',
        };

        const paymentLinkRes = await payOS.createPaymentLink(paymentBody);

        // Lưu thông tin thanh toán vào cơ sở dữ liệu
        const payment = new Payment({
            invoice_id: invoice._id,
            order_code: orderCode,
            amount: invoice.final_amount,
            description: invoice._id,
            account_number: paymentLinkRes.accountNumber || '',
            reference: paymentLinkRes.reference || '',
            transaction_date_time: new Date().toISOString(),
            currency: paymentLinkRes.currency || 'VND',
            payment_link_id: paymentLinkRes.paymentLinkId || '',
            code: paymentLinkRes.code || '',
            desc: paymentLinkRes.desc || 'Chờ thanh toán',
            counter_account_bank_id: paymentLinkRes.counterAccountBankId || null,
            counter_account_bank_name: paymentLinkRes.counterAccountBankName || null,
            counter_account_name: paymentLinkRes.counterAccountName || null,
            counter_account_number: paymentLinkRes.counterAccountNumber || null,
            virtual_account_name: paymentLinkRes.virtualAccountName || null,
            virtual_account_number: paymentLinkRes.virtualAccountNumber || null,
            payment_status: 'Chờ thanh toán',
            is_deleted: false,
        });
        await payment.save();

        res.status(200).json({ msg: 'Liên kết thanh toán đã được tạo thành công', paymentLink: paymentLinkRes });
    } catch (err) {
        console.error('Lỗi khi tạo liên kết thanh toán:', err.message);
        res.status(500).send('Lỗi máy chủ');
    }
};

// Xuất hóa đơn thanh toán cho khách hàng
exports.generateInvoice = async (req, res) => {
    const { appointmentId, employeeId } = req.params;

    try {
        // Tìm lịch hẹn theo ID
        const appointment = await Appointment.findById(appointmentId).populate('vehicle_id');
        if (!appointment || appointment.is_deleted || appointment.status !== 'completed') {
            return res.status(404).json({ msg: 'Không tìm thấy lịch hẹn đã hoàn thành' });
        }

        // Lấy tất cả các dịch vụ liên quan đến lịch hẹn
        const appointmentServices = await AppointmentService.find({
            appointment_id: appointmentId,
            is_deleted: false,
        }).populate('price_line_id customer_id');

        if (appointmentServices.length === 0) {
            return res.status(400).json({ msg: 'Không có dịch vụ nào liên quan đến lịch hẹn' });
        }

        // Tính toán tổng phí dựa trên bảng giá
        let totalAmount = 0;
        const invoiceDetails = [];

        for (let appService of appointmentServices) {
            // Tìm giá của dịch vụ tương ứng với loại xe trong lịch hẹn
            const priceLine = await PriceLine.findById(appService.price_line_id).populate('service_id');

            if (!priceLine) {
                return res.status(400).json({ msg: `Không tìm thấy bảng giá cho dịch vụ: ${appService.service_id.name}` });
            }

            totalAmount += priceLine.price;

            // Thêm chi tiết hóa đơn
            invoiceDetails.push({
                service_id: priceLine.service_id._id,
                price: priceLine.price,
                quantity: 1,
            });
        }

        // Tự động áp dụng khuyến mãi nếu có
        let discountAmount = 0;
        let fixedDiscount = 0;
        let percentageDiscount = 0;
        let promotionHeader = [];

        // Kiểm tra các chương trình khuyến mãi áp dụng cho khách hàng
        const activePromotions = await PromotionLine.find({
            is_active: true,
            is_deleted: false,
            start_date: { $lte: Date.now() },
            end_date: { $gte: Date.now() },
        }).populate({
            path: 'promotion_header_id',
            match: {
                is_active: true,
                is_deleted: false,
                start_date: { $lte: Date.now() },
                end_date: { $gte: Date.now() },
            },
        });

        // Áp dụng cả khuyến mãi cố định và khuyến mãi theo phần trăm nếu có
        for (let promotion of activePromotions) {
            // Áp dụng khuyến mãi nếu khách hàng đủ điều kiện (ví dụ: hạng khách hàng phù hợp)  
            if (promotion.discount_type == 2) {
                const promotionDetails = await PromotionDetail.find({ promotion_line_id: promotion._id, is_deleted: false });
                if (promotionDetails.min_order_value <= totalAmount) {
                    fixedDiscount += promotion.discount_value;
                    promotionHeader.push(promotionDetails._id);
                }
            } else if (promotion.discount_type == 1) {
                const promotionDetails = await PromotionDetail.find({ promotion_line_id: promotion._id, is_deleted: false });
                const calculatedPercentageDiscount = totalAmount * (promotionDetails.discount_value / 100);
                if (promotionDetails.applicable_rank_id == appointmentServices.customer_id.customer_rank_id) {
                    percentageDiscount = calculatedPercentageDiscount;
                    promotionHeader.push(promotionDetails._id);
                }
            }
        }

        // Tính tổng số tiền giảm giá
        discountAmount = fixedDiscount + percentageDiscount;

        // Tổng tiền sau khi áp dụng khuyến mãi
        const finalAmount = totalAmount - discountAmount;

        // Tạo hóa đơn mới
        const invoice = new Invoice({
            customer_id: appointment.customer_id,
            employee_id: employeeId, // Sẽ cập nhật sau nếu cần
            appointment_id: appointmentId,
            promotion_header_id: promotionHeader.length != 0 ? promotionHeader : null, // Gán khuyến mãi nếu có
            total_amount: totalAmount,
            discount_amount: discountAmount,
            final_amount: finalAmount,
            status: 'pending',
            is_deleted: false,
        });

        await invoice.save();

        // Lưu chi tiết hóa đơn vào database
        for (let detail of invoiceDetails) {
            const invoiceDetail = new InvoiceDetail({
                invoice_id: invoice._id,
                service_id: detail.service_id,
                price: detail.price,
                quantity: detail.quantity,
                is_deleted: false,
            });

            await invoiceDetail.save();
        }
        // Lấy lại thông tin hóa đơn đã lưu, bao gồm các thông tin liên quan
        const savedInvoice = await Invoice.findById(invoice._id)
            .populate('customer_id')
            .populate('employee_id')
            .populate('appointment_id')
            .populate('promotion_header_id')
            .lean();

        // Lấy chi tiết hóa đơn
        const invoiceDetailList = await InvoiceDetail.find({ invoice_id: invoice._id, is_deleted: false })
            .populate('service_id')
            .lean();

        // Gán chi tiết hóa đơn vào đối tượng hóa đơn
        savedInvoice.details = invoiceDetailList;

        // Trả về hóa đơn đầy đủ
        res.status(201).json({
            msg: 'Hóa đơn đã được tạo thành công',
            invoice: savedInvoice,
        });
    } catch (err) {
        console.error('Lỗi khi tạo hóa đơn:', err.message);
        res.status(500).send('Lỗi máy chủ');
    }
};
// Xử lý webhook trả về kết quả thanh toán
exports.handlePaymentWebhook = async (req, res) => {
    // const { orderCode, transaction_id, code, desc, counterAccountBankId, counterAccountBankName, counterAccountName, counterAccountNumber, virtualAccountName, virtualAccountNumber } = req.body.data;
    console.log(req.body);
    res.json({ msg: 'Webhook xử lý thành công' });
    // try {
    //     // Tìm thông tin thanh toán theo orderCode
    //     const payment = await Payment.findOne({ order_code: orderCode });
    //     if (!payment) {
    //         return res.status(200).json({ msg: 'Không tìm thấy thông tin thanh toán' });
    //     }

    //     // Cập nhật trạng thái thanh toán
    //     payment.payment_status = payment_status;
    //     payment.transaction_id = transaction_id;
    //     payment.code = code;
    //     payment.desc = desc;
    //     payment.counter_account_bank_id = counterAccountBankId || null;
    //     payment.counter_account_bank_name = counterAccountBankName || null;
    //     payment.counter_account_name = counterAccountName || null;
    //     payment.counter_account_number = counterAccountNumber || null;
    //     payment.virtual_account_name = virtualAccountName || null;
    //     payment.virtual_account_number = virtualAccountNumber || null;
    //     await payment.save();

    //     // Nếu thanh toán thành công, cập nhật trạng thái hóa đơn
    //     if (code === '00') {
    //         const invoice = await Invoice.findById(payment.invoice_id);
    //         if (invoice) {
    //             invoice.status = 'paid';
    //             await invoice.save();
    //         }
    //         const user = await Cus.findById(invoice.customer_id);
    //         if (user) {
    //             user.total_spending += invoice.final_amount;
    //             await user.save();
    //         }
    //     } else {
    //         const invoice = await Invoice.findById(payment.invoice_id);
    //         if (invoice) {
    //             invoice.status = 'cancelled';
    //             await invoice.save();
    //         }
    //     }

    //     res.status(200).json({ msg: 'Webhook xử lý thành công' });
    // } catch (err) {
    //     console.error('Lỗi khi xử lý webhook:', err.message);
    //     res.status(500).send('Lỗi máy chủ');
    // }
};

// Lấy thông tin hóa đơn và in ra bản PDF
exports.getInvoiceAndGeneratePDF = async (req, res) => {
    const { invoiceId } = req.params;

    try {
        // Tìm hóa đơn theo ID
        const invoice = await Invoice.findById(invoiceId).populate('customer_id promotion_header_id')
        if (!invoice || invoice.is_deleted) {
            return res.status(404).json({ msg: 'Không tìm thấy hóa đơn' });
        }
        if (invoice.status !== 'paid') {
            return res.status(400).json({ msg: 'Hóa đơn chưa được thanh toán' });
        }
        const emp = await employee.findById(invoice.employee_id);
        // Lấy chi tiết hóa đơn
        const invoiceDetails = await InvoiceDetail.find({
            invoice_id: invoiceId,
            is_deleted: false,
        }).populate('service_id');

        // Tạo PDF hóa đơn
        const doc = new PDFDocument();
        const buffers = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
            const pdfData = Buffer.concat(buffers);
            res.set({
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename=invoice_${invoiceId}.pdf`,
            });
            res.send(pdfData);
        });

        // Đường dẫn tới file font hỗ trợ tiếng Việt
        const fontPath = path.join(__dirname, '../fonts/Roboto-Regular.ttf');
        doc.font(fontPath);

        // Thông tin tiêu đề hóa đơn
        doc.fontSize(20).text('Hóa đơn thanh toán', { align: 'center' });
        doc.moveDown();

        // Thông tin khách hàng
        doc.fontSize(12).text(`Tên khách hàng: ${invoice.customer_id.name}`);
        doc.text(`Email: ${invoice.customer_id.email}`);
        doc.text(`Ngày xuất hóa đơn: ${new Date().toLocaleDateString()}`);
        doc.text(`Nhân viên: ${emp.name}`);

        doc.moveDown();

        // Thông tin chi tiết hóa đơn
        invoiceDetails.forEach(detail => {
            doc.text(`Dịch vụ: ${detail.service_id.name}`);
            doc.text(`Giá: ${detail.price} VND`);
            doc.text(`Số lượng: ${detail.quantity}`);
            doc.moveDown();
        });

        doc.moveDown();

        invoice.promotion_header_id.forEach(promotion => {
            doc.text(`Khuyến mãi: ${promotion.name}`);
            doc.text(`Nội dung: ${promotion.description}`);
        });
        doc.moveDown();
        // Tổng tiền
        doc.text(`Tổng tiền: ${invoice.total_amount} VND`);
        doc.text(`Giảm giá: ${invoice.discount_amount} VND`);
        doc.text(`Thành tiền: ${invoice.final_amount} VND`, { bold: true });

        // Kết thúc và lưu file PDF
        doc.end();
    } catch (err) {
        console.error('Lỗi khi tạo PDF hóa đơn:', err.message);
        res.status(500).send('Lỗi máy chủ');
    }
};

// lấy thông tin hóa đơn
exports.getInvoice = async (req, res) => {
    const { invoiceId } = req.params;

    try {
        // Tìm hóa đơn theo ID
        const invoice = await Invoice.findById(invoiceId).populate('customer_id promotion_header_id')
        if (!invoice || invoice.is_deleted) {
            return res.status(404).json({ msg: 'Không tìm thấy hóa đơn' });
        }

        // Lấy chi tiết hóa đơn
        const invoiceDetails = await InvoiceDetail.find({
            invoice_id: invoiceId,
            is_deleted: false,
        }).populate('service_id');

        res.status(200).json({ invoice, invoiceDetails });
    } catch (err) {
        console.error('Lỗi khi lấy thông tin hóa đơn:', err.message);
        res.status(500).send('Lỗi máy chủ');
    }
};