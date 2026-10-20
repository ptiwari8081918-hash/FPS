const rateLimit = require('express-rate-limit');

// Scaled general limit — protects against gross abuse/DDoS while allowing high-concurrency traffic (10,000 live users)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS',
  message: { success: false, message: 'Too many requests. Please try again shortly.' },
});

// Tight limit on login — this is the brute-force surface for shop passwords.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts. Please try again in 15 minutes.' },
});

// Tight limit on password change.
const passwordChangeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Please try again shortly.' },
});

module.exports = { generalLimiter, loginLimiter, passwordChangeLimiter };
