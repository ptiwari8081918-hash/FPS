const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema({
  shopId:           { type: String, required: true, index: true },
  slotId:           { type: mongoose.Schema.Types.ObjectId, ref: 'Slot' },
  rationCardNumber: { type: String, required: true, uppercase: true, trim: true },
  mobileNumber:     { type: String, required: true, trim: true },
  customerName:     { type: String, default: 'Beneficiary' },
  tokenNumber:      { type: Number },
  slotDate:         { type: String, index: true },
  slotTime:         { type: String }, // Stored as IST formatted string e.g. "09:30 AM"
  status:           { type: String, enum: ['confirmed', 'completed', 'cancelled', 'missed'], default: 'confirmed' },
  paymentId:        { type: String, default: '' },
  headOfFamily:     { type: String, default: '' },
  totalMembers:     { type: Number, default: 1 },
  scheme:           { type: String, default: 'PHH' },
  entitlements:     { type: Array, default: [] },
  members:          { type: Array, default: [] },
  totalGrain:       { type: Number, default: 0 },
  distributionPeriod: { type: String, default: '' },
  reassignedDueToRaceCondition: { type: Boolean, default: false },
  originalSlotTime: { type: String, default: '' },
  raceConditionNote: { type: String, default: '' },
}, { timestamps: true });

// Compound index: prevent duplicate ration card booking per shop per day
BookingSchema.index(
  { shopId: 1, rationCardNumber: 1, slotDate: 1 },
  { unique: true, partialFilterExpression: { status: { $ne: 'cancelled' } } }
);

// Index for global status lookup by mobile
BookingSchema.index({ mobileNumber: 1, status: 1 });

// High-speed index for period duplicate check under heavy concurrent traffic
BookingSchema.index({ rationCardNumber: 1, slotDate: 1, status: 1 });

// Fast sequential token lookup index per shop per date
BookingSchema.index({ shopId: 1, slotDate: 1, tokenNumber: -1 });

module.exports = mongoose.model('Booking', BookingSchema);
