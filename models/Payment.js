const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema(
  {
    invoice_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
      required: true,
    },
    payment_method: {
      type: String,
      required: true,
      enum: ['cash', 'credit_card', 'paypal', 'other'], // Adjust as necessary
    },
    payment_date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    amount_paid: {
      type: Number,
      required: true,
    },
    payment_status: {
      type: String,
      required: true,
      enum: ['pending', 'completed', 'failed'], // Adjust as necessary
    },
    transaction_id: String,
    is_deleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

module.exports = mongoose.model('Payment', PaymentSchema);