const r = require('express').Router();
const c = require('../controllers/slotController');
const { requireAuth } = require('../middleware/auth');
const { requireOwnShop } = require('../middleware/roles');

// Public — the customer booking page needs to see available slots without logging in.
r.get('/:shopId', c.getSlots);

// Owner-only — writes to a shop's slots.
r.post('/:shopId/generate', requireAuth, requireOwnShop, c.generateSlots);
r.post('/:shopId/repeat',   requireAuth, requireOwnShop, c.repeatSlots);
r.patch('/:slotId',         requireAuth, c.updateSlot); // ownership checked inside (slot -> shopId)
r.delete('/:slotId',        requireAuth, c.deleteSlot); // ownership checked inside (slot -> shopId)

module.exports = r;
