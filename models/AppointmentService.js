const mongoose = require('mongoose');

const AppointmentServiceSchema = new mongoose.Schema(
  {
    appointment_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      required: true,
    },
    price_line_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PriceLine',
      required: true,
    },
    is_deleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

module.exports = mongoose.model('AppointmentService', AppointmentServiceSchema);