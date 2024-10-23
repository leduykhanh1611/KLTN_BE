const mongoose = require('mongoose');

const PriceHeaderSchema = new mongoose.Schema(
  {
    price_list_name: {
      type: String,
      required: true,
      unique: true, // Assuming price list names are unique
    },
    start_date: {
      type: Date,
      required: true,
    },
    end_date: {
      type: Date,
      required: true,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    is_deleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

module.exports = mongoose.model('PriceHeader', PriceHeaderSchema);