const crypto = require('crypto');

// 32-byte key derived from PAYLOAD_ENCRYPTION_KEY or a default fallback
const RAW_KEY = process.env.PAYLOAD_ENCRYPTION_KEY || 'annseva-fps-e2e-encryption-secret-key-32';
const KEY_BUFFER = crypto.createHash('sha256').update(RAW_KEY).digest(); // exactly 32 bytes

/**
 * Encrypt string / object using AES-256-GCM
 * Output format: base64(iv):base64(ciphertext + 16_byte_tag)
 * Matches standard WebCrypto AES-GCM output in browser.
 */
function encrypt(data) {
  try {
    const text = typeof data === 'string' ? data : JSON.stringify(data);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', KEY_BUFFER, iv);
    const ciphertext = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    const combined = Buffer.concat([ciphertext, tag]);
    return iv.toString('base64') + ':' + combined.toString('base64');
  } catch (err) {
    console.error('[Encryption error]', err.message);
    throw err;
  }
}

/**
 * Decrypt string using AES-256-GCM
 * Input format: base64(iv):base64(ciphertext + 16_byte_tag)
 */
function decrypt(payload) {
  try {
    if (!payload || typeof payload !== 'string' || !payload.includes(':')) {
      throw new Error('Invalid encrypted payload format');
    }
    const [ivB64, combinedB64] = payload.split(':');
    const iv = Buffer.from(ivB64, 'base64');
    const combined = Buffer.from(combinedB64, 'base64');
    if (combined.length < 16) throw new Error('Ciphertext too short');

    const ciphertext = combined.subarray(0, combined.length - 16);
    const tag = combined.subarray(combined.length - 16);

    const decipher = crypto.createDecipheriv('aes-256-gcm', KEY_BUFFER, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    const utf8Str = decrypted.toString('utf8');
    try {
      return JSON.parse(utf8Str);
    } catch (_) {
      return utf8Str;
    }
  } catch (err) {
    console.error('[Decryption error]', err.message);
    throw err;
  }
}

/**
 * Express middleware to transparently decrypt incoming bodies and encrypt outgoing responses
 */
function encryptionMiddleware(req, res, next) {
  // If the request contains an encrypted body
  if (req.body && req.body._enc) {
    try {
      req.body = decrypt(req.body._enc);
    } catch (err) {
      return res.status(400).json({ success: false, message: 'Decryption failed: corrupted or invalid payload' });
    }
  }

  // Intercept res.json to automatically encrypt responses if client requests it or by default
  const originalJson = res.json.bind(res);
  res.json = (data) => {
    // If client requested encrypted responses via header 'x-encrypted-payload: 1'
    if (req.headers['x-encrypted-payload'] === '1' && data !== undefined) {
      try {
        const encryptedStr = encrypt(data);
        res.setHeader('x-encrypted-payload', '1');
        return originalJson({ _enc: encryptedStr });
      } catch (err) {
        console.error('[res.json encryption failed]', err);
      }
    }
    return originalJson(data);
  };

  next();
}

module.exports = {
  encrypt,
  decrypt,
  encryptionMiddleware,
};

