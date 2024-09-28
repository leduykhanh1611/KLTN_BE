// routes/users.js

const express = require('express');
const router = express.Router();
const { registerCustomer } = require('../controllers/userController');
const { check } = require('express-validator');

// @route   POST /api/users/register
// @desc    Đăng ký khách hàng mới
// @access  Public
router.post(
  '/register',
  [
    check('username', 'Tên người dùng là bắt buộc').not().isEmpty(),
    check('password', 'Mật khẩu phải có ít nhất 6 ký tự').isLength({ min: 6 }),
    check('email', 'Vui lòng nhập email hợp lệ').isEmail(),
    check('name', 'Tên là bắt buộc').not().isEmpty(),
    check('phone_number', 'Số điện thoại là bắt buộc').not().isEmpty(),
  ],
  registerCustomer
);

module.exports = router;
