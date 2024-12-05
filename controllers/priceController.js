const { cp } = require('fs');
const PriceHeader = require('../models/PriceHeader');
const PriceLine = require('../models/PriceLine');
const Service = require('../models/Service');
const VehicleType = require('../models/VehicleType');
const AppointmentService = require('../models/AppointmentService');
// Thêm bảng giá mới
exports.addPriceHeader = async (req, res) => {
  const { price_list_name, start_date, end_date } = req.body;

  try {

    if (start_date >= end_date) {
      return res.status(400).json({ msg: 'Ngày kết thúc phải sau ngày bắt đầu' });  
    }
    if (start_date <= Date.now()) {
      return res.status(400).json({ msg: 'Ngày bắt đầu phải sau ngày hiện tại' });
    }
    if (end_date <= Date.now()) {
      return res.status(400).json({ msg: 'Ngày kết thúc phải sau ngày hiện tại' });
    }
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
  if (!service_id || !vehicle_type_id) {
    return res.status(400).json({ msg: 'Dịch vụ và loại xe không được để trống' });
  }
  if (!price) {
    return res.status(400).json({ msg: 'Giá không được để trống' });
  }
  if (price <= 0) {
    return res.status(400).json({ msg: 'Giá không hợp lệ' });
  }
  const priceHeader = await PriceHeader.findById(priceHeaderId);
  if (!priceHeader || priceHeader.is_deleted) {
    return res.status(404).json({ msg: 'Không tìm thấy bảng giá' });
  }
  if ( priceHeader.end_date <= Date.now()) {
    return res.status(400).json({ msg: 'Bảng giá đã hết hạn' });
  }
  const priceLine = await PriceLine.findOne({service_id: service_id,vehicle_type_id: vehicle_type_id, is_active: true, is_deleted: false});
  if (priceLine) {
    return res.status(400).json({ msg: 'Giá của dịch vụ cho loại xe trên đã tồn tại' });
  }
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
    let priceHeader = await PriceHeader.findById(priceHeaderId, { is_deleted: false });
    if (!priceHeader || priceHeader.is_deleted) {
      return res.status(404).json({ msg: 'Không tìm thấy bảng giá' });
    }
    let priceLines = await PriceLine.find({ price_header_id: priceHeaderId, is_deleted: false });
    if (priceLines.length > 0) {
      return res.status(400).json({ msg: 'Bảng giá đã có giá cho dịch vụ. Không thể xóa' });
      
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
    
    // Đánh dấu các dòng chi tiết giá đã bị xóa
    // for (let priceLine of priceLines) {
    //   priceLine.is_deleted = true;
    //   priceLine.updated_at = Date.now();
    //   await priceLine.save();
    // }

    res.json({ msg: 'Bảng giá đã được xóa', priceHeader });
  } catch (err) {
    console.error('Lỗi khi xóa bảng giá:', err.message);
    res.status(500).send('Lỗi máy chủ');
  }
};
// API để lấy giá của dịch vụ theo tên dịch vụ và loại xe (tìm kiếm gần đúng)
exports.getPriceByServiceAndVehicle = async (req, res) => {
  const { serviceName, vehicleTypeName } = req.query;
  let service = null;
  let vehicleType = null;
  try {
    // Tìm dịch vụ theo tên gần đúng nếu có
    if (serviceName) {
      service = await Service.findOne({
        service_code: { $regex: serviceName, $options: 'i' }, // 'i' để tìm kiếm không phân biệt chữ hoa chữ thường
        is_deleted: false,
      });
    }

    // Tìm loại xe theo tên gần đúng nếu có
    if (vehicleTypeName) {
      vehicleType = await VehicleType.findOne({
        vehicle_type_name: { $regex: vehicleTypeName, $options: 'i' }, // Tìm kiếm gần đúng, không phân biệt hoa thường
        is_deleted: false,
      });
      
    }
    const today = new Date(); // Lấy ngày hiện tại
    // Tìm giá của dịch vụ cho loại xe nếu có cả hai thông tin
    let priceLines;
    if (service && vehicleType) {
      priceLines = await PriceLine.find({
        service_id: service._id,
        vehicle_type_id: vehicleType._id,
        is_deleted: false,
        is_active: true, // Lọc PriceLine có is_active là true
      }).populate({
        path: 'price_header_id',
        match: { is_active: true, is_deleted: false,  start_date: { $lte: today }, end_date: { $gte: today }  }, // Lọc PriceHeader có is_active là true ngày hiện tại nằm trong khoảng giữa của startdate và enddate
      }).populate('service_id vehicle_type_id');
      priceLines = priceLines.filter(line => line.price_header_id !== null); // Loại bỏ các PriceLine không có PriceHeader phù hợp
    } else if (!service && vehicleType) {
      // Nếu chỉ có thông tin loại xe
      priceLines = await PriceLine.find({
        vehicle_type_id: vehicleType._id,
        is_deleted: false,
        is_active: true, // Lọc PriceLine có is_active là true
      }).populate({
        path: 'price_header_id',
        match: { is_active: true, is_deleted: false,  start_date: { $lte: today }, end_date: { $gte: today } }, // Lọc PriceHeader có is_active là true
      }).populate('service_id vehicle_type_id');
      priceLines = priceLines.filter(line => line.price_header_id !== null); // Loại bỏ các PriceLine không có PriceHeader phù hợp
    } else if (service && !vehicleType) {
      // Nếu chỉ có thông tin dịch vụ
      priceLines = await PriceLine.find({
        service_id: service._id,
        is_deleted: false,
        is_active: true, // Lọc PriceLine có is_active là true
      }).populate({
        path: 'price_header_id',
        match: { is_active: true, is_deleted: false,  start_date: { $lte: today }, end_date: { $gte: today } }, // Lọc PriceHeader có is_active là true
      }).populate('service_id vehicle_type_id');
      priceLines = priceLines.filter(line => line.price_header_id !== null); // Loại bỏ các PriceLine không có PriceHeader phù hợp
    } else {
      // Nếu không có tham số nào truyền vào, lấy tất cả
      priceLines = await PriceLine.find({ is_deleted: false, is_active: true }).populate({
        path: 'price_header_id',
        match: { is_active: true, is_deleted: false,  start_date: { $lte: today }, end_date: { $gte: today } }, // Lọc PriceHeader có is_active là true
      }).populate('service_id vehicle_type_id');
      priceLines = priceLines.filter(line => line.price_header_id !== null); // Loại bỏ các PriceLine không có PriceHeader phù hợp
    }

    if (priceLines.length === 0) {
      return res.status(200).json(priceLines);
    }

    res.status(200).json(priceLines.map(priceLine => ({
      priceline_id: priceLine._id,
      service: priceLine.service_id.name,
      vehicle_type: priceLine.vehicle_type_id.vehicle_type_name,
      price: priceLine.price,
      service_code : priceLine.service_id.service_code,
      time_required: priceLine.service_id.time_required
    })));
  } catch (err) {
    console.error('Lỗi khi lấy giá của dịch vụ:', err.message);
    res.status(500).send('Lỗi máy chủ');
  }
};

// Cập nhật thông tin bảng giá
exports.updatePriceHeader = async (req, res) => {
  const { priceHeaderId } = req.params;
  const { price_list_name, start_date, end_date, is_active } = req.body;
  if(is_active != null && price_list_name == null && start_date == null && end_date == null) {
    let priceHeader = await PriceHeader.findById(priceHeaderId);
    if (!priceHeader || priceHeader.is_deleted) {
      return res.status(404).json({ msg: 'Không tìm thấy bảng giá' });
    }
    priceHeader.is_active = is_active;
    priceHeader.updated_at = Date.now();
    await priceHeader.save();
    return res.status(200).json({ msg: 'Bảng giá đã được cập nhật', priceHeader });
  }

  try {
    let priceHeader = await PriceHeader.findById(priceHeaderId);
    if (!priceHeader || priceHeader.is_deleted) {
      return res.status(404).json({ msg: 'Không tìm thấy bảng giá' });
    }

    if (price_list_name) priceHeader.price_list_name = price_list_name;
    if (start_date) priceHeader.start_date = start_date;
    if (end_date) priceHeader.end_date = end_date;
    if (is_active != null) priceHeader.is_active = is_active;

    priceHeader.updated_at = Date.now();
    await priceHeader.save();

    res.json({ msg: 'Bảng giá đã được cập nhật', priceHeader });
  } catch (err) {
    console.error('Lỗi khi cập nhật bảng giá:', err.message);
    res.status(500).send('Lỗi máy chủ trong cập nhật bảng giá');
  }
};

//cập nhật chi tiết giá
exports.updatePriceLine = async (req, res) => {
  const { priceLineId } = req.params;
  const { service_id, vehicle_type_id, price, is_active } = req.body;
  if(is_active != null && service_id == null && vehicle_type_id == null && price == null) {
    let priceLine = await PriceLine.findById(priceLineId);
    if (!priceLine || priceLine.is_deleted) {
      return res.status(404).json({ msg: 'Không tìm thấy chi tiết giá' });
    }
    priceLine.is_active = is_active;
    priceLine.updated_at = Date.now();
    await priceLine.save();
    return res.status(200).json({ msg: 'Chi tiết giá đã được cập nhật', priceLine });
  }

  try {
    let appointmentService = await AppointmentService.findOne({ price_line : priceLineId });
    if (appointmentService) {
      return res.status(400).json({ msg: 'Không thể cập nhật giá đã được sử dụng trong lịch hẹn' });
    }
    let priceLine = await PriceLine.findById(priceLineId);
    if (!priceLine || priceLine.is_deleted) {
      return res.status(404).json({ msg: 'Không tìm thấy chi tiết giá' });
    }
    if (price <= 0) {
      return res.status(400).json({ msg: 'Giá không hợp lệ' });
    }
    if (service_id) priceLine.service_id = service_id;
    if (vehicle_type_id) priceLine.vehicle_type_id = vehicle_type_id;
    if (price) priceLine.price = price;
    if (is_active != null) priceLine.is_active = is_active;

    priceLine.updated_at = Date.now();
    await priceLine.save();
    res.json({ msg: 'Chi tiết giá đã được cập nhật', priceLine });
  }
  catch (err) {
    console.error('Lỗi khi cập nhật chi tiết giá:', err.message);
    res.status(500).send('Lỗi máy chủ trong cập nhật chi tiết giá');
  }
}
// xóa mềm chi tiết giá
exports.softDeletePriceLine = async (req, res) => {
  const { priceLineId } = req.params;

  try {
    let priceLine = await PriceLine.findById(priceLineId);
    if (!priceLine || priceLine.is_deleted) {
      return res.status(404).json({ msg: 'Không tìm thấy chi tiết giá' });
    }
    priceLine.is_deleted = true;
    priceLine.updated_at = Date.now();
    await priceLine.save();

    res.json({ msg: 'Chi tiết giá đã được xóa', priceLine });
  } catch (err) {
    console.error('Lỗi khi xóa chi tiết giá:', err.message);
    res.status(500).send('Lỗi máy chủ');
  }
};