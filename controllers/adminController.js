// controllers/adminController.js

const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const nodemailer = require('nodemailer');
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
    // Tạo token kích hoạt tài khoản
    const activationToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

    // Tạo transporter để gửi email
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // Nội dung email kích hoạt
    const activationUrl = `https://host-rose-sigma.vercel.app/api/users/activate/${activationToken}`;
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Kích hoạt tài khoản của bạn',
      html: `<p>Xin Chào ${username},</p>
             <p>Cảm ơn bạn đã đăng ký tài khoản. Vui lòng nhấn vào liên kết dưới đây để kích hoạt tài khoản của bạn:</p>
             <a href="${activationUrl}">Kích hoạt tài khoản</a>
             <p>Liên kết này sẽ hết hạn sau 1 giờ.</p>`
    };

    // Gửi email
    await transporter.sendMail(mailOptions);
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
