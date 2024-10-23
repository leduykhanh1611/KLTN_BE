const express = require('express');
const router = express.Router();
const {
  addPriceHeader,
  addPriceLine,
  getAllPriceHeaders,
  getPriceLinesByHeader,
  softDeletePriceHeader, 
  getPriceByServiceAndVehicle,
  updatePriceHeader,
  updatePriceLine,
  softDeletePriceLine
} = require('../controllers/priceController');
const auth = require('../middleware/auth');
const isAdmin = require('../middleware/isAdmin');

// @route   POST /api/prices
// @desc    Thêm bảng giá mới
// @access  Private (chỉ admin)
router.post('/', [auth, isAdmin], addPriceHeader);

// @route   GET /api/prices/filterprice/?service_id=...&vehicle_type_id=...
// @desc    Lấy giá theo dịch vụ và loại xe
// @access  Public
router.get('/filterprice', getPriceByServiceAndVehicle);


// @route   POST /api/prices/:priceHeaderId/lines
// @desc    Thêm dòng chi tiết giá cho bảng giá
// @access  Private (chỉ admin)
router.post('/:priceHeaderId/lines', [auth, isAdmin], addPriceLine);

// @route   GET /api/prices
// @desc    Lấy tất cả bảng giá
// @access  Public
router.get('/', getAllPriceHeaders);

// @route   GET /api/prices/:priceHeaderId/lines
// @desc    Lấy tất cả chi tiết giá theo bảng giá
// @access  Public
router.get('/:priceHeaderId/lines', getPriceLinesByHeader);

// @route   DELETE /api/prices/:priceHeaderId
// @desc    Xóa mềm bảng giá
// @access  Private (chỉ admin)
router.delete('/:priceHeaderId', [auth, isAdmin], softDeletePriceHeader);

// @route   PUT /api/prices/:priceHeaderId
// @desc    Cập nhật bảng giá header 
// @access  Private (chỉ admin)
router.put('/:priceHeaderId', [auth, isAdmin], updatePriceHeader);

// @route   PUT /api/prices/lines/:priceLineId
// @desc    Cập nhật dòng chi tiết giá
// @access  Private (chỉ admin)
router.put('/lines/:priceLineId', [auth, isAdmin], updatePriceLine);

// @route   DELETE /api/prices/lines/:priceLineId
// @desc    Xóa mềm dòng chi tiết giá
// @access  Private (chỉ admin)
router.delete('/lines/:priceLineId', [auth, isAdmin], softDeletePriceLine);

module.exports = router;
