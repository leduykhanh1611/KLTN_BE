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
        const appointment = await Appointment.findById(appointmentId).populate('vehicle_id customer_id').lean();
        if (!appointment || appointment.is_deleted || appointment.status !== 'completed') {
            return res.status(404).json({ msg: 'Không tìm thấy lịch hẹn đã hoàn thành' });
        }
        const emp = await employee.findById(employeeId);    
        if (!emp || emp.is_deleted) {
            return res.status(404).json({ msg: 'Không tìm thấy nhân viên' });
        }
        const invoiceExist = await Invoice.findOne({ appointment_id: appointmentId });
        if (invoiceExist) {
            return res.status(400).json({ msg: 'Hóa đơn đã được tạo' });
        }

        // Lấy tất cả các dịch vụ liên quan đến lịch hẹn
        const appointmentServices = await AppointmentService.find({
            appointment_id: appointmentId,
            is_deleted: false,
        }).populate('price_line_id').lean();

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

        // Tạo một Map để lưu trữ các promotion_header_id đã thêm và thông tin của promotion line đã được thêm
        const addedPromotionHeaders = new Map();
        const promotionHeader = []; // Danh sách các promotion line id đã được áp dụng

        // Áp dụng cả khuyến mãi cố định và khuyến mãi theo phần trăm nếu có
        for (let promotion of activePromotions) {
            const promotionHeaderId = promotion.promotion_header_id.toString();

            if (promotion.discount_type == 2) {
                // Tìm kiếm các promotion detail tương ứng với promotion line
                const promotionDetails = await PromotionDetail.find({ promotion_line_id: promotion._id, is_deleted: false });

                // Tìm promotionDetail có giá trị min_order_value cao nhất nhưng nhỏ hơn hoặc bằng totalAmount
                const validPromotionDetails = promotionDetails
                    .filter(detail => detail.min_order_value <= totalAmount) // Chỉ lấy những promotion phù hợp
                    .sort((a, b) => b.discount_value - a.discount_value); // Sắp xếp theo discount_value giảm dần

                if (validPromotionDetails.length > 0) {
                    const bestPromotionDetail = validPromotionDetails[0]; // Lấy dòng có discount_value cao nhất

                    // Nếu promotion_header_id đã tồn tại trong Map
                    if (addedPromotionHeaders.has(promotionHeaderId)) {
                        // So sánh với promotion line đã lưu để quyết định thay thế hay không
                        const existingPromotion = addedPromotionHeaders.get(promotionHeaderId);
                        if (bestPromotionDetail.min_order_value > existingPromotion.min_order_value) {
                            // Thay thế nếu min_order_value của khuyến mãi mới lớn hơn khuyến mãi đã lưu
                            fixedDiscount = fixedDiscount - existingPromotion.discount_value + bestPromotionDetail.discount_value;

                            // Cập nhật promotion header list và Map với khuyến mãi mới tốt nhất
                            promotionHeader[promotionHeader.indexOf(existingPromotion.promotion_line_id)] = promotion._id;
                            addedPromotionHeaders.set(promotionHeaderId, {
                                ...promotion,
                                promotion_line_id: promotion._id,
                                discount_value: bestPromotionDetail.discount_value,
                                min_order_value: bestPromotionDetail.min_order_value,
                            });
                        }
                    } else {
                        // Nếu promotion_header_id chưa tồn tại, thêm mới khuyến mãi
                        fixedDiscount += bestPromotionDetail.discount_value;
                        promotionHeader.push(promotion._id);
                        addedPromotionHeaders.set(promotionHeaderId, {
                            ...promotion,
                            promotion_line_id: promotion._id,
                            discount_value: bestPromotionDetail.discount_value,
                            min_order_value: bestPromotionDetail.min_order_value,
                        });
                    }
                }
            } else if (promotion.discount_type == 1) {
                const promotionDetails = await PromotionDetail.find({ promotion_line_id: promotion._id, is_deleted: false });

                // Tìm promotion detail phù hợp với hạng khách hàng và có discount_value cao nhất
                const validPromotionDetails = promotionDetails
                    .filter(detail =>
                        detail.applicable_rank_id &&
                        detail.applicable_rank_id.equals(appointment.customer_id.customer_rank_id)
                    )
                    .sort((a, b) => b.discount_value - a.discount_value); // Sắp xếp theo discount_value giảm dần

                if (validPromotionDetails.length > 0) {
                    const bestPromotionDetail = validPromotionDetails[0];
                    const calculatedPercentageDiscount = totalAmount * (bestPromotionDetail.discount_value / 100);

                    // Nếu promotion_header_id đã tồn tại trong Map
                    if (addedPromotionHeaders.has(promotionHeaderId)) {
                        // So sánh và thay thế nếu discount_value cao hơn khuyến mãi hiện tại
                        const existingPromotion = addedPromotionHeaders.get(promotionHeaderId);
                        if (bestPromotionDetail.discount_value > existingPromotion.discount_value) {
                            percentageDiscount = percentageDiscount - (totalAmount * (existingPromotion.discount_value / 100)) + calculatedPercentageDiscount;

                            // Cập nhật promotion header list và Map với khuyến mãi mới tốt nhất
                            promotionHeader[promotionHeader.indexOf(existingPromotion.promotion_line_id)] = promotion._id;
                            addedPromotionHeaders.set(promotionHeaderId, {
                                ...promotion,
                                promotion_line_id: promotion._id,
                                discount_value: bestPromotionDetail.discount_value,
                                min_order_value: bestPromotionDetail.min_order_value,
                            });
                        }
                    } else {
                        // Nếu promotion_header_id chưa tồn tại, thêm mới khuyến mãi
                        percentageDiscount += calculatedPercentageDiscount;
                        promotionHeader.push(promotion._id);
                        addedPromotionHeaders.set(promotionHeaderId, {
                            ...promotion,
                            promotion_line_id: promotion._id,
                            discount_value: bestPromotionDetail.discount_value,
                            min_order_value: bestPromotionDetail.min_order_value,
                        });
                    }
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
            employee_id: emp._id,
            appointment_id: appointmentId,
            promotion_header_ids: promotionHeader.length !== 0 ? promotionHeader : [],
            total_amount: totalAmount,
            discount_amount: discountAmount || 0,
            final_amount: finalAmount || totalAmount,
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
            .populate('promotion_header_ids')
            .lean();

        // Lấy chi tiết hóa đơn
        const invoiceDetailList = await InvoiceDetail.find({ invoice_id: invoice._id, is_deleted: false })
            .populate('service_id')
            .lean();

        // Gán chi tiết hóa đơn vào đối tượng hóa đơn
        savedInvoice.details = invoiceDetailList;

        // Lấy thông tin PromotionDetail từ tất cả PromotionLine
        if (savedInvoice.promotion_header_ids && savedInvoice.promotion_header_ids.length > 0) {
            const promotionLineIds = savedInvoice.promotion_header_ids.map(line => line._id);

            const promotionDetails = await PromotionDetail.find({
                promotion_line_id: { $in: promotionLineIds },
                is_deleted: false,
            }).lean();

            // Gán các PromotionDetail vào PromotionLine tương ứng
            savedInvoice.promotion_header_ids.forEach(line => {
                line.details = promotionDetails.filter(detail => detail.promotion_line_id.toString() === line._id.toString());
            });
        }

        // Trả về hóa đơn đầy đủ
        res.status(201).json({
            msg: 'Hóa đơn đã được tạo thành công',
            invoice: savedInvoice,
        });

    } catch (err) {
        console.log('Lỗi khi tạo hóa đơn:', err.message);
        res.status(500).send('Lỗi máy chủ thanh toán' + err.message);
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



exports.getInvoiceAndGeneratePDF = async (req, res) => {
    const { invoiceId } = req.params;

    try {
        const savedInvoice = await Invoice.findById(invoiceId)
            .populate('customer_id')
            .populate('employee_id')
            .populate('appointment_id')
            .populate('promotion_header_ids')
            .lean();

        const invoiceDetailList = await InvoiceDetail.find({ invoice_id: invoiceId, is_deleted: false })
            .populate('service_id')
            .lean();
        savedInvoice.details = invoiceDetailList;

        if (savedInvoice.promotion_header_ids && savedInvoice.promotion_header_ids.length > 0) {
            const promotionLineIds = savedInvoice.promotion_header_ids.map(line => line._id);

            const promotionDetails = await PromotionDetail.find({
                promotion_line_id: { $in: promotionLineIds },
                is_deleted: false,
            }).lean();

            savedInvoice.promotion_header_ids.forEach(line => {
                line.details = promotionDetails.filter(detail => detail.promotion_line_id.toString() === line._id.toString());
            });
        }

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

        const fontPath = path.join(__dirname, '../fonts/Roboto-Regular.ttf');
        doc.font(fontPath);

        doc.fontSize(20).text('Hóa đơn thanh toán', { align: 'center' });
        doc.moveDown();
        const customer = savedInvoice.customer_id;
        doc.fontSize(12)
            .text(`Tên khách hàng: ${customer.name}`)
            .text(`Email: ${customer.email}`)
            .text(`Địa chỉ: ${customer.address}`)
            .text(`Số điện thoại: ${customer.phone_number}`)
            .moveDown();

        if (savedInvoice.employee_id) {
            doc.text(`Nhân viên xử lý: ${savedInvoice.employee_id.name}`);
        }
        if (savedInvoice.appointment_id) {
            doc.text(`Thông tin lịch hẹn: ${savedInvoice.appointment_id.appointment_datetime}`)
                .moveDown();
        }

        // Define table width and start position
        const tableWidth = doc.page.width * 0.8;
        const startX = (doc.page.width - tableWidth) / 2;
        const cellPadding = 5;
        const rowHeight = 25;

        // Define column widths as a percentage of tableWidth for the service details table
        const colWidths = [
            tableWidth * 0.4, // Tên dịch vụ
            tableWidth * 0.1, // Số lượng (SL)
            tableWidth * 0.25, // Đơn giá
            tableWidth * 0.25, // Thành tiền
        ];

        // Function to draw a table row for services
        const drawRow = (y, rowData) => {
            const cellData = [rowData.name, rowData.quantity, rowData.unitPrice, rowData.totalPrice];

            let x = startX;
            for (let i = 0; i < cellData.length; i++) {
                const cellWidth = colWidths[i];
                
                // Draw the cell border
                doc.rect(x, y, cellWidth, rowHeight).stroke();

                // Draw the text within the cell
                doc.text(cellData[i], x + cellPadding, y + cellPadding, {
                    width: cellWidth - cellPadding * 2,
                    align: 'center'
                });

                // Move x to the next column start
                x += cellWidth;
            }
        };

        // Draw Service Details Table
        doc.fontSize(14).text('Chi tiết dịch vụ', { underline: true, align: 'center' });
        doc.moveDown();

        // Table starting position
        let currentY = doc.y;

        // Draw headers
        drawRow(currentY, {
            name: 'Tên dịch vụ',
            quantity: 'SL',
            unitPrice: 'Đơn giá',
            totalPrice: 'Thành tiền'
        });

        // Move to the next row position
        currentY += rowHeight;

        // Draw each row for service details
        savedInvoice.details.forEach(detail => {
            drawRow(currentY, {
                name: detail.service_id.name,
                quantity: detail.quantity,
                unitPrice: `${detail.price} VND`,
                totalPrice: `${detail.price * detail.quantity} VND`
            });
            currentY += rowHeight;
        });

        // Promotion Table Column Widths (adjusted to fit text better)
        const promotionColWidths = [
            tableWidth * 0.55, // Tên khuyến mãi (increased to fit longer text)
            tableWidth * 0.2,  // Loại giảm
            tableWidth * 0.25, // Giá trị
        ];

        const drawPromotionRow = (y, rowData) => {
            const cellData = [rowData.name, rowData.discountType, rowData.discountValue];

            let x = startX;
            for (let i = 0; i < cellData.length; i++) {
                const cellWidth = promotionColWidths[i];

                // Draw the cell border
                doc.rect(x, y, cellWidth, rowHeight).stroke();

                // Draw the text within the cell
                doc.text(cellData[i], x + cellPadding, y + cellPadding, {
                    width: cellWidth - cellPadding * 2,
                    align: 'center'
                });

                // Move x to the next column start
                x += cellWidth;
            }
        };

        // Draw Promotion Details Table
        doc.moveDown(1);
        doc.fontSize(14).text('Khuyến mãi', { underline: true, align: 'center' });
        doc.moveDown();

        // Start position for promotions table
        currentY = doc.y;

        // Draw headers for promotion table
        drawPromotionRow(currentY, {
            name: 'Tên khuyến mãi',
            discountType: 'Loại giảm',
            discountValue: 'Giá trị'
        });

        // Move to the next row position
        currentY += rowHeight;

        // Draw each row for promotions
        savedInvoice.promotion_header_ids.forEach(promotion => {
            const discountDetail = promotion.details[0];
            const discountValue = discountDetail.discount_type === 1
                ? `${discountDetail.discount_value}%`
                : `${discountDetail.discount_value} VND`;

            drawPromotionRow(currentY, {
                name: promotion.description,
                discountType: discountDetail.discount_type === 1 ? 'Phần trăm' : 'Trực tiếp',
                discountValue: discountValue
            });

            currentY += rowHeight;
        });

        // Total Summary Section
        doc.moveDown(1)
            .fontSize(12)
            .text(`Tổng tiền: ${savedInvoice.total_amount}VND`, { align: 'right' })
            .text(`Giảm giá: ${savedInvoice.discount_amount}VND`, { align: 'right' })
            .fontSize(14).text(`Thành tiền: ${savedInvoice.final_amount}VND`, { align: 'right', bold: true });

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
        // Lấy lại thông tin hóa đơn đã lưu, bao gồm các thông tin liên quan
        const savedInvoice = await Invoice.findById(invoiceId)
            .populate('customer_id')
            .populate('employee_id')
            .populate('appointment_id')
            .populate('promotion_header_ids')
            .lean();

        if (!savedInvoice || savedInvoice.is_deleted) {
            return res.status(404).json({ msg: 'Không tìm thấy hóa đơn' });
        }

        // Lấy chi tiết hóa đơn
        const invoiceDetailList = await InvoiceDetail.find({ invoice_id: savedInvoice._id, is_deleted: false })
            .populate('service_id')
            .lean();

        // Gán chi tiết hóa đơn vào đối tượng hóa đơn
        savedInvoice.details = invoiceDetailList;

        // Lấy thông tin PromotionDetail từ tất cả PromotionLine
        if (savedInvoice.promotion_header_ids && savedInvoice.promotion_header_ids.length > 0) {
            const promotionLineIds = savedInvoice.promotion_header_ids.map(line => line._id);

            const promotionDetails = await PromotionDetail.find({
                promotion_line_id: { $in: promotionLineIds },
                is_deleted: false,
            }).lean();

            // Gán các PromotionDetail vào PromotionLine tương ứng
            savedInvoice.promotion_header_ids.forEach(line => {
                line.details = promotionDetails.filter(detail => detail.promotion_line_id.toString() === line._id.toString());
            });
        }

        // Trả về hóa đơn đầy đủ
        res.status(200).json({
            msg: 'Hóa đơn đã được lấy thành công',
            invoice: savedInvoice,
        });
    } catch (err) {
        console.error('Lỗi khi lấy thông tin hóa đơn:', err.message);
        res.status(500).send(`Lỗi máy chủ: ${err.message}`);
    }
};