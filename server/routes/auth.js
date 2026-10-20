const r = require('express').Router();
const c = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');
const { loginLimiter, passwordChangeLimiter } = require('../middleware/rateLimiter');

r.post('/login', loginLimiter, c.login);
r.post('/fps-stockregister', c.getFpsStockRegister); // SmartPDS live stock register (district & block lookup)
r.get('/verify/:shopId', c.verifyShop); // public — used by the customer booking flow
r.post('/change-password', requireAuth, passwordChangeLimiter, c.changePassword);
r.get('/me', requireAuth, c.me);
r.post('/logout', requireAuth, c.logout);

module.exports = r;
