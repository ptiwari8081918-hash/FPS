/**
 * Client-side AES-256-GCM encryption & decryption utility.
 * Interoperable with server-side Node.js AES-256-GCM crypto.
 */

const RAW_KEY = process.env.REACT_APP_ENCRYPTION_KEY || 'annseva-fps-e2e-encryption-secret-key-32';

let cachedCryptoKey = null;

function uint8ToBase64(bytes) {
  let binary = '';
  const len = bytes.byteLength;
  const chunkSize = 0x8000;
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, chunk);
  }
  return window.btoa(binary);
}

function base64ToUint8(base64) {
  const binary = window.atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function getCryptoKey() {
  if (cachedCryptoKey) return cachedCryptoKey;
  if (!window.crypto || !window.crypto.subtle) {
    throw new Error('Web Crypto API is not available in this browser');
  }
  const encoder = new TextEncoder();
  const rawKeyBytes = encoder.encode(RAW_KEY);
  const hash = await window.crypto.subtle.digest('SHA-256', rawKeyBytes);
  cachedCryptoKey = await window.crypto.subtle.importKey(
    'raw',
    hash,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
  return cachedCryptoKey;
}

/**
 * Encrypt data (object or string) with AES-256-GCM.
 * Output format: base64(iv):base64(ciphertext + tag)
 */
export async function encryptPayload(data) {
  if (data === undefined || data === null) return data;
  try {
    const key = await getCryptoKey();
    const text = typeof data === 'string' ? data : JSON.stringify(data);
    const iv = new Uint8Array(12);
    window.crypto.getRandomValues(iv);
    const encoded = new TextEncoder().encode(text);
    const cipherBuffer = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoded
    );
    const combined = new Uint8Array(cipherBuffer);
    return uint8ToBase64(iv) + ':' + uint8ToBase64(combined);
  } catch (err) {
    console.warn('[crypto] Encrypt failed, sending raw:', err);
    return null;
  }
}

/**
 * Decrypt payload string (base64(iv):base64(ciphertext + tag)) with AES-256-GCM.
 */
export async function decryptPayload(payload) {
  if (!payload || typeof payload !== 'string' || !payload.includes(':')) {
    return payload;
  }
  try {
    const key = await getCryptoKey();
    const [ivB64, cipherB64] = payload.split(':');
    const iv = base64ToUint8(ivB64);
    const cipherBytes = base64ToUint8(cipherB64);
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      cipherBytes
    );
    const str = new TextDecoder().decode(decryptedBuffer);
    try {
      return JSON.parse(str);
    } catch (_) {
      return str;
    }
  } catch (err) {
    console.error('[crypto] Decrypt failed:', err);
    throw new Error('Failed to decrypt server response');
  }
}
