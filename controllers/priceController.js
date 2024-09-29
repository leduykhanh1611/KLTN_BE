const PriceHeader = require('../models/PriceHeader');
const PriceLine = require('../models/PriceLine');
// Thêm bảng giá mới
exports.addPriceHeader = async (req, res) => {
    const { price_list_name, start_date, end_date } = req.body;

    try {
        // Tạo mới bảng giá
        const priceHeader = new PriceHeader({
            price_list_name,
            start_date,
            end_date,
            is_active: true,
            is_deleted: false,
            updated_at: Date.now()
        });

        // Lưu vào cơ sở dữ liệu
        await priceHeader.save();

        res.status(201).json({ msg: 'Bảng giá mới đã được thêm', priceHeader });
    } catch (err) {
        console.error('Lỗi khi thêm bảng giá:', err.message);
        res.status(500).send('Lỗi máy chủ');
    }
};
// Thêm dòng chi tiết giá cho bảng giá
exports.addPriceLine = async (req, res) => {
    const { service_id, vehicle_type_id, price } = req.body;
    const { priceHeaderId } = req.params;

    try {
        // Tạo mới dòng chi tiết giá
        const priceLine = new PriceLine({
            price_header_id: priceHeaderId,
            service_id,
            vehicle_type_id,
            price,
            is_deleted: false,
            updated_at: Date.now()
        });

        // Lưu vào cơ sở dữ liệu
        await priceLine.save();

        res.status(201).json({ msg: 'Chi tiết giá đã được thêm vào bảng giá', priceLine });
    } catch (err) {
        console.error('Lỗi khi thêm chi tiết giá:', err.message);
        res.status(500).send('Lỗi máy chủ');
    }
};
// Lấy tất cả bảng giá
exports.getAllPriceHeaders = async (req, res) => {
    try {
        // Tìm tất cả các bảng giá không bị xóa
        const priceHeaders = await PriceHeader.find({ is_deleted: false });

        res.json(priceHeaders);
    } catch (err) {
        console.error('Lỗi khi lấy danh sách bảng giá:', err.message);
        res.status(500).send('Lỗi máy chủ');
    }
};
// Lấy tất cả chi tiết giá theo bảng giá
exports.getPriceLinesByHeader = async (req, res) => {
    const { priceHeaderId } = req.params;

    try {
        // Tìm tất cả các dòng chi tiết giá của bảng giá không bị xóa
        const priceLines = await PriceLine.find({
            price_header_id: priceHeaderId,
            is_deleted: false
        }).populate('service_id vehicle_type_id');

        res.json(priceLines);
    } catch (err) {
        console.error('Lỗi khi lấy chi tiết giá:', err.message);
        res.status(500).send('Lỗi máy chủ');
    }
};
// Xóa mềm bảng giá
exports.softDeletePriceHeader = async (req, res) => {
    const { priceHeaderId } = req.params;

    try {
        // Tìm bảng giá theo ID
        let priceHeader = await PriceHeader.findById(priceHeaderId);
        if (!priceHeader || priceHeader.is_deleted) {
            return res.status(404).json({ msg: 'Không tìm thấy bảng giá' });
        }

        // Đánh dấu bảng giá đã bị xóa
        priceHeader.is_deleted = true;
        priceHeader.updated_at = Date.now();

        await priceHeader.save();

        res.json({ msg: 'Bảng giá đã được xóa', priceHeader });
    } catch (err) {
        console.error('Lỗi khi xóa bảng giá:', err.message);
        res.status(500).send('Lỗi máy chủ');
    }
};
