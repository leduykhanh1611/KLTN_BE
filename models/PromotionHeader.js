const mongoose = require('mongoose');

const PromotionHeaderSchema = new mongoose.Schema(
  {
    promotion_code: {
      type: String,
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
    },
    description: String,
    applicable_rank_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CustomerRank',
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

module.exports = mongoose.model('PromotionHeader', PromotionHeaderSchema);