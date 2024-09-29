const VehicleType = require('../models/VehicleType');

// Thêm loại xe mới
exports.addVehicleType = async (req, res) => {
  const { vehicle_type_name, description } = req.body;

  try {
    // Kiểm tra xem loại xe đã tồn tại chưa
    let existingVehicleType = await VehicleType.findOne({ vehicle_type_name });
    if (existingVehicleType) {
      return res.status(400).json({ msg: 'Loại xe này đã tồn tại' });
    }
    // Tạo mới loại xe
    const vehicleType = new VehicleType({
      vehicle_type_name,
      description,
      is_deleted: false,
      updated_at: Date.now()
    });

    await vehicleType.save();

    res.status(201).json({ msg: 'Loại xe mới đã được thêm', vehicleType });
  } catch (err) {
    console.error('Lỗi khi thêm loại xe:', err.message);
    res.status(500).send('Lỗi máy chủ');
  }
};

// Cập nhật thông tin loại xe
exports.updateVehicleType = async (req, res) => {
  const { vehicle_type_name, description } = req.body;

  try {
    // Tìm loại xe theo ID
    let vehicleType = await VehicleType.findById(req.params.id);
    if (!vehicleType || vehicleType.is_deleted) {
      return res.status(404).json({ msg: 'Không tìm thấy loại xe' });
    }

    // Cập nhật thông tin loại xe
    if (vehicle_type_name) vehicleType.vehicle_type_name = vehicle_type_name;
    if (description) vehicleType.description = description;

    vehicleType.updated_at = Date.now(); // Cập nhật thời gian cập nhật

    await vehicleType.save();

    res.json({ msg: 'Cập nhật thông tin loại xe thành công', vehicleType });
  } catch (err) {
    console.error('Lỗi khi cập nhật loại xe:', err.message);
    res.status(500).send('Lỗi máy chủ');
  }
};

// Xóa mềm loại xe (soft delete)
exports.softDeleteVehicleType = async (req, res) => {
  try {
    // Tìm loại xe theo ID
    let vehicleType = await VehicleType.findById(req.params.id);
    if (!vehicleType || vehicleType.is_deleted) {
      return res.status(404).json({ msg: 'Không tìm thấy loại xe' });
    }

    // Đánh dấu loại xe là đã bị xóa
    vehicleType.is_deleted = true;
    vehicleType.updated_at = Date.now(); // Cập nhật thời gian cập nhật

    await vehicleType.save();

    res.json({ msg: 'Loại xe đã được đánh dấu là đã xóa', vehicleType });
  } catch (err) {
    console.error('Lỗi khi xóa mềm loại xe:', err.message);
    res.status(500).send('Lỗi máy chủ');
  }
};

// Lấy tất cả loại xe (bỏ qua những loại xe đã bị xóa mềm)
exports.getAllVehicleTypes = async (req, res) => {
  try {
    // Tìm tất cả loại xe với điều kiện is_deleted là false
    const vehicleTypes = await VehicleType.find({ is_deleted: false });

    res.json(vehicleTypes);
  } catch (err) {
    console.error('Lỗi khi lấy danh sách loại xe:', err.message);
    res.status(500).send('Lỗi máy chủ');
  }
};
