const mongoose = require('mongoose');

const VehicleTypeSchema = new mongoose.Schema(
  {
    vehicle_type_name: {
      type: String,
      required: true,
      unique: true,
    },
    description: String,
    is_deleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

module.exports = mongoose.model('VehicleType', VehicleTypeSchema);