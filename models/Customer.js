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
// Middleware để tự động cập nhật rank khách hàng khi `total_spending` thay đổi
CustomerSchema.pre('save', async function (next) {
  if (this.isModified('total_spending')) {
    try {
      // Lấy tất cả các hạng khách hàng, sắp xếp theo min_spending giảm dần
      const customerRanks = await mongoose.model('CustomerRank').find({ is_deleted: false }).sort({ min_spending: -1 });

      // Cập nhật hạng của khách hàng dựa trên tổng chi tiêu
      for (let rank of customerRanks) {
        if (this.total_spending >= rank.min_spending) {
          this.customer_rank_id = rank._id;
          break;
        }
      }
    } catch (err) {
      console.error('Lỗi khi cập nhật hạng khách hàng:', err.message);
      return next(err);
    }
  }

  next();
});

module.exports = mongoose.model('Customer', CustomerSchema);