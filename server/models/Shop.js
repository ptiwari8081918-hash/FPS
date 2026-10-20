const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const ClaimSchema = new mongoose.Schema({
  method:        { type: String, enum: ['bank', 'upi', 'qr'], required: true },
  coins:         { type: Number, required: true },
  amount:        { type: Number, required: true }, // coins * 0.5
  status:        { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  // Bank fields
  bankName:      { type: String },
  accountNumber: { type: String },
  ifscCode:      { type: String },
  accountHolder: { type: String },
  // UPI fields
  upiId:         { type: String },
  // QR fields
  qrImageUrl:    { type: String },
  // Admin verification
  verified:      { type: Boolean, default: false },
  adminNote:     { type: String },
  processedAt:   { type: Date },
}, { timestamps: true });

const ShopSchema = new mongoose.Schema({
  shopId:       { type: String, required: true, unique: true, trim: true },
  shopName:     { type: String, required: true },
  ownerName:    { type: String, default: '' },
  // Always a bcrypt hash — never store or return plaintext.
  password:     { type: String, required: true, select: false },
  role:         { type: String, enum: ['FPS_OWNER', 'ADMIN'], default: 'FPS_OWNER' },
  mustChangePassword: { type: Boolean, default: true },
  passwordChangedAt:  { type: Date },
  lastLoginAt:  { type: Date },
  isActive:     { type: Boolean, default: true },
  slotDuration: { type: Number, default: 5, min: 1, max: 60 },
  slotCapacity: { type: Number, default: 10, min: 1 },
  language:     { type: String, enum: ['en', 'hi'], default: 'en' },
  // Coin system
  coins:        { type: Number, default: 0, min: 0 },
  totalCoinsEarned: { type: Number, default: 0 },
  claims:       [ClaimSchema],
  apiSnapshot: {
    fpsName: String, ownerName: String, address: String,
    district: String, block: String, village: String, mobileNo: String,
    totalCards:      { type: Number, default: 0 },
    aayCards:        { type: Number, default: 0 },
    phhCards:        { type: Number, default: 0 },
    totalTxns:       { type: Number, default: 0 },
    percentAch:      { type: Number, default: 0 },
    fingerprintTxns: { type: Number, default: 0 },
    otpTxns:         { type: Number, default: 0 },
    irisTxns:        { type: Number, default: 0 },
  },
  stockSnapshot: {
    month: String,
    year: String,
    distNameEn: String,
    afso_name_en: String,
    refreshTime: String,
    summary: { type: mongoose.Schema.Types.Mixed },
    items: { type: Array, default: [] },
    updatedAt: { type: Date, default: Date.now }
  },
  createdAt: { type: Date, default: Date.now }
});

// Hash password whenever it is set/changed. Callers set `shop.password = 'plaintext'`
// and this hook turns it into a bcrypt hash before it ever touches the DB.
ShopSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    this.password = await bcrypt.hash(this.password, 12);
    next();
  } catch (err) {
    next(err);
  }
});

ShopSchema.methods.comparePassword = function (candidate) {
  if (!this.password) return false;
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('Shop', ShopSchema);
