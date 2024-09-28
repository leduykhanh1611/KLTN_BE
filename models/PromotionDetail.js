const mongoose = require('mongoose');

const PromotionDetailSchema = new mongoose.Schema(
  {
    promotion_line_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PromotionLine',
      required: true,
    },
    vehicle_type_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VehicleType',
      default: null,
    },
    service_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
      default: null,
    },
    is_deleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

module.exports = mongoose.model('PromotionDetail', PromotionDetailSchema);