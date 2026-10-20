const r = require('express').Router();
const c = require('../controllers/bookingController');
const { requireAuth } = require('../middleware/auth');
const { requireOwnShop } = require('../middleware/roles');

// Public — customer-facing booking flow.
r.post('/',            c.createBooking);
r.post('/verify-card', c.verifyCardAllocation);
r.get('/verify-card',  c.verifyCardAllocation);
r.get('/status',       c.checkBookingStatus);  // Global: no shopId needed
r.get('/check',        c.checkBooking);        // Legacy: shopId required

// Owner-only.
r.get('/:shopId/export', requireAuth, requireOwnShop, c.exportBookings);
r.get('/:shopId',        requireAuth, requireOwnShop, c.getBookings);
r.patch('/:bookingId/cancel', requireAuth, c.cancelBooking); // ownership checked inside

module.exports = r;
