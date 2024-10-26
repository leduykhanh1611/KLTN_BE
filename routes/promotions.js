const express = require('express');
const router = express.Router();
const {
  addPromotionHeader,
  addPromotionLine,
  addPromotionDetail,
  getAllPromotions,
  getPromotionLinesByHeader,
  getPromotionHeaderDetails,
  updatePromotionHeader,
  updatePromotionLine,
  softDeletePromotionHeader,
  softDeletePromotionLine,
  searchPromotions,
  getAvailablePromotionsForCustomer,
  toggleActivePromotion,
  getCustomersByPromotion,
  getPromotionDetailsByLine,
  updatePromotionDetail,
  softDeletePromotionDetail, 
  getPromotionWithDetails,
  getAllPromotionDetails
} = require('../controllers/promotionController');
const auth = require('../middleware/auth');
const isAdmin = require('../middleware/isAdmin');


// @route   GET /api/promotions/search
// @desc    Tìm kiếm và lọc chương trình khuyến mãi
// @access  Public hoặc Private (tùy yêu cầu)
router.get('/search', searchPromotions);

// @route   GET /api/promotions/available
// @desc    Lấy danh sách chương trình khuyến mãi khả dụng cho khách hàng hiện tại
// @access  Private (khách hàng đã đăng nhập)
router.get('/available', auth, getAvailablePromotionsForCustomer);


// @route   POST /api/promotions
// @desc    Thêm chương trình khuyến mãi mới
// @access  Private (chỉ admin)
router.post('/', [auth, isAdmin], addPromotionHeader);

// @route   POST /api/promotions/:promotionHeaderId/lines
// @desc    Thêm dòng khuyến mãi vào chương trình khuyến mãi
// @access  Private (chỉ admin)
router.post('/:promotionHeaderId/lines', [auth, isAdmin], addPromotionLine);

// @route   POST /api/promotions/lines/:promotionLineId/details
// @desc    Thêm chi tiết khuyến mãi vào dòng khuyến mãi
// @access  Private (chỉ admin)
router.post('/lines/:promotionLineId/details', [auth, isAdmin], addPromotionDetail);

// @route   GET /api/promotions
// @desc    Lấy tất cả chương trình khuyến mãi
// @access  Public
router.get('/', getAllPromotions);

// @route   GET /api/promotions/:promotionHeaderId
// @desc    Lấy chi tiết chương trình khuyến mãi
// @access  Public
router.get('/:promotionHeaderId', getPromotionHeaderDetails);

// @route   GET /api/promotions/:promotionHeaderId/lines
// @desc    Lấy tất cả dòng khuyến mãi theo chương trình khuyến mãi
// @access  Public
router.get('/:promotionHeaderId/lines', getPromotionLinesByHeader);

// @route   GET /api/promotions/lines/:promotionLineId/details
// @desc    Lấy tất cả chi tiết của dòng khuyến mãi
// @access  Public
router.get('/lines/:promotionLineId/details', getPromotionDetailsByLine);

// @route   PUT /api/promotions/:promotionHeaderId
// @desc    Cập nhật thông tin chương trình khuyến mãi
// @access  Private (chỉ admin)
router.put('/:promotionHeaderId', [auth, isAdmin], updatePromotionHeader);

// @route   PUT /api/promotions/lines/:promotionLineId
// @desc    Cập nhật chi tiết dòng khuyến mãi
// @access  Private (chỉ admin)
router.put('/lines/:promotionLineId', [auth, isAdmin], updatePromotionLine);

// @route   DELETE /api/promotions/:promotionHeaderId
// @desc    Xóa mềm chương trình khuyến mãi
// @access  Private (chỉ admin)
router.delete('/:promotionHeaderId', [auth, isAdmin], softDeletePromotionHeader);

// @route   DELETE /api/promotions/lines/:promotionLineId
// @desc    Xóa mềm dòng khuyến mãi
// @access  Private (chỉ admin)
router.delete('/lines/:promotionLineId', [auth, isAdmin], softDeletePromotionLine);

// @route   PUT /api/promotions/:promotionHeaderId/toggle-active
// @desc    Kích hoạt hoặc ngừng kích hoạt chương trình khuyến mãi
// @access  Private (chỉ admin)
router.put('/:promotionHeaderId/toggle-active', [auth, isAdmin], toggleActivePromotion);

// @route   GET /api/promotions/:promotionHeaderId/customers
// @desc    Lấy danh sách khách hàng đã sử dụng chương trình khuyến mãi
// @access  Private (chỉ admin)
router.get('/:promotionHeaderId/customers', [auth, isAdmin], getCustomersByPromotion);

// @route   PUT /api/promotions/details/:promotionDetailId
// @desc    Cập nhật chi tiết khuyến mãi
// @access  Private (chỉ admin)
router.put('/details/:promotionDetailId', [auth, isAdmin], updatePromotionDetail);

// @route   DELETE /api/promotions/details/:promotionDetailId
// @desc    Xóa mềm chi tiết khuyến mãi
// @access  Private (chỉ admin)
router.delete('/details/:promotionDetailId', [auth, isAdmin], softDeletePromotionDetail);

// @route   GET /api/promotions/:promotionHeaderId/details
// @desc    Lấy chương trình khuyến mãi, bao gồm header, các line và detail thuộc header đó
// @access  Public
router.get('/:promotionHeaderId/details', getPromotionWithDetails);

// @route   GET /api/promotions/details
// @desc    Lấy tất cả chi tiết khuyến mãi
// @access  Private (chỉ admin)
router.get('/line/details/:promotionLineId', [auth, isAdmin], getAllPromotionDetails);
module.exports = router;