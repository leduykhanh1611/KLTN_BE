// controllers/adminController.js

const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
require('dotenv').config();

// Đăng ký Admin mới
exports.registerAdmin = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { username, password, email } = req.body;

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
      role: 'admin',
    });

    // Hash mật khẩu
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    // Lưu vào database
    await user.save();

    // Tạo payload cho JWT
    const payload = {
      user: {
        id: user._id,
        role: user.role,
      },
    };

    // Ký JWT và trả về token
    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '24h' }, // Token hết hạn sau 1 giờ
      (err, token) => {
        if (err) throw err;
        res.status(201).json({ token });
      }
    );
  } catch (err) {
    console.error('Lỗi khi đăng ký Admin:', err.message);
    res.status(500).send('Lỗi máy chủ');
  }
};
