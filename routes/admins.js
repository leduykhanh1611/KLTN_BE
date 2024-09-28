const express = require('express');
const router = express.Router();
const { registerAdmin } = require('../controllers/adminController');
const { check } = require('express-validator');

// @route   POST /api/admins/register
// @desc    Đăng ký Admin mới
// @access  Private (Chỉ admin hiện tại mới có thể tạo admin mới)
router.post(
  '/register',
  [
    check('username', 'Tên người dùng là bắt buộc').not().isEmpty(),
    check('password', 'Mật khẩu phải có ít nhất 6 ký tự').isLength({ min: 6 }),
    check('email', 'Vui lòng nhập email hợp lệ').isEmail(),
  ],
  registerAdmin
);

module.exports = router;