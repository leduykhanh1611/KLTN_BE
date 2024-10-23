// controllers/promotionController.js

const PromotionHeader = require('../models/PromotionHeader');
const PromotionLine = require('../models/PromotionLine');
const PromotionDetail = require('../models/PromotionDetail');
// Thêm chương trình khuyến mãi mới 
exports.addPromotionHeader = async (req, res) => {
    const { promotion_code, name, description,start_date, end_date } = req.body;
    if (start_date >= end_date) {
        return res.status(400).json({ msg: 'Ngày kết thúc phải sau ngày bắt đầu' });
    }
    if (start_date <= Date.now()) {
        return res.status(400).json({ msg: 'Ngày bắt đầu phải sau ngày hiện tại' });
    }
    if (end_date <= Date.now()) {
        return res.status(400).json({ msg: 'Ngày kết thúc phải sau ngày hiện tại' });
    }
    try {
        // Kiểm tra xem mã khuyến mãi đã tồn tại chưa
        let existingPromotion = await PromotionHeader.findOne({ promotion_code });
        if (existingPromotion) {
            return res.status(400).json({ msg: 'Mã khuyến mãi đã tồn tại' });
        }

        // Tạo mới chương trình khuyến mãi
        const promotionHeader = new PromotionHeader({
            promotion_code,
            name,
            description,
            start_date,
            end_date,
            created_at: Date.now(),
            updated_at: Date.now()
        });

        // Lưu vào cơ sở dữ liệu
        await promotionHeader.save();

        res.status(201).json({ msg: 'Chương trình khuyến mãi mới đã được thêm', promotionHeader });
    } catch (err) {
        console.error('Lỗi khi thêm chương trình khuyến mãi:', err.message);
        res.status(500).send('Lỗi máy chủ');
    }
};
// Thêm chi tiết khuyến mãi vào chương trình khuyến mãi
exports.addPromotionLine = async (req, res) => {
    const { discount_type, start_date, end_date, description } = req.body;
    const { promotionHeaderId } = req.params;
    if(start_date >= end_date){
        return res.status(400).json({ msg: 'Ngày kết thuc phải sau ngày bắt đầu' });
    }
    if(start_date <= Date.now()){
        return res.status(400).json({ msg: 'Ngày bắt đầu phải sau ngày hiện tại' });
    }
    if(end_date <= Date.now()){
        return res.status(400).json({ msg: 'Ngày kết thúc phải sau ngày hiện tại' });
    }
    try {
        // Tạo mới dòng chi tiết khuyến mãi
        const promotionLine = new PromotionLine({
            promotion_header_id: promotionHeaderId,
            discount_type,
            description,
            start_date,
            end_date,
            is_deleted: false,
            updated_at: Date.now()
        });

        // Lưu vào cơ sở dữ liệu
        await promotionLine.save();

        res.status(201).json({ msg: 'Chi tiết khuyến mãi đã được thêm vào chương trình khuyến mãi', promotionLine });
    } catch (err) {
        console.error('Lỗi khi thêm chi tiết khuyến mãi:', err.message);
        res.status(500).send('Lỗi máy chủ');
    }
};
// Thêm chi tiết khuyến mãi cho dòng khuyến mãi
exports.addPromotionDetail = async (req, res) => {
    const { promotionLineId } = req.params;
    const { vehicle_type_id, service_id, applicable_rank_id, discount_value, min_order_value } = req.body;

    try {
        const promotionDetail = new PromotionDetail({
            promotion_line_id: promotionLineId,
            vehicle_type_id,
            service_id,
            applicable_rank_id,
            discount_value,
            min_order_value,
        });

        await promotionDetail.save();
        res.status(201).json({ msg: 'Chi tiết khuyến mãi đã được thêm', promotionDetail });
    } catch (err) {
        console.error('Lỗi khi thêm chi tiết khuyến mãi:', err.message);
        res.status(500).send('Lỗi máy chủ');
    }
};
//dùng cái này
// Lấy tất cả hearder chương trình khuyến mãi
exports.getAllPromotions = async (req, res) => {
    try {
        // Tìm tất cả các chương trình khuyến mãi không bị xóa
        const promotions = await PromotionHeader.find({ is_deleted: false  });

        res.json(promotions);
    } catch (err) {
        console.error('Lỗi khi lấy danh sách chương trình khuyến mãi:', err.message);
        res.status(500).send('Lỗi máy chủ');
    }
};

// Lấy tất cả line khuyến mãi theo chương trình khuyến mãi
exports.getPromotionLinesByHeader = async (req, res) => {
    const { promotionHeaderId } = req.params;

    try {
        // Tìm tất cả các dòng chi tiết khuyến mãi của chương trình khuyến mãi không bị xóa
        const promotionLines = await PromotionLine.find({
            promotion_header_id: promotionHeaderId,
            is_deleted: false
        });

        res.json(promotionLines);
    } catch (err) {
        console.error('Lỗi khi lấy chi tiết khuyến mãi:', err.message);
        res.status(500).send('Lỗi máy chủ');
    }
};

// Xóa mềm chương trình khuyến mãi
exports.softDeletePromotionHeader = async (req, res) => {
    const { promotionHeaderId } = req.params;

    try {
        // Tìm chương trình khuyến mãi theo ID
        let promotionHeader = await PromotionHeader.findById(promotionHeaderId);
        if (!promotionHeader || promotionHeader.is_deleted) {
            return res.status(404).json({ msg: 'Không tìm thấy chương trình khuyến mãi' });
        }

        // Đánh dấu chương trình khuyến mãi đã bị xóa
        promotionHeader.is_deleted = true;
        promotionHeader.updated_at = Date.now();

        await promotionHeader.save();

        res.json({ msg: 'Chương trình khuyến mãi đã được xóa', promotionHeader });
    } catch (err) {
        console.error('Lỗi khi xóa chương trình khuyến mãi:', err.message);
        res.status(500).send('Lỗi máy chủ');
    }
};

// Cập nhật thông tin hearder chương trình khuyến mãi
exports.updatePromotionHeader = async (req, res) => {
    const { promotionHeaderId } = req.params;
    const { name, description, is_active, start_date, end_date } = req.body;

    try {
        let promotionHeader = await PromotionHeader.findById(promotionHeaderId);
        if (!promotionHeader || promotionHeader.is_deleted) {
            return res.status(404).json({ msg: 'Không tìm thấy chương trình khuyến mãi' });
        }

        if (name) promotionHeader.name = name;
        if (description) promotionHeader.description = description;
        if (is_active) promotionHeader.is_active = is_active;
        if (start_date) promotionHeader.start_date = start_date;
        if (end_date) promotionHeader.end_date = end_date;

        promotionHeader.updated_at = Date.now();
        await promotionHeader.save();

        res.json({ msg: 'Cập nhật chương trình khuyến mãi thành công', promotionHeader });
    } catch (err) {
        console.error('Lỗi khi cập nhật chương trình khuyến mãi:', err.message);
        res.status(500).send('Lỗi máy chủ');
    }
};

// Cập nhật thông tin chi tiết dòng khuyến mãi
exports.updatePromotionLine = async (req, res) => {
    const { promotionLineId } = req.params;
    const { discount_type, description, is_active, start_date, end_date } = req.body;

    try {
        let promotionLine = await PromotionLine.findById(promotionLineId);
        if (!promotionLine || promotionLine.is_deleted) {
            return res.status(404).json({ msg: 'Không tìm thấy dòng khuyến mãi' });
        }

        if (discount_type) promotionLine.discount_type = discount_type;
        if (description) promotionLine.description = description;
        if (is_active) promotionLine.is_active = is_active;
        if (start_date) promotionLine.start_date = start_date;
        if (end_date) promotionLine.end_date = end_date;

        promotionLine.updated_at = Date.now();
        await promotionLine.save();

        res.json({ msg: 'Cập nhật khuyến mãi thành công', promotionLine });
    } catch (err) {
        console.error('Lỗi khi cập nhật dòng khuyến mãi:', err.message);
        res.status(500).send('Lỗi máy chủ');
    }
};

// Lấy thông tin chi tiết chương trình khuyến mãi
exports.getPromotionHeaderDetails = async (req, res) => {
    const { promotionHeaderId } = req.params;

    try {
        const promotionHeader = await PromotionHeader.findById(promotionHeaderId).populate('applicable_rank_id');
        if (!promotionHeader || promotionHeader.is_deleted) {
            return res.status(404).json({ msg: 'Không tìm thấy chương trình khuyến mãi' });
        }

        const promotionLines = await PromotionLine.find({ promotion_header_id: promotionHeaderId, is_deleted: false });

        res.json({ promotionHeader, promotionLines });
    } catch (err) {
        console.error('Lỗi khi lấy thông tin chương trình khuyến mãi:', err.message);
        res.status(500).send('Lỗi máy chủ');
    }
};

// Lấy tất cả chi tiết dòng khuyến mãi
exports.getPromotionDetailsByLine = async (req, res) => {
    const { promotionLineId } = req.params;

    try {
        const promotionDetails = await PromotionDetail.find({ promotion_line_id: promotionLineId, is_deleted: false }).populate('applicable_rank_id service_id');

        res.json(promotionDetails);
    } catch (err) {
        console.error('Lỗi khi lấy chi tiết dòng khuyến mãi:', err.message);
        res.status(500).send('Lỗi máy chủ');
    }
};

// Kiểm tra tính hợp lệ của khuyến mãi
exports.validatePromotion = async (req, res) => {
    const { promotion_code, customer_rank_id, order_value } = req.body;

    try {
        // Kiểm tra chương trình khuyến mãi có tồn tại và đang hoạt động không
        const promotionHeader = await PromotionHeader.findOne({
            promotion_code,
            applicable_rank_id: customer_rank_id,
            is_deleted: false,
            is_active: true,
        });

        if (!promotionHeader) {
            return res.status(404).json({ msg: 'Khuyến mãi không hợp lệ hoặc không áp dụng cho loại khách hàng này' });
        }

        // Kiểm tra dòng khuyến mãi hợp lệ
        const promotionLine = await PromotionLine.findOne({
            promotion_header_id: promotionHeader._id,
            min_order_value: { $lte: order_value },
            start_date: { $lte: new Date() },
            end_date: { $gte: new Date() },
            is_deleted: false,
        });

        if (!promotionLine) {
            return res.status(400).json({ msg: 'Không có dòng khuyến mãi phù hợp với giá trị đơn hàng' });
        }

        res.json({ msg: 'Khuyến mãi hợp lệ', discount: promotionLine.discount_value });
    } catch (err) {
        console.error('Lỗi khi kiểm tra khuyến mãi:', err.message);
        res.status(500).send('Lỗi máy chủ');
    }
};

// Xóa mềm dòng khuyến mãi
exports.softDeletePromotionLine = async (req, res) => {
    const { promotionLineId } = req.params;

    try {
        let promotionLine = await PromotionLine.findById(promotionLineId);
        if (!promotionLine || promotionLine.is_deleted) {
            return res.status(404).json({ msg: 'Không tìm thấy dòng khuyến mãi' });
        }

        promotionLine.is_deleted = true;
        promotionLine.updated_at = Date.now();

        await promotionLine.save();
        res.json({ msg: 'Dòng khuyến mãi đã được xóa', promotionLine });
    } catch (err) {
        console.error('Lỗi khi xóa dòng khuyến mãi:', err.message);
        res.status(500).send('Lỗi máy chủ');
    }
};

// Tìm kiếm và lọc chương trình khuyến mãi
exports.searchPromotions = async (req, res) => {
    const { promotion_code, is_active,  start_date, end_date } = req.query;

    let query = { is_deleted: false };

    if (promotion_code) {
        query.promotion_code = { $regex: promotion_code, $options: 'i' };
    }
    if (is_active !== undefined) {
        query.is_active = is_active === 'true';
    }
    if (start_date && end_date) {
        query.start_date = { $gte: new Date(start_date) };
        query.end_date = { $lte: new Date(end_date) };
    }

    try {
        const promotions = await PromotionHeader.find(query);
        res.json(promotions);
    } catch (err) {
        console.error('Lỗi khi tìm kiếm chương trình khuyến mãi:', err.message);
        res.status(500).send('Lỗi máy chủ');
    }
};

// Lấy danh sách chương trình khuyến mãi khả dụng cho khách hàng hiện tại
exports.getAvailablePromotionsForCustomer = async (req, res) => {
    const { customer_rank_id, order_value } = req.query; // Giả định rằng thông tin khách hàng và giá trị đơn hàng được gửi kèm

    try {
        const promotions = await PromotionLine.find({
            min_order_value: { $lte: order_value },
            start_date: { $lte: new Date() },
            end_date: { $gte: new Date() },
            is_deleted: false,
        })
            .populate({
                path: 'promotion_header_id',
                match: {
                    applicable_rank_id: customer_rank_id,
                    is_active: true,
                    is_deleted: false,
                },
            })
            .exec();

        const validPromotions = promotions.filter((p) => p.promotion_header_id !== null);
        res.json(validPromotions);
    } catch (err) {
        console.error('Lỗi khi lấy chương trình khuyến mãi:', err.message);
        res.status(500).send('Lỗi máy chủ');
    }
};

// Kích hoạt hoặc ngừng kích hoạt chương trình khuyến mãi
exports.toggleActivePromotion = async (req, res) => {
    const { promotionHeaderId } = req.params;

    try {
        let promotionHeader = await PromotionHeader.findById(promotionHeaderId);
        if (!promotionHeader || promotionHeader.is_deleted) {
            return res.status(404).json({ msg: 'Không tìm thấy chương trình khuyến mãi' });
        }

        promotionHeader.is_active = !promotionHeader.is_active;
        promotionHeader.updated_at = Date.now();

        await promotionHeader.save();
        res.json({ msg: 'Trạng thái của chương trình khuyến mãi đã được thay đổi', promotionHeader });
    } catch (err) {
        console.error('Lỗi khi thay đổi trạng thái của chương trình khuyến mãi:', err.message);
        res.status(500).send('Lỗi máy chủ');
    }
};

// Lấy danh sách khách hàng đã sử dụng chương trình khuyến mãi
exports.getCustomersByPromotion = async (req, res) => {
    const { promotionHeaderId } = req.params;

    try {
        const invoices = await Invoice.find({ promotion_header_id: promotionHeaderId }).populate('customer_id');
        const customers = invoices.map((invoice) => invoice.customer_id);

        res.json(customers);
    } catch (err) {
        console.error('Lỗi khi lấy danh sách khách hàng đã sử dụng khuyến mãi:', err.message);
        res.status(500).send('Lỗi máy chủ');
    }
};

// Cập nhật chi tiết khuyến mãi
exports.updatePromotionDetail = async (req, res) => {
    const { promotionDetailId } = req.params;
    const { applicable_rank_id, service_id, discount_value, min_order_value, is_active  } = req.body;

    try {
        // Tìm chi tiết khuyến mãi theo ID
        let promotionDetail = await PromotionDetail.findById(promotionDetailId);
        if (!promotionDetail || promotionDetail.is_deleted) {
            return res.status(404).json({ msg: 'Không tìm thấy chi tiết khuyến mãi' });
        }

        // Cập nhật thông tin nếu có
        if (applicable_rank_id) promotionDetail.applicable_rank_id = applicable_rank_id;
        if (service_id) promotionDetail.service_id = service_id;
        if (discount_value) promotionDetail.discount_value = discount_value;
        if (min_order_value) promotionDetail.min_order_value = min_order_value;
        if (is_active !== undefined) promotionDetail.is_active = is_active;

        promotionDetail.updated_at = Date.now();

        // Lưu lại thay đổi
        await promotionDetail.save();

        res.json({ msg: 'Cập nhật chi tiết khuyến mãi thành công', promotionDetail });
    } catch (err) {
        console.error('Lỗi khi cập nhật chi tiết khuyến mãi:', err.message);
        res.status(500).send('Lỗi máy chủ');
    }
};

// Xóa mềm chi tiết khuyến mãi
exports.softDeletePromotionDetail = async (req, res) => {
    const { promotionDetailId } = req.params;

    try {
        // Tìm chi tiết khuyến mãi theo ID
        let promotionDetail = await PromotionDetail.findById(promotionDetailId);
        if (!promotionDetail || promotionDetail.is_deleted) {
            return res.status(404).json({ msg: 'Không tìm thấy chi tiết khuyến mãi' });
        }

        // Đánh dấu chi tiết khuyến mãi là đã xóa
        promotionDetail.is_deleted = true;
        promotionDetail.updated_at = Date.now();

        // Lưu lại thay đổi
        await promotionDetail.save();

        res.json({ msg: 'Chi tiết khuyến mãi đã được xóa mềm', promotionDetail });
    } catch (err) {
        console.error('Lỗi khi xóa chi tiết khuyến mãi:', err.message);
        res.status(500).send('Lỗi máy chủ');
    }
};
// dùng cái này
// Lấy thông tin chương trình khuyến mãi với các line và detail
exports.getPromotionWithDetails = async (req, res) => {
    const { promotionHeaderId } = req.params;

    try {
        // Tìm chương trình khuyến mãi (PromotionHeader) theo ID
        const promotionHeader = await PromotionHeader.findById(promotionHeaderId).where({ is_deleted: false });
        
        if (!promotionHeader) {
            return res.status(404).json({ msg: 'Không tìm thấy chương trình khuyến mãi' });
        }

        // Tìm tất cả các line (PromotionLine) thuộc chương trình khuyến mãi
        const promotionLines = await PromotionLine.find({ promotion_header_id: promotionHeaderId, is_deleted: false });

        // Tìm tất cả các detail (PromotionDetail) thuộc các line tìm được
        const promotionDetails = await PromotionDetail.find({
            promotion_line_id: { $in: promotionLines.map(line => line._id) },
            is_deleted: false
        });

        // Tạo kết quả để trả về
        const result = {
            promotionHeader,
            promotionLines: promotionLines.map(line => ({
                ...line._doc,
                promotionDetails: promotionDetails.filter(detail => detail.promotion_line_id.toString() === line._id.toString())
            }))
        };

        res.json(result);
    } catch (err) {
        console.error('Lỗi khi lấy thông tin chương trình khuyến mãi:', err.message);
        res.status(500).send('Lỗi máy chủ');
    }
};
