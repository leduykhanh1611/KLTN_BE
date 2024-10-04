const mongoose = require('mongoose');

const PromotionLineSchema = new mongoose.Schema(
  {
    promotion_header_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PromotionHeader',
      required: true,
    },
    discount_type: {
      type: String,
      required: true,
      enum: ['percentage', 'fixed'], // Adjust types as necessary Giảm giá theo phần trăm và giảm giá cố định
    },
    discount_value: {
      type: Number,
      required: true,
    },
    min_order_value: Number,
    start_date: {
      type: Date,
      required: true,
    },
    end_date: Date,
    is_deleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

module.exports = mongoose.model('PromotionLine', PromotionLineSchema);