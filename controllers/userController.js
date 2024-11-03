const User = require('../models/User');
const Customer = require('../models/Customer');
const Vehicle = require('../models/Vehicle');
const CustomerRank = require('../models/CustomerRank');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const { validationResult } = require('express-validator');
const path = require('path'); // Thêm import path
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
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

    // Tạo instance mới cho User với trạng thái kích hoạt là false
    const user = new User({
      username,
      password,
      email,
      role: 'customer',
      is_active: false,
    });

    // Hash mật khẩu
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    
    // Lấy hạng khách hàng có min_spending thấp nhất
    const lowestRank = await CustomerRank.findOne({ is_deleted: false }).sort({ min_spending: 1 });

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

    // Tạo mã OTP (6 chữ số)
    const otp = crypto.randomInt(100000, 999999);
    user.otp = otp; // Lưu OTP vào user
    user.otp_expiry = Date.now() + 3600000; // OTP có hiệu lực trong 1 giờ
    await user.save();

    // Tạo transporter để gửi email
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // Nội dung email chứa mã OTP
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Mã OTP kích hoạt tài khoản của bạn',
      html: `<p>Chào ${name},</p>
              <p>Cảm ơn bạn đã đăng ký tài khoản. Đây là mã OTP để kích hoạt tài khoản của bạn:</p>
              <h2>${otp}</h2>
              <p>Mã này sẽ hết hạn sau 1 giờ.</p>`,
    };

    // Gửi email chứa mã OTP
    await transporter.sendMail(mailOptions);

    res.status(201).json({ msg: 'Khách hàng mới đã được tạo', user, customer });
  } catch (err) {
    console.error('Lỗi khi đăng ký khách hàng:', err.message);
    res.status(500).send('Lỗi máy chủ');
  }
};

// Kích hoạt tài khoản khách hàng bằng mã OTP
exports.activateCustomerAccountWithOtp = async (req, res) => {
  const { email, otp } = req.body;

  try {
    // Tìm user theo email
    let user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ msg: 'Không tìm thấy tài khoản với email này' });
    }

    // Kiểm tra xem tài khoản đã kích hoạt chưa
    if (user.is_active) {
      return res.status(400).json({ msg: 'Tài khoản đã được kích hoạt' });
    }

    // Kiểm tra mã OTP và thời hạn hiệu lực
    if (user.otp !== parseInt(otp) || Date.now() > user.otp_expiry) {
      return res.status(400).json({ msg: 'Mã OTP không hợp lệ hoặc đã hết hạn' });
    }

    // Cập nhật trạng thái tài khoản thành kích hoạt
    user.is_active = true;
    user.otp = null; // Xóa mã OTP sau khi kích hoạt
    user.otp_expiry = null;
    await user.save();

    res.status(200).json({ msg: 'Tài khoản đã được kích hoạt thành công' });
  } catch (err) {
    console.error('Lỗi khi kích hoạt tài khoản:', err.message);
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
    const vehicles = await Vehicle.find({ customer_id: req.params.id, is_deleted: false }).populate('vehicle_type_id');

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

// Lấy chi tiết khách hàng theo ID và bao gồm danh sách xe
exports.getCustomerByIdWithVehiclesForMobile = async (req, res) => {
  try {
    // Tìm khách hàng theo ID và kiểm tra is_deleted
    const customer = await Customer.findOne({ user_id: req.params.id, is_deleted: false })
      .populate('customer_rank_id')
      .lean(); // Sử dụng lean() để dễ dàng chỉnh sửa dữ liệu sau khi truy vấn;

    if (!customer) {
      return res.status(404).json({ msg: 'Không tìm thấy khách hàng' });
    }

    // Tìm tất cả các xe liên quan đến khách hàng này
    const vehicles = await Vehicle.find({ customer_id: req.params.id, is_deleted: false }).populate('vehicle_type_id');

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

// tìm khách hàng theo số điện thoại và email
exports.findCustomerByPhoneOrEmail = async (req, res) => {
  const { phone_number, email } = req.query;
  try {
    // Tìm khách hàng theo số điện thoại hoặc email
    const customer = await Customer.findOne({
      $or: [{ phone_number }, { email }],
      is_deleted: false
    }).populate('customer_rank_id')
      .lean(); // Sử dụng lean() để dễ dàng chỉnh sửa dữ liệu sau khi truy vấn;

    if (!customer) {
      return res.status(404).json({ msg: 'Không tìm thấy khách hàng' });
    }

    // Tìm tất cả các xe liên quan đến khách hàng này
    const vehicles = await Vehicle.find({ customer_id: customer._id, is_deleted: false }).populate('vehicle_type_id');

    // Trả về thông tin khách hàng và danh sách xe
    res.status(200).json({
      customer,
      vehicles,
    });
  } catch (err) {
    console.error('Lỗi khi tìm khách hàng:', err.message);
    res.status(500).send('Lỗi máy chủ');
  }
};
