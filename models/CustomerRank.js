const mongoose = require('mongoose');

const CustomerRankSchema = new mongoose.Schema(
  {
    rank_name: {
      type: String,
      required: true,
      unique: true,
    },
    discount_rate: {
      type: Number,
      required: true,
    },
    min_spending: {
      type: Number,
      required: true,
    },
    description: String,
    is_deleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

module.exports = mongoose.model('CustomerRank', CustomerRankSchema);