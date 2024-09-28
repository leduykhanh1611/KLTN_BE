const mongoose = require('mongoose');

const VehicleInspectionSchema = new mongoose.Schema(
  {
    vehicle_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vehicle',
      required: true,
    },
    inspection_date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    inspection_result: {
      type: String,
      required: true,
      enum: ['pass', 'fail', 'needs_repair'], // Adjust as necessary
    },
    notes: String,
    is_deleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

module.exports = mongoose.model('VehicleInspection', VehicleInspectionSchema);