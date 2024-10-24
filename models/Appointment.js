const mongoose = require('mongoose');

const AppointmentSchema = new mongoose.Schema(
  {
    customer_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
    },
    vehicle_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vehicle',
      required: true,
    },
    slot_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Slot',
      default: null,
    },
    appointment_datetime: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      required: true,
      enum: ['scheduled','waiting','completed', 'cancelled'], // Adjust as necessary
    },
    is_deleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

module.exports = mongoose.model('Appointment', AppointmentSchema);