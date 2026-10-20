const AuditLog = require('../models/AuditLog');

/**
 * Fire-and-forget audit log write. Never throws — a logging failure
 * must never break the actual request.
 */
async function logAction(req, action, { shopId, metadata } = {}) {
  try {
    await AuditLog.create({
      shopId: shopId || req.auth?.shopId,
      action,
      metadata: metadata || {},
      ip: req.ip,
      userAgent: req.get('user-agent') || '',
    });
  } catch (err) {
    console.warn('[Audit] failed to write log:', err.message);
  }
}

module.exports = { logAction };
