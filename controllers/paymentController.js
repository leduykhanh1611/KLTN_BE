const Appointment = require('../models/Appointment');
const AppointmentService = require('../models/AppointmentService');
const PriceLine = require('../models/PriceLine');
const Invoice = require('../models/Invoice');
const InvoiceDetail = require('../models/InvoiceDetail');
const PromotionHeader = require('../models/PromotionHeader');
const CustomerRank = require('../models/CustomerRank');
const PayOS = require('@payos/node');

// Khởi tạo PayOS với thông tin xác thực
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
    //   const invoice = await Invoice.findById(invoiceId).populate('customer_id');
    //   if (!invoice || invoice.is_deleted || invoice.status !== 'pending') {
    //     return res.status(404).json({ msg: 'Không tìm thấy hóa đơn hợp lệ' });
    //   }
  
    //   // Lấy chi tiết hóa đơn
    //   const invoiceDetails = await InvoiceDetail.find({
    //     invoice_id: invoiceId,
    //     is_deleted: false,
    //   }).populate('service_id');
  
      // Tạo liên kết thanh toán bằng PayOS
      const paymentBody = {
        orderCode: 12345,
        amount: 12345,
        description: 'Thanh toán hóa đơn',
        items: [
            {
              name: "Mi tom hao hao",
              quantity: 1,
              price: 2000,
            },
          ],
        cancelUrl: 'http://localhost:3000/cancel.html',
        returnUrl: 'http://localhost:3000/success.html',
      };
  
      const paymentLinkRes = await payOS.createPaymentLink(paymentBody);
  
      res.status(200).json({ msg: 'Liên kết thanh toán đã được tạo thành công', paymentLink: paymentLinkRes });
    } catch (err) {
      console.error('Lỗi khi tạo liên kết thanh toán:', err.message);
      res.status(500).send('Lỗi máy chủ'+err.message);
    }
  };
  
// Xuất hóa đơn thanh toán cho khách hàng
exports.generateInvoice = async (req, res) => {
    const { appointmentId } = req.params;

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
        }).populate('service_id');

        if (appointmentServices.length === 0) {
            return res.status(400).json({ msg: 'Không có dịch vụ nào liên quan đến lịch hẹn' });
        }

        // Tính toán tổng phí dựa trên bảng giá
        let totalAmount = 0;
        const invoiceDetails = [];

        for (let appService of appointmentServices) {
            // Tìm giá của dịch vụ tương ứng với loại xe trong lịch hẹn
            const priceLine = await PriceLine.findOne({
                service_id: appService.service_id._id,
                vehicle_type_id: appointment.vehicle_id.vehicle_type_id,
                is_deleted: false,
            });

            if (!priceLine) {
                return res.status(400).json({ msg: `Không tìm thấy bảng giá cho dịch vụ: ${appService.service_id.name}` });
            }

            totalAmount += priceLine.price;

            // Thêm chi tiết hóa đơn
            invoiceDetails.push({
                service_id: appService.service_id._id,
                price: priceLine.price,
                quantity: 1,
            });
        }

        // Tự động áp dụng khuyến mãi nếu có
        let discountAmount = 0;
        let fixedDiscount = 0;
        let percentageDiscount = 0;
        let promotionHeader = null;

        // Kiểm tra các chương trình khuyến mãi áp dụng cho khách hàng
        const activePromotions = await PromotionHeader.find({
            is_active: true,
            is_deleted: false,
            start_date: { $lte: today },
            end_date: { $gte: today },
        });

        // Áp dụng cả khuyến mãi cố định và khuyến mãi theo phần trăm nếu có
        for (let promotion of activePromotions) {
            // Áp dụng khuyến mãi nếu khách hàng đủ điều kiện (ví dụ: hạng khách hàng phù hợp)
            if (!promotion.applicable_rank_id || promotion.applicable_rank_id.equals(appointment.customer_id.customer_rank_id)) {
                if (promotion.discount_type === 'fixed' && promotion.discount_value <= totalAmount) {
                    if (promotion.discount_value > fixedDiscount) {
                        fixedDiscount = promotion.discount_value;
                        promotionHeader = promotion;
                    }
                } else if (promotion.discount_type === 'percentage') {
                    const calculatedPercentageDiscount = totalAmount * (promotion.discount_value / 100);
                    if (calculatedPercentageDiscount > percentageDiscount) {
                        percentageDiscount = calculatedPercentageDiscount;
                        promotionHeader = promotion;
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
            employee_id: null, // Sẽ cập nhật sau nếu cần
            appointment_id: appointmentId,
            promotion_header_id: promotionHeader ? promotionHeader._id : null, // Gán khuyến mãi nếu có
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

        res.status(201).json({ msg: 'Hóa đơn đã được tạo thành công', invoice });
    } catch (err) {
        console.error('Lỗi khi tạo hóa đơn:', err.message);
        res.status(500).send('Lỗi máy chủ');
    }
};
