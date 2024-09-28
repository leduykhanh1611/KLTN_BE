const express = require('express');
const router = express.Router();
const { registerEmployee } = require('../controllers/employeeController');
const { check } = require('express-validator');

// Import middleware xác thực và phân quyền
const auth = require('../middleware/auth');
const isAdmin = require('../middleware/isAdmin');

// @route   POST /api/employees/register
// @desc    Đăng ký Employee mới
// @access  Private (Chỉ admin mới có quyền truy cập)
router.post(
  '/register',
  [
    auth, // Middleware xác thực
    isAdmin, // Middleware kiểm tra vai trò admin
    [
      check('username', 'Tên người dùng là bắt buộc').not().isEmpty(),
      check('password', 'Mật khẩu phải có ít nhất 6 ký tự').isLength({ min: 6 }),
      check('email', 'Vui lòng nhập email hợp lệ').isEmail(),
      check('name', 'Tên là bắt buộc').not().isEmpty(),
      check('phone_number', 'Số điện thoại là bắt buộc').not().isEmpty(),
      check('roleEmployee', 'Vị trí là bắt buộc').not().isEmpty(),
    ],
  ],
  registerEmployee
);

module.exports = router;
