const mongoose = require('mongoose');

const EmployeeShiftSchema = new mongoose.Schema(
  {
    employee_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },
    shift_start: {
      type: Date,
      required: true,
    },
    shift_end: {
      type: Date,
      required: true,
    },
    shift_type: {
      type: String,
      required: true,
      enum: ['morning', 'afternoon', 'night', 'full_day'], // Adjust as necessary
    },
    is_deleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

module.exports = mongoose.model('EmployeeShift', EmployeeShiftSchema);