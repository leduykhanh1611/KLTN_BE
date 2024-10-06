// routes/users.js

const express = require('express');
const router = express.Router();
const { registerCustomer, updateCustomer, softDeleteCustomer, getAllCustomers, getCustomerByIdWithVehicles, getCustomersAndVehiclesByVehicleType, activateCustomerAccountWithOtp } = require('../controllers/userController');
const { check } = require('express-validator');
// Import middleware xác thực và phân quyền
const auth = require('../middleware/auth');
const isAdmin = require('../middleware/isAdmin');
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
// @route   PUT /api/customers/:id
// @desc    Cập nhật thông tin khách hàng
// @access  Private (Chỉ admin hoặc khách hàng có quyền)
router.put('/:id', auth, updateCustomer);

// @route   DELETE /api/customers/:id
// @desc    Xóa mềm khách hàng
// @access  Private (Chỉ admin có quyền xóa khách hàng)
router.delete('/:id', [auth, isAdmin], softDeleteCustomer);

// @route   GET /api/customers
// @desc    Lấy tất cả khách hàng (bỏ qua khách hàng đã bị xóa mềm)
// @access  Private (Chỉ admin hoặc nhân viên)
router.get('/', auth, getAllCustomers);

// @route   GET /api/customers/:id
// @desc    Lấy thông tin chi tiết khách hàng bao gồm cả xe của khách hàng
// @access  Private (Chỉ admin hoặc khách hàng có quyền)
router.get('/:id', auth, getCustomerByIdWithVehicles);

// @route   GET /api/customers/vehicle-type/:vehicleTypeId
// @desc    Lấy danh sách khách hàng theo loại xe
// @access  Private (Chỉ admin hoặc nhân viên)
router.get('/vehicle-type/:vehicleTypeId', auth, getCustomersAndVehiclesByVehicleType);

// @route   GET /api/customers/activate-account/:id
// @desc    Kích hoạt tài khoản khách hàng
// @access  Không có
router.post('/activate', activateCustomerAccountWithOtp);
module.exports = router;
