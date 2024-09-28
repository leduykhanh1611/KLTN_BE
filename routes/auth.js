const express = require('express');
const router = express.Router();
const { loginCustomer, loginEmployee, loginAdmin } = require('../controllers/authController');
const { check } = require('express-validator');

// @desc    Đăng nhập khách hàng
// @access  Public
router.post(
  '/loginCustomer',
  [
    check('email', 'Vui lòng nhập email hợp lệ').isEmail(),
    check('password', 'Mật khẩu là bắt buộc').exists(),
  ],
  loginCustomer
);
router.post(
  '/loginAdmin',
  [
    check('email', 'Vui lòng nhập email hợp lệ').isEmail(),
    check('password', 'Mật khẩu là bắt buộc').exists(),
  ],
  loginAdmin
);
router.post(
  '/loginEmployee',
  [
    check('email', 'Vui lòng nhập email hợp lệ').isEmail(),
    check('password', 'Mật khẩu là bắt buộc').exists(),
  ],
  loginEmployee
);

module.exports = router;
