const { logAction } = require('../utils/audit');

/** Restrict a route to specific roles. Must run after requireAuth. */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.auth) return res.status(401).json({ success: false, message: 'Authentication required.' });
    if (!roles.includes(req.auth.role)) {
      logAction(req, 'UNAUTHORIZED_ACCESS', { metadata: { path: req.originalUrl, requiredRoles: roles } });
      return res.status(403).json({ success: false, message: 'You do not have permission to do this.' });
    }
    next();
  };
}

/**
 * Restrict a route to the FPS owner whose shopId matches the :shopId route
 * param — unless the caller is an ADMIN. This is what stops one FPS owner
 * from reading/writing another FPS's data by editing the URL.
 */
function requireOwnShop(req, res, next) {
  if (!req.auth) return res.status(401).json({ success: false, message: 'Authentication required.' });
  if (req.auth.role === 'ADMIN') return next();
  const paramShopId = req.params.shopId;
  if (paramShopId && paramShopId !== req.auth.shopId) {
    logAction(req, 'UNAUTHORIZED_ACCESS', { metadata: { path: req.originalUrl, attemptedShopId: paramShopId } });
    return res.status(403).json({ success: false, message: 'You can only access your own FPS shop.' });
  }
  next();
}

module.exports = { requireRole, requireOwnShop };
