const PriceHeader = require('../models/PriceHeader');
const PriceLine = require('../models/PriceLine');
const Service = require('../models/Service');
const VehicleType = require('../models/VehicleType');
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
        if (priceHeader.start_date <= Date.now() && priceHeader.end_date >= Date.now()) {
            priceHeader.is_active = false;
            priceHeader.updated_at = Date.now();
            priceHeader.end_date = Date.now();
            priceHeader.is_deleted = true;
            await priceHeader.save();
        } else {
            // Đánh dấu bảng giá đã bị xóa
            priceHeader.is_active = false;
            priceHeader.is_deleted = true;
            priceHeader.updated_at = Date.now();

            await priceHeader.save();
        }
        // Lấy tất cả các dòng chi tiết giá của bảng giá để xóa mềm
        let priceLines = await PriceLine.find({ price_header_id: priceHeaderId, is_deleted: false });
        // Đánh dấu các dòng chi tiết giá đã bị xóa
        for (let priceLine of priceLines) {
            priceLine.is_deleted = true;
            priceLine.updated_at = Date.now();
            await priceLine.save();
        }

        res.json({ msg: 'Bảng giá đã được xóa', priceHeader });
    } catch (err) {
        console.error('Lỗi khi xóa bảng giá:', err.message);
        res.status(500).send('Lỗi máy chủ');
    }
};
// API để lấy giá của dịch vụ theo tên dịch vụ và loại xe (tìm kiếm gần đúng)
exports.getPriceByServiceAndVehicle = async (req, res) => {
  const { serviceName, vehicleTypeName } = req.query;

  try {
    let service = null;
    let vehicleType = null;

    // Tìm dịch vụ theo tên gần đúng nếu có
    if (serviceName) {
      service = await Service.findOne({
        name: { $regex: serviceName, $options: 'i' }, // Tìm kiếm gần đúng, không phân biệt hoa thường
        is_deleted: false,
      });
      // if (!service) {
      //   return res.status(404).json({ msg: 'Không tìm thấy dịch vụ' });
      // }
    }

    // Tìm loại xe theo tên gần đúng nếu có
    if (vehicleTypeName) {
      vehicleType = await VehicleType.findOne({
        name: { $regex: vehicleTypeName, $options: 'i' }, // Tìm kiếm gần đúng, không phân biệt hoa thường
        is_deleted: false,
      });
      // if (!vehicleType) {
      //   return res.status(404).json({ msg: 'Không tìm thấy loại xe' });
      // }
    }

    // Tìm giá của dịch vụ cho loại xe nếu có cả hai thông tin
    let priceLines;
    if (service && vehicleType) {
      priceLines = await PriceLine.find({
        service_id: service._id,
        vehicle_type_id: vehicleType._id,
        is_deleted: false,
      }).populate('service_id vehicle_type_id');
    } else if (!service && vehicleType) {
      // Nếu chỉ có thông tin loại xe
      priceLines = await PriceLine.find({
        vehicle_type_id: vehicleType._id,
        is_deleted: false,
      }).populate('service_id vehicle_type_id');
    } else if (service && !vehicleType) {
      // Nếu chỉ có thông tin dịch vụ
      priceLines = await PriceLine.find({
        service_id: service._id,
        is_deleted: false,
      }).populate('service_id vehicle_type_id');
    } else {
      // Nếu không có tham số nào truyền vào, lấy tất cả
      priceLines = await PriceLine.find({ is_deleted: false }).populate('service_id vehicle_type_id');
    }

    if (priceLines.length === 0) {
      return res.status(404).json({ msg: 'Không tìm thấy giá cho dịch vụ và loại xe này' });
    }

    res.status(200).json(priceLines.map(priceLine => ({
      priceline_id: priceLine._id,
      service: priceLine.service_id.name,
      vehicle_type: priceLine.vehicle_type_id.vehicle_type_name,
      price: priceLine.price,
    })));
  } catch (err) {
    console.error('Lỗi khi lấy giá của dịch vụ:', err.message);
    res.status(500).send('Lỗi máy chủ');
  }
};
