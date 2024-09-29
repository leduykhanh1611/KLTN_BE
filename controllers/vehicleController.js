// controllers/vehicleController.js

const Vehicle = require('../models/Vehicle');
const Customer = require('../models/Customer');

// Thêm xe mới cho khách hàng
exports.addVehicle = async (req, res) => {
  const { vehicle_type_id, license_plate, manufacturer, model, year, color } = req.body;

  try {
    // Kiểm tra xem khách hàng có tồn tại không
    let customer = await Customer.findById(req.params.customerId);
    if (!customer || customer.is_deleted) {
      return res.status(404).json({ msg: 'Không tìm thấy khách hàng' });
    }

    // Kiểm tra xem biển số xe đã tồn tại chưa
    let existingVehicle = await Vehicle.findOne({ license_plate });
    if (existingVehicle) {
      return res.status(400).json({ msg: 'Biển số xe đã tồn tại' });
    }

    // Tạo mới xe cho khách hàng
    const vehicle = new Vehicle({
      customer_id: req.params.customerId,
      vehicle_type_id,
      license_plate,
      manufacturer,
      model,
      year,
      color,
      is_deleted: false,
      updated_at: Date.now()
    });

    // Lưu xe vào cơ sở dữ liệu
    await vehicle.save();

    res.status(201).json({ msg: 'Xe mới đã được thêm', vehicle });
  } catch (err) {
    console.error('Lỗi khi thêm xe:', err.message);
    res.status(500).send('Lỗi máy chủ');
  }
};

// Sửa thông tin xe của khách hàng
exports.updateVehicle = async (req, res) => {
  const { vehicle_type_id, license_plate, manufacturer, model, year, color } = req.body;

  try {
    // Tìm xe theo ID
    let vehicle = await Vehicle.findOne({ _id: req.params.vehicleId, customer_id: req.params.customerId, is_deleted: false });
    if (!vehicle) {
      return res.status(404).json({ msg: 'Không tìm thấy xe' });
    }

    // Cập nhật thông tin xe
    if (vehicle_type_id) vehicle.vehicle_type_id = vehicle_type_id;
    if (license_plate) vehicle.license_plate = license_plate;
    if (manufacturer) vehicle.manufacturer = manufacturer;
    if (model) vehicle.model = model;
    if (year) vehicle.year = year;
    if (color) vehicle.color = color;

    vehicle.updated_at = Date.now(); // Cập nhật thời gian cập nhật

    await vehicle.save();

    res.json({ msg: 'Cập nhật thông tin xe thành công', vehicle });
  } catch (err) {
    console.error('Lỗi khi cập nhật xe:', err.message);
    res.status(500).send('Lỗi máy chủ');
  }
};

// Xóa mềm xe của khách hàng (soft delete)
exports.softDeleteVehicle = async (req, res) => {
  try {
    // Tìm xe theo ID
    let vehicle = await Vehicle.findOne({ _id: req.params.vehicleId, customer_id: req.params.customerId, is_deleted: false });
    if (!vehicle) {
      return res.status(404).json({ msg: 'Không tìm thấy xe' });
    }

    // Đánh dấu xe là đã bị xóa
    vehicle.is_deleted = true;
    vehicle.updated_at = Date.now(); // Cập nhật thời gian cập nhật

    await vehicle.save();

    res.json({ msg: 'Xe đã được đánh dấu là đã xóa', vehicle });
  } catch (err) {
    console.error('Lỗi khi xóa mềm xe:', err.message);
    res.status(500).send('Lỗi máy chủ');
  }
};
