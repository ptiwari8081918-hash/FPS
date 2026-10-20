const jwt     = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const Session  = require('../models/Session');

const crypto = require('crypto');

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // Fail loudly at request time rather than silently signing with a
    // predictable fallback — a missing JWT_SECRET is a deploy misconfiguration.
    throw new Error('JWT_SECRET is not set');
  }
  return secret;
}

/**
 * Creates a server-side session document and returns the sessionId.
 * Call this at login time before signing the token.
 */
async function createSession(shopId, role, req) {
  const sessionId = crypto.randomUUID ? crypto.randomUUID() : uuidv4();
  await Session.create({
    sessionId,
    shopId,
    role,
    userAgent: req.headers['user-agent'] || '',
    ipAddress: req.ip || '',
    lastActiveAt: new Date(),
  });
  return sessionId;
}

/**
 * Signs a JWT that embeds the sessionId.
 * The sessionId is verified against the DB on every authenticated request.
 */
function signToken({ shopId, role, sessionId }) {
  return jwt.sign({ shopId, role, sessionId }, getSecret(), { expiresIn: '12h' });
}

/**
 * Requires a valid Bearer token AND a live server-side session.
 * Attaches req.auth = { shopId, role, sessionId, session }.
 *
 * This blocks:
 *  - Forged/tampered tokens (JWT signature check).
 *  - Requests without matching session ID.
 *  - Tokens used after logout (session deleted in DB).
 *  - Hijacked or revoked sessions.
 */
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const [scheme, headerToken] = header.split(' ');
    // Query-param fallback exists only for the CSV export link, which is
    // opened via window.open() and can't carry a custom Authorization header.
    const token = (scheme === 'Bearer' && headerToken) ? headerToken : req.query.token;
    if (!token) {
      return res.status(401).json({ success: false, message: 'Authentication required. No session or token provided.' });
    }

    // 1. Verify JWT signature & expiry
    const payload = jwt.verify(token, getSecret());
    const { shopId, role, sessionId } = payload;

    // 2. Verify the session still exists in the DB (blocks post-logout use)
    if (!sessionId) {
      return res.status(401).json({ success: false, message: 'Invalid session format. Please log in again.' });
    }

    // 3. Verify X-Session-Id header matching if provided by client
    const clientSessionId = req.headers['x-session-id'] || req.query.sessionId;
    if (clientSessionId && clientSessionId !== sessionId) {
      return res.status(401).json({ success: false, message: 'Session ID mismatch. Security check failed.' });
    }

    const session = await Session.findOne({ sessionId, shopId });
    if (!session) {
      return res.status(401).json({ success: false, message: 'Session has expired or been logged out. Please log in again.' });
    }

    // Update last activity timestamp
    session.lastActiveAt = new Date();
    await session.save().catch(() => {});

    // Echo back confirmed session ID header
    res.setHeader('X-Session-Id', sessionId);

    req.auth = { shopId, role, sessionId, session };
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired session. Please log in again.' });
  }
}

/**
 * Deletes the session from the DB.  Call at logout time.
 * After this, the JWT (even if stolen) will be refused by requireAuth.
 */
async function destroySession(sessionId) {
  if (sessionId) {
    await Session.deleteOne({ sessionId }).catch(() => {});
  }
}

module.exports = { requireAuth, signToken, createSession, destroySession };
