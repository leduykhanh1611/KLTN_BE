const mongoose = require('mongoose');

const PromotionSchema = new mongoose.Schema(
  {
    promotion_header_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PromotionHeader',
      required: true,
    },
    value: {
      type: Number,
      required: true,
    },
    invoice_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
    },
    is_pay: {
      type: Boolean,
      default: false,
    },
    is_deleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

module.exports = mongoose.model('Promotion', PromotionSchema);
