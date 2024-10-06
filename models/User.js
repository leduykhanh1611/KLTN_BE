const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
    },
    password: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true, // Assuming emails are unique
    },
    role: {
      type: String,
      required: true,
      enum: ['customer', 'employee', 'admin'], // Adjust based on possible roles
    },
    is_deleted: {
      type: Boolean,
      default: false,
    },
    is_active: {
      type: Boolean,
      default: false,
    },
    otp: {
      type: Number,
      default: 0,
    },
    otp_expiry: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

module.exports = mongoose.model('User', UserSchema);