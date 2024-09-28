const mongoose = require('mongoose');

const CustomerSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true, // Assuming email is unique per customer
    },
    name: {
      type: String,
      required: true,
    },
    address: String,
    phone_number: String,
    customer_rank_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CustomerRank',
    },
    total_spending: {
      type: Number,
      default: 0,
    },
    is_deleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

module.exports = mongoose.model('Customer', CustomerSchema);