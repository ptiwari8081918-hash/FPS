const mongoose = require('mongoose');

const FeedbackSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true, maxlength: 100 },
  mobile:      { type: String, trim: true, maxlength: 15 },
  email:       { type: String, trim: true, lowercase: true, maxlength: 200 },
  category:    { type: String, enum: ['general', 'booking', 'distribution', 'dealer', 'technical', 'suggestion', 'complaint'], default: 'general' },
  message:     { type: String, required: true, trim: true, maxlength: 1000 },
  rating:      { type: Number, min: 1, max: 5 },
  shopId:      { type: String, trim: true }, // optional — if feedback is about a specific shop
  rationCard:  { type: String, trim: true, uppercase: true }, // optional — beneficiary ration card
  clientToken: { type: String, trim: true }, // unique device/client token
  ipAddress:   { type: String, trim: true },
}, { timestamps: true });

// Optimize query lookups and enforce fast deduplication
FeedbackSchema.index({ clientToken: 1 });
FeedbackSchema.index({ mobile: 1 });
FeedbackSchema.index({ email: 1 });
FeedbackSchema.index({ rationCard: 1 });
FeedbackSchema.index({ ipAddress: 1 });
FeedbackSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Feedback', FeedbackSchema);

