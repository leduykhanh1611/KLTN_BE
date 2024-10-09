const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema(
  {
    invoice_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
      required: true,
    },
    order_code: {
      type: Number,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    account_number: String,
    reference: String,
    transaction_date_time: {
      type: Date,
      required: true,
    },
    currency: {
      type: String,
      default: 'VND',
    },
    payment_link_id: String,
    code: String,
    desc: String,
    counter_account_bank_id: {
      type: String,
      default: null,
    },
    counter_account_bank_name: {
      type: String,
      default: null,
    },
    counter_account_name: {
      type: String,
      default: null,
    },
    counter_account_number: {
      type: String,
      default: null,
    },
    virtual_account_name: {
      type: String,
      default: null,
    },
    virtual_account_number: {
      type: String,
      default: null,
    },
    is_deleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

module.exports = mongoose.model('Payment', PaymentSchema);