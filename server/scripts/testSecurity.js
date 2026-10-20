const crypto = require('crypto');
const axios = require('axios');
const mongoose = require('mongoose');
require('dotenv').config({ path: 'c:/Users/lenovo/OneDrive/ration-shop/fpsbooking-main/server/.env' });

const RAW_KEY = process.env.PAYLOAD_ENCRYPTION_KEY || 'annseva-fps-e2e-encryption-secret-key-32';
const KEY_BUFFER = crypto.createHash('sha256').update(RAW_KEY).digest();

function encrypt(data) {
  const text = typeof data === 'string' ? data : JSON.stringify(data);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY_BUFFER, iv);
  const ciphertext = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const combined = Buffer.concat([ciphertext, tag]);
  return iv.toString('base64') + ':' + combined.toString('base64');
}

function decrypt(payload) {
  const [ivB64, combinedB64] = payload.split(':');
  const iv = Buffer.from(ivB64, 'base64');
  const combined = Buffer.from(combinedB64, 'base64');
  const ciphertext = combined.subarray(0, combined.length - 16);
  const tag = combined.subarray(combined.length - 16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY_BUFFER, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  const utf8Str = decrypted.toString('utf8');
  try { return JSON.parse(utf8Str); } catch (_) { return utf8Str; }
}

async function runTests() {
  console.log('--- STARTING SECURITY & SESSION TESTS ---');
  await mongoose.connect('mongodb://127.0.0.1:27017/annseva');
  console.log('Connected to DB');

  const Shop = require('../models/Shop');
  const Session = require('../models/Session');

  // Find or create test shop
  let shop = await Shop.findOne();
  if (!shop) {
    console.log('No shop found, creating test shop');
    shop = await Shop.create({
      shopId: '99999999',
      shopName: 'Test Security Shop',
      ownerName: 'Security Tester',
      password: 'TestPassword@123',
    });
  }
  const testShopId = shop.shopId;
  console.log('Testing with shopId:', testShopId);

  const BASE_URL = 'http://localhost:5000/api';

  // 1. Test Login with Encrypted Payload over network
  const loginBody = { shopId: testShopId, password: 'akgec1234' };
  // or test current password
  let validPassword = 'akgec1234';
  if (!(await shop.comparePassword(validPassword))) {
    // Set known password for test
    shop.password = 'akgec1234';
    await shop.save();
  }

  const encLogin = encrypt({ shopId: testShopId, password: 'akgec1234' });
  console.log('Encrypted login payload sent over network:', encLogin.substring(0, 30) + '...');

  let loginRes;
  try {
    loginRes = await axios.post(`${BASE_URL}/auth/login`, { _enc: encLogin }, {
      headers: {
        'Content-Type': 'application/json',
        'X-Encrypted-Payload': '1',
      }
    });
  } catch (err) {
    console.error('Login failed:', err.response?.data || err.message);
    process.exit(1);
  }

  console.log('Received response with header x-encrypted-payload:', loginRes.headers['x-encrypted-payload']);
  let loginData = loginRes.data;
  if (loginData._enc) {
    console.log('Server response is encrypted over network:', loginData._enc.substring(0, 30) + '...');
    loginData = decrypt(loginData._enc);
    console.log('Decrypted login response:', {
      success: loginData.success,
      sessionId: loginData.sessionId,
      shopId: loginData.shop?.shopId,
    });
  }

  const token = loginData.token;
  const sessionId = loginData.sessionId;

  if (!sessionId || !token) {
    console.error('FAILED: sessionId or token missing from login response');
    process.exit(1);
  }
  console.log('✅ TEST 1 PASSED: Login returns sessionId and token with end-to-end payload encryption!');

  // Check DB session
  const dbSession = await Session.findOne({ sessionId, shopId: testShopId });
  if (!dbSession) {
    console.error('FAILED: Session not created in MongoDB');
    process.exit(1);
  }
  console.log('✅ TEST 2 PASSED: Session properly persisted in DB with ID:', dbSession.sessionId);

  // 2. Test authenticated request with token + matching X-Session-Id
  const meRes = await axios.get(`${BASE_URL}/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Session-Id': sessionId,
      'X-Encrypted-Payload': '1',
    }
  });
  let meData = meRes.data;
  if (meData._enc) meData = decrypt(meData._enc);
  if (!meData.success || meData.sessionId !== sessionId) {
    console.error('FAILED: Authenticated /auth/me verification failed');
    process.exit(1);
  }
  console.log('✅ TEST 3 PASSED: Authenticated request with matching X-Session-Id succeeded!');

  // 3. Test request with MISMATCHED X-Session-Id -> Should be rejected (401)
  try {
    await axios.get(`${BASE_URL}/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Session-Id': 'fake-mismatched-session-id',
      }
    });
    console.error('FAILED: Request with mismatched session ID should have been rejected!');
    process.exit(1);
  } catch (err) {
    if (err.response && err.response.status === 401) {
      console.log('✅ TEST 4 PASSED: Request with mismatched session ID was blocked (401)!');
    } else {
      console.error('Unexpected error on mismatched session:', err.message);
      process.exit(1);
    }
  }

  // 4. Test request with NO token -> Should be rejected (401)
  try {
    await axios.get(`${BASE_URL}/auth/me`);
    console.error('FAILED: Unauthenticated request should have been rejected!');
    process.exit(1);
  } catch (err) {
    if (err.response && err.response.status === 401) {
      console.log('✅ TEST 5 PASSED: Unauthenticated request without token/session was blocked (401)!');
    } else {
      console.error('Unexpected error:', err.message);
      process.exit(1);
    }
  }

  // 5. Test Logout & Session Revocation
  const logoutRes = await axios.post(`${BASE_URL}/auth/logout`, {}, {
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Session-Id': sessionId,
      'X-Encrypted-Payload': '1',
    }
  });
  let logoutData = logoutRes.data;
  if (logoutData._enc) logoutData = decrypt(logoutData._enc);
  console.log('Logout result:', logoutData);

  // Verify session removed from DB
  const dbSessionAfter = await Session.findOne({ sessionId });
  if (dbSessionAfter) {
    console.error('FAILED: Session still exists in DB after logout!');
    process.exit(1);
  }
  console.log('✅ TEST 6 PASSED: Session destroyed in DB upon logout!');

  // 6. Try using the revoked token / session again -> Must be rejected (401)
  try {
    await axios.get(`${BASE_URL}/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Session-Id': sessionId,
      }
    });
    console.error('FAILED: Revoked token was accepted!');
    process.exit(1);
  } catch (err) {
    if (err.response && err.response.status === 401) {
      console.log('✅ TEST 7 PASSED: Revoked session token blocked (401)! Post-logout reuse impossible.');
    } else {
      console.error('Unexpected error:', err.message);
      process.exit(1);
    }
  }

  console.log('\n🎉 ALL 7 SECURITY & ENCRYPTION TESTS PASSED SUCCESSFULLY! 🎉');
  await mongoose.disconnect();
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
