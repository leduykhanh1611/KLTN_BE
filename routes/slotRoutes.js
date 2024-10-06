const express = require('express');
const router = express.Router();
const {
  addSlot,
  updateSlot,
  softDeleteSlot,
  getAllSlots,
  getSlotById
} = require('../controllers/slotController');
const auth = require('../middleware/auth');
const isAdmin = require('../middleware/isAdmin');

// @route   POST /api/slots
// @desc    Thêm slot mới
// @access  Private (chỉ admin)
router.post('/', [auth, isAdmin], addSlot);

// @route   PUT /api/slots/:slotId
// @desc    Cập nhật slot
// @access  Private (chỉ admin)
router.put('/:slotId', [auth, isAdmin], updateSlot);

// @route   DELETE /api/slots/:slotId
// @desc    Xóa mềm slot
// @access  Private (chỉ admin)
router.delete('/:slotId', [auth, isAdmin], softDeleteSlot);

// @route   GET /api/slots
// @desc    Lấy tất cả các slot
// @access  Public
router.get('/', getAllSlots);

// @route   GET /api/slots/:slotId
// @desc    Lấy chi tiết slot theo ID
// @access  Public
router.get('/:slotId', getSlotById);

module.exports = router;