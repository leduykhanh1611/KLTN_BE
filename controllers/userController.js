// controllers/userController.js

const User = require('../models/User');
const Customer = require('../models/Customer');
const Vehicle = require('../models/Vehicle');
const CustomerRank = require('../models/CustomerRank');
const bcrypt = require('bcryptjs');
const { validationResult } = require('express-validator');

// Đăng ký khách hàng mới
exports.registerCustomer = async (req, res) => {
  // Kiểm tra lỗi từ express-validator
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { username, password, email, name, address, phone_number } = req.body;

  try {
    // Kiểm tra xem email đã được sử dụng chưa
    let existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ msg: 'Email đã được sử dụng' });
    }

    // Tạo instance mới cho User
    const user = new User({
      username,
      password,
      email,
      role: 'customer',
    });

    // Hash mật khẩu
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    // Lưu User vào database
    await user.save();

    // Lấy hạng khách hàng có min_spending thấp nhất
    const lowestRank = await CustomerRank.findOne({ is_deleted: false })
      .sort({ min_spending: 1 });

    // Tạo instance mới cho Customer
    const customer = new Customer({
      user_id: user._id,
      email,
      name,
      address,
      phone_number,
      customer_rank_id: lowestRank ? lowestRank._id : null, // Gán hạng thấp nhất nếu có
      total_spending: 0,
      is_deleted: false,
    });

    // Lưu Customer vào database
    await customer.save();

    res.status(201).json({ msg: 'Khách hàng mới đã được tạo', user, customer });
  } catch (err) {
    console.error('Lỗi khi đăng ký khách hàng:', err.message);
    res.status(500).send('Lỗi máy chủ');
  }
};
// Lấy chi tiết khách hàng theo ID và bao gồm danh sách xe
exports.getCustomerByIdWithVehicles = async (req, res) => {
  try {
    // Tìm khách hàng theo ID và kiểm tra is_deleted
    const customer = await Customer.findOne({ _id: req.params.id, is_deleted: false })
      .populate('customer_rank_id')
      .lean(); // Sử dụng lean() để dễ dàng chỉnh sửa dữ liệu sau khi truy vấn;

    if (!customer) {
      return res.status(404).json({ msg: 'Không tìm thấy khách hàng' });
    }

    // Tìm tất cả các xe liên quan đến khách hàng này
    const vehicles = await Vehicle.find({ customer_id: req.params.id, is_deleted: false });

    // Trả về thông tin khách hàng kèm danh sách xe
    res.json({
      customer,
      vehicles
    });
  } catch (err) {
    console.error('Lỗi khi lấy chi tiết Customer:', err.message);
    res.status(500).send('Lỗi máy chủ');
  }
};
// Lấy tất cả khách hàng (bỏ qua những khách hàng đã bị xóa mềm)
exports.getAllCustomers = async (req, res) => {
  try {
    // Tìm tất cả khách hàng với điều kiện is_deleted là false
    const customers = await Customer.find({ is_deleted: false })
      .populate('customer_rank_id')
      .lean(); // Sử dụng lean() để dễ dàng chỉnh sửa dữ liệu sau khi truy vấn;
    res.json(customers);
  } catch (err) {
    console.error('Lỗi khi lấy danh sách Customer:', err.message);
    res.status(500).send('Lỗi máy chủ');
  }
};
// Soft delete Customer (cập nhật is_deleted thành true)
exports.softDeleteCustomer = async (req, res) => {
  try {
    // Tìm khách hàng theo ID
    let customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ msg: 'Không tìm thấy khách hàng' });
    }

    // Cập nhật trường is_deleted thành true và updated_at
    customer.is_deleted = true;
    customer.updated_at = Date.now();

    await customer.save();

    res.json({ msg: 'Khách hàng đã được đánh dấu là đã xóa', customer });
  } catch (err) {
    console.error('Lỗi khi thực hiện soft delete Customer:', err.message);
    res.status(500).send('Lỗi máy chủ');
  }
};
// Cập nhật thông tin Customer
exports.updateCustomer = async (req, res) => {
  const { name, address, phone_number } = req.body;

  try {
    // Tìm khách hàng theo ID
    let customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ msg: 'Không tìm thấy khách hàng' });
    }

    // Cập nhật thông tin khách hàng
    if (name) customer.name = name;
    if (address) customer.address = address;
    if (phone_number) customer.phone_number = phone_number;

    // Cập nhật updated_at với thời gian hiện tại
    customer.updated_at = Date.now();

    await customer.save();

    res.json({ msg: 'Cập nhật thông tin khách hàng thành công', customer });
  } catch (err) {
    console.error('Lỗi khi cập nhật Customer:', err.message);
    res.status(500).send('Lỗi máy chủ');
  }
};
// Lấy danh sách khách hàng và các xe theo loại xe
exports.getCustomersAndVehiclesByVehicleType = async (req, res) => {
  try {
    const { vehicleTypeId } = req.params;

    // Tìm tất cả các xe theo loại xe và không bị xóa
    const vehicles = await Vehicle.find({
      vehicle_type_id: vehicleTypeId,
      is_deleted: false
    });

    if (vehicles.length === 0) {
      return res.status(404).json({ msg: 'Không tìm thấy xe nào thuộc loại xe này' });
    }

    // Lấy danh sách customer_id từ các xe tìm được
    const customerIds = vehicles.map(vehicle => vehicle.customer_id);

    // Tìm tất cả các khách hàng với customer_id tương ứng và không bị xóa
    const customers = await Customer.find({ _id: { $in: customerIds }, is_deleted: false }).populate('customer_rank_id')
    .lean(); // Sử dụng lean() để dễ dàng chỉnh sửa dữ liệu sau khi truy vấn;

    // Kết hợp khách hàng và xe của họ
    const customerMap = new Map();

    // Đầu tiên, tạo một map cho các khách hàng
    customers.forEach(customer => {
      customerMap.set(customer._id.toString(), {
        customer: customer,
        vehicles: []
      });
    });

    // Tiếp theo, thêm các xe vào danh sách của từng khách hàng tương ứng
    vehicles.forEach(vehicle => {
      const customerIdStr = vehicle.customer_id.toString();
      if (customerMap.has(customerIdStr)) {
        customerMap.get(customerIdStr).vehicles.push(vehicle);
      }
    });

    // Chuyển từ map thành mảng để trả về
    const result = Array.from(customerMap.values());

    // Trả về thông tin khách hàng và các xe của họ
    res.json(result);
  } catch (err) {
    console.error('Lỗi khi lấy danh sách khách hàng và xe:', err.message);
    res.status(500).send('Lỗi máy chủ');
  }
};
