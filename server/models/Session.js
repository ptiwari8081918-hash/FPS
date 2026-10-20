const mongoose = require('mongoose');

/**
 * Server-side session store.
 * Every login issues a unique sessionId that is embedded inside the JWT.
 * Every request verifies the sessionId still exists in this collection.
 * Logout deletes the session document — making any stolen/copied token
 * instantly invalid even before the JWT itself expires.
 */
const SessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true, index: true },
  shopId:    { type: String, required: true, index: true },
  role:      { type: String, required: true },
  userAgent:    { type: String },
  ipAddress:    { type: String },
  lastActiveAt: { type: Date, default: Date.now },
  createdAt:    { type: Date, default: Date.now, expires: 43200 }, // auto-expire after 12 h (matches JWT)
});

module.exports = mongoose.model('Session', SessionSchema);

