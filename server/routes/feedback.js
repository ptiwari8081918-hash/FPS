const r    = require('express').Router();
const c    = require('../controllers/feedbackController');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

// Public: anyone can submit feedback
r.post('/', c.submitFeedback);

// Admin-only: list all feedback
r.get('/', requireAuth, requireRole('ADMIN'), c.listFeedback);

module.exports = r;

