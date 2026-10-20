const r = require('express').Router();
const c = require('../controllers/analyticsController');
const { requireAuth } = require('../middleware/auth');
const { requireOwnShop } = require('../middleware/roles');

r.get('/:shopId', requireAuth, requireOwnShop, c.getDashboard);

module.exports = r;
