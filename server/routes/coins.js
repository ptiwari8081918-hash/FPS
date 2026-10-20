const r = require('express').Router();
const c = require('../controllers/coinController');
const { requireAuth } = require('../middleware/auth');
const { requireOwnShop, requireRole } = require('../middleware/roles');

// Admin routes — declared before the /:shopId routes so "admin" is never
// matched as a :shopId value.
r.get('/admin/pending', requireAuth, requireRole('ADMIN'), c.listPendingClaims);

r.get('/:shopId/balance',          requireAuth, requireOwnShop, c.getCoinBalance);
r.post('/:shopId/claim',           requireAuth, requireOwnShop, c.claimCoins);
r.patch('/:shopId/claim/:claimId', requireAuth, requireRole('ADMIN'), c.processClaim);

module.exports = r;
