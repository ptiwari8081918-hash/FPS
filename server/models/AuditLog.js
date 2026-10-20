const mongoose = require('mongoose');

const ACTIONS = [
  'LOGIN', 'LOGIN_FAILED', 'LOGOUT', 'PASSWORD_CHANGE',
  'PROFILE_UPDATE', 'BOOKING_CREATE', 'BOOKING_CANCEL',
  'SLOT_CREATE', 'SLOT_DELETE', 'UPPDS_REFRESH',
  'COIN_CLAIM', 'COIN_CLAIM_PROCESSED', 'UNAUTHORIZED_ACCESS',
];

const AuditLogSchema = new mongoose.Schema({
  shopId:    { type: String, index: true },
  action:    { type: String, enum: ACTIONS, required: true },
  metadata:  { type: mongoose.Schema.Types.Mixed, default: {} },
  ip:        { type: String },
  userAgent: { type: String },
  createdAt: { type: Date, default: Date.now },
});

// Never allow secrets/passwords to end up in metadata by accident.
AuditLogSchema.pre('save', function (next) {
  if (this.metadata && typeof this.metadata === 'object') {
    delete this.metadata.password;
    delete this.metadata.newPassword;
    delete this.metadata.currentPassword;
    delete this.metadata.token;
  }
  next();
});

module.exports = mongoose.model('AuditLog', AuditLogSchema);
module.exports.ACTIONS = ACTIONS;
