// controllers/employeeController.js

const User = require('../models/User');
const Employee = require('../models/Employee');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
require('dotenv').config();

// Đăng ký Employee mới
exports.registerEmployee = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { username, password, email, name, phone_number, roleEmployee } = req.body;

  try {
    // Kiểm tra xem user đã tồn tại chưa
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ msg: 'Email đã được sử dụng' });
    }

    // Tạo instance mới cho User
    user = new User({
      username,
      password,
      email,
      role: 'employee',
      
    });

    // Hash mật khẩu
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    // Lưu User vào database
    await user.save();

    // Tạo instance mới cho Employee
    const employee = new Employee({
      user_id: user._id,
      name,
      phone_number,
      email,
      role: roleEmployee,
    });

    // Lưu Employee vào database
    await employee.save();

    // Tạo payload cho JWT
    const payload = {
      user: {
        id: user._id,
        role: user.role,
      },
    };
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
    // Ký JWT và trả về token
    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '1h' },
      (err, token) => {
        if (err) throw err;
        res.status(201).json({ token });
      }
    );
  } catch (err) {
    console.error('Lỗi khi đăng ký Employee:', err.message);
    res.status(500).send('Lỗi máy chủ');
  }
};
// Cập nhật thông tin Employee
exports.updateEmployee = async (req, res) => {
  const { name, phone_number, email, roleEmployee } = req.body;

  try {
    // Tìm nhân viên theo ID
    let employee = await Employee.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ msg: 'Không tìm thấy nhân viên' });
    }

    // Cập nhật thông tin
    if (name) employee.name = name;
    if (phone_number) employee.phone_number = phone_number;
    if (email) employee.email = email;
    if (roleEmployee) employee.role = roleEmployee;
    employee.updated_at = Date.now();
    await employee.save();

    res.json({ msg: 'Cập nhật thông tin nhân viên thành công', employee });
  } catch (err) {
    console.error('Lỗi khi cập nhật Employee:', err.message);
    res.status(500).send('Lỗi máy chủ');
  }
};
// Soft delete Employee (cập nhật is_deleted thành true)
exports.softDeleteEmployee = async (req, res) => {
  try {
    // Tìm nhân viên theo ID
    let employee = await Employee.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ msg: 'Không tìm thấy nhân viên' });
    }

    // Cập nhật trường is_deleted thành true
    employee.is_deleted = true;
    employee.updated_at = Date.now();
    await employee.save();

    res.json({ msg: 'Nhân viên đã được đánh dấu là đã xóa', employee });
  } catch (err) {
    console.error('Lỗi khi thực hiện soft delete Employee:', err.message);
    res.status(500).send('Lỗi máy chủ');
  }
};
// Lấy tất cả nhân viên (bỏ qua những người đã bị xóa mềm)
exports.getAllEmployees = async (req, res) => {
  try {
    // Tìm tất cả nhân viên với điều kiện is_deleted là false
    const employees = await Employee.find({ is_deleted: false });
    res.json(employees);
  } catch (err) {
    console.error('Lỗi khi lấy danh sách Employee:', err.message);
    res.status(500).send('Lỗi máy chủ');
  }
};
// Lấy chi tiết Employee theo ID
exports.getEmployeeById = async (req, res) => {
  try {
    // Tìm nhân viên theo ID và kiểm tra is_deleted
    const employee = await Employee.findOne({ _id: req.params.id, is_deleted: false });
    
    if (!employee) {
      return res.status(404).json({ msg: 'Không tìm thấy nhân viên' });
    }

    res.json(employee);
  } catch (err) {
    console.error('Lỗi khi lấy chi tiết Employee:', err.message);
    res.status(500).send('Lỗi máy chủ');
  }
};
// Lấy danh sách các giá trị enum cho role
exports.getRoleEnumValues = async (req, res) => {
  try {
    // Lấy danh sách các giá trị enum cho role từ Employee model
    const roleEnumValues = Employee.schema.path('role').enumValues;

    res.json(roleEnumValues);
  } catch (err) {
    console.error('Lỗi khi lấy danh sách enum của role:', err.message);
    res.status(500).send('Lỗi máy chủ');
  }
};