const mongoose = require('mongoose');

const PromotionLineSchema = new mongoose.Schema(
  {
    promotion_header_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PromotionHeader',
      required: true,
    },
    discount_type: {
      type: Number,
      required: true,
      enum: [ 1, 2], // Adjust types as necessary Giảm giá theo phần trăm và giảm giá cố định ['percentage', 'fixed']
    },
    description: {
      type: String,
      default: true,
    },
    start_date: {
      type: Date,
      required: true,
    },
    end_date: {
      type: Date,
      required: true,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    is_deleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

module.exports = mongoose.model('PromotionLine', PromotionLineSchema);