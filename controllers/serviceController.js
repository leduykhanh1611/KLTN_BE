const Service = require('../models/Service');
const PriceHeader = require('../models/PriceHeader');
const PriceLine = require('../models/PriceLine');

// Thêm dịch vụ mới
exports.addService = async (req, res) => {
    const { service_code, name, description, time_required } = req.body;

    try {
        // Kiểm tra xem service_code đã tồn tại chưa
        let existingService = await Service.findOne({ service_code });
        if (existingService) {
            return res.status(400).json({ msg: 'Mã dịch vụ đã tồn tại' });
        }

        // Tạo mới dịch vụ
        const service = new Service({
            service_code,
            name,
            description,
            time_required,
            is_deleted: false,
            updated_at: Date.now()
        });

        // Lưu dịch vụ vào cơ sở dữ liệu
        await service.save();

        res.status(201).json({ msg: 'Dịch vụ mới đã được thêm', service });
    } catch (err) {
        console.error('Lỗi khi thêm dịch vụ:', err.message);
        res.status(500).send('Lỗi máy chủ');
    }
};
// Lấy tất cả dịch vụ
exports.getAllServices = async (req, res) => {
    try {
        // Tìm tất cả dịch vụ không bị xóa
        const services = await Service.find({ is_deleted: false });

        res.json(services);
    } catch (err) {
        console.error('Lỗi khi lấy danh sách dịch vụ:', err.message);
        res.status(500).send('Lỗi máy chủ');
    }
};
// Lấy chi tiết dịch vụ
exports.getServiceById = async (req, res) => {
    const { serviceId } = req.params;

    try {
        // Tìm dịch vụ theo ID và kiểm tra xem nó có bị xóa không
        const service = await Service.findOne({ _id: serviceId, is_deleted: false });
        if (!service) {
            return res.status(404).json({ msg: 'Không tìm thấy dịch vụ' });
        }

        res.json(service);
    } catch (err) {
        console.error('Lỗi khi lấy chi tiết dịch vụ:', err.message);
        res.status(500).send('Lỗi máy chủ');
    }
};
// Cập nhật dịch vụ
exports.updateService = async (req, res) => {
    const { service_code, name, description, time_required } = req.body;
    const { serviceId } = req.params;
    const priceline = await PriceLine.find({ service_id: serviceId, is_deleted: false });
    if (priceline.length > 0) {
        return res.status(400).json({ msg: 'Dịch vụ này đang được sử dụng trong bảng giá. Không được cập nhật' });
    }
    try {
        // Tìm dịch vụ theo ID
        let service = await Service.findById(serviceId);
        if (!service || service.is_deleted) {
            return res.status(404).json({ msg: 'Không tìm thấy dịch vụ' });
        }

        // Cập nhật thông tin dịch vụ
        if (service_code) service.service_code = service_code;
        if (name) service.name = name;
        if (description) service.description = description;
        if (time_required) service.time_required = time_required;

        service.updated_at = Date.now();

        await service.save();

        res.json({ msg: 'Cập nhật dịch vụ thành công', service });
    } catch (err) {
        console.error('Lỗi khi cập nhật dịch vụ:', err.message);
        res.status(500).send('Lỗi máy chủ');
    }
};
// Xóa mềm dịch vụ (soft delete)
exports.softDeleteService = async (req, res) => {
    const { serviceId } = req.params;
    let priceline = await PriceLine.find({ service_id: serviceId, is_deleted: false });
    if (priceline.length > 0) {
        return res.status(400).json({ msg: 'Dịch vụ này đang được sử dụng trong bảng giá' });
    }
    try {
        // Tìm dịch vụ theo ID
        let service = await Service.findById(serviceId);
        if (!service || service.is_deleted) {
            return res.status(404).json({ msg: 'Không tìm thấy dịch vụ' });
        }
        let priceHeader = await PriceHeader.findOne({ service_id: serviceId, is_deleted: false, is_active: true });
        if (priceHeader) {
            return res.status(400).json({ msg: 'Dịch vụ này đang được sử dụng trong bảng giá: '+priceHeader.price_list_name });
        }
        // Đánh dấu dịch vụ đã bị xóa
        service.is_deleted = true;
        service.updated_at = Date.now();

        await service.save();

        res.json({ msg: 'Dịch vụ đã được đánh dấu là đã xóa', service });
    } catch (err) {
        console.error('Lỗi khi xóa mềm dịch vụ:', err.message);
        res.status(500).send('Lỗi máy chủ');
    }
};
