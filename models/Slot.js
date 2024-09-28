const mongoose = require('mongoose');

const SlotSchema = new mongoose.Schema(
  {
    slot_datetime: {
      type: Date,
      required: true,
    },
    duration_minutes: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      required: true,
      enum: ['available', 'booked', 'unavailable'], // Adjust as necessary
    },
    capacity: {
      type: Number,
      default: 1,
    },
    is_deleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

module.exports = mongoose.model('Slot', SlotSchema);