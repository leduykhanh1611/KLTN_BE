const mongoose = require('mongoose');

const EmployeeSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      required: true,
      enum: ['manager', 'technician'], // Adjust roles as necessary, quản lý, nhân viên kỹ thuật
    },
    phone_number: String,
    email: {
      type: String,
      required: true,
      unique: true, // Assuming each employee has a unique email
    },
    is_deleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

module.exports = mongoose.model('Employee', EmployeeSchema);