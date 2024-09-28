// controllers/userController.js

const User = require('../models/User');
const Customer = require('../models/Customer');
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

    // Tạo instance mới cho Customer
    const customer = new Customer({
      user_id: user._id,
      email,
      name,
      address,
      phone_number,
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
