const mongoose = require('mongoose');
const SlotSchema = new mongoose.Schema({
  shopId:      { type: String, required: true, index: true },
  date:        { type: String, required: true, index: true },
  startTime:   { type: Date,   required: true },
  endTime:     { type: Date,   required: true },
  duration:    { type: Number, default: 5 },
  capacity:    { type: Number, default: 10 },
  bookedCount: { type: Number, default: 0 },
  status:      { type: String, enum: ['active','full','locked','cancelled'], default: 'active' },
  isBreak:     { type: Boolean, default: false }
}, { timestamps: true });

// High-performance compound indexes for concurrent booking and slot queries
SlotSchema.index({ shopId: 1, date: 1, status: 1 });
SlotSchema.index({ endTime: 1, status: 1 });

module.exports = mongoose.model('Slot', SlotSchema);

