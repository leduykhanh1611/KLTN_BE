const express = require('express');
const router = express.Router();
const { registerEmployee, updateEmployee, softDeleteEmployee, getAllEmployees, getEmployeeById, getRoleEnumValues} = require('../controllers/employeeController');
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
// @route   PUT /api/employees/:id
// @desc    Cập nhật thông tin nhân viên
// @access  Private (Chỉ admin mới có quyền cập nhật)
router.put('/:id', [auth, isAdmin], updateEmployee);

// @route   DELETE /api/employees/:id
// @desc    Đánh dấu nhân viên là đã xóa (soft delete)
// @access  Private (Chỉ admin mới có quyền)
router.delete('/:id', [auth, isAdmin], softDeleteEmployee);

// @route   GET /api/employees
// @desc    Lấy tất cả nhân viên (bỏ qua nhân viên đã bị xóa mềm)
// @access  Private (Chỉ admin hoặc nhân viên)
router.get('/', [auth, isAdmin], getAllEmployees);

// @route   GET /api/employees/roles
// @desc    Lấy danh sách các giá trị enum của role
// @access  Public
router.get('/roles', auth, getRoleEnumValues);
// @route   GET /api/employees/:id
// @desc    Lấy thông tin chi tiết nhân viên
// @access  Private (Chỉ admin hoặc nhân viên)
router.get('/:id',  [auth, isAdmin], getEmployeeById);


module.exports = router;
