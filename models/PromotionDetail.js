const mongoose = require('mongoose');

const PromotionDetailSchema = new mongoose.Schema(
  {
    promotion_line_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PromotionLine',
      required: true,
    },
    service_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
      default: null,
    },
    applicable_rank_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CustomerRank',
      default: null,
    },
    discount_value: {
      type: Number,
    },
    min_order_value: Number,
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

module.exports = mongoose.model('PromotionDetail', PromotionDetailSchema);