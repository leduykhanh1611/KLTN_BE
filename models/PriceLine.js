const mongoose = require('mongoose');

const PriceLineSchema = new mongoose.Schema(
  {
    price_header_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PriceHeader',
      required: true,
    },
    service_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
      required: true,
    },
    vehicle_type_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VehicleType',
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    is_deleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

module.exports = mongoose.model('PriceLine', PriceLineSchema);