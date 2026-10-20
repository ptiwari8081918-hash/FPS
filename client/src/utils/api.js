import { encryptPayload, decryptPayload } from './crypto';
import { getCurrentMonthString } from './dateUtils';

const B = process.env.REACT_APP_API_URL || '/api';

export function getToken() {
  return localStorage.getItem('fps_token');
}

export function getSessionId() {
  return localStorage.getItem('fps_session_id');
}

// Set by AuthContext so a 401 here can also clear local session state.
let onUnauthorized = () => {};
export function setUnauthorizedHandler(fn) { onUnauthorized = fn; }

async function r(method, path, body) {
  const headers = {
    'Content-Type': 'application/json',
    'X-Encrypted-Payload': '1',
  };

  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const sessionId = getSessionId();
  if (sessionId) headers['X-Session-Id'] = sessionId;

  const o = { method, headers };

  if (body !== undefined && body !== null) {
    try {
      const enc = await encryptPayload(body);
      if (enc) {
        o.body = JSON.stringify({ _enc: enc });
      } else {
        o.body = JSON.stringify(body);
      }
    } catch (_) {
      o.body = JSON.stringify(body);
    }
  }

  const res = await fetch(B + path, o);
  let d = await res.json().catch(() => ({}));

  if (d && d._enc) {
    try {
      d = await decryptPayload(d._enc);
    } catch (err) {
      console.error('[Decryption failed on response]', err);
    }
  }

  if (res.status === 401) {
    onUnauthorized();
  }
  if (!res.ok) throw new Error(d.message || `Error ${res.status}`);
  return d;
}

export const api = {
  // Auth
  login:        (shopId, password)            => r('POST', '/auth/login', { shopId, password }),
  verifyShop:   (shopId)                      => r('GET',  '/auth/verify/' + shopId),
  changePassword: (currentPassword, newPassword) => r('POST', '/auth/change-password', { currentPassword, newPassword }),
  me:           ()                            => r('GET', '/auth/me'),
  logout:       ()                            => r('POST', '/auth/logout').catch(() => {}),

  // Slots
  generateSlots: (shopId, p)                  => r('POST', '/slots/' + shopId + '/generate', p),
  repeatSlots:   (shopId, p)                  => r('POST', '/slots/' + shopId + '/repeat', p),
  getSlots:      (shopId, date)               => r('GET',  '/slots/' + shopId + '?date=' + (date || '')),
  updateSlot:    (id, p)                      => r('PATCH', '/slots/' + id, p),
  deleteSlot:    (id)                         => r('DELETE', '/slots/' + id),

  // Bookings
  createBooking: (p)                          => r('POST', '/bookings', p),
  getBookings:   (shopId, date, status)       => r('GET',  `/bookings/${shopId}?date=${date || ''}${status ? '&status=' + status : ''}`),
  checkBooking:  (shopId, mobile)             => r('GET',  `/bookings/check?shopId=${shopId}&mobileNumber=${encodeURIComponent(mobile)}`),
  // Global booking status — no FPS code needed, search by mobile or ration card
  checkBookingStatus: (params)                => r('GET',  `/bookings/status?${new URLSearchParams(params).toString()}`),
  verifyRationCard:   (rationCardNumber, date, month, year) => r('POST', '/bookings/verify-card', { rationCardNumber, date, month, year }),
  cancelBooking: (id)                         => r('PATCH', '/bookings/' + id + '/cancel'),
  exportCSV:     (shopId)                     => {
    const token = getToken();
    const sessionId = getSessionId();
    const q = new URLSearchParams();
    if (token) q.set('token', token);
    if (sessionId) q.set('sessionId', sessionId);
    const qs = q.toString() ? '?' + q.toString() : '';
    window.open(B + '/bookings/' + shopId + '/export' + qs, '_blank');
  },

  // Analytics
  getAnalytics:  (shopId)                     => r('GET',  '/analytics/' + shopId),

  // FPS Records
  getDistricts:  ()                           => r('GET',  '/fps/districts'),
  getTehsils:    (district)                   => r('GET',  `/fps/tehsils?district=${encodeURIComponent(district || '')}`),
  getShopsByBlock: (district, tehsil)         => r('GET',  `/fps/shops-by-block?district=${encodeURIComponent(district || '')}&tehsil=${encodeURIComponent(tehsil || '')}`),
  getFPSData:    (shopId, month)              => r('GET',  `/fps/${shopId}/data?month=${month || getCurrentMonthString()}`),
  getReceipt:    (shopId, rationCard, month)  => r('GET',  `/fps/${shopId}/receipt?rationCard=${rationCard}&month=${month || getCurrentMonthString()}`),
  refreshFPS:    (shopId)                     => r('POST', '/fps/' + shopId + '/refresh'),
  // Live Stock & Transactions Endpoints
  getStockRegister: (shopId, month, year)     => r('POST', `/fps/${shopId}/stock-register`, { month, year }),
  getTransactions:  (shopId, month, year)     => r('POST', `/fps/${shopId}/transactions`,   { month, year }),

  // Shop settings
  updateShop:    (shopId, p)                  => r('PATCH', '/shop/' + shopId, p),

  // Payments (Razorpay)
  createPaymentOrder: ()                      => r('POST', '/payments/create-order'),
  verifyPayment:      (p)                     => r('POST', '/payments/verify', p),

  // Coins
  getCoinBalance: (shopId)                    => r('GET',  '/coins/' + shopId + '/balance'),
  claimCoins:     (shopId, p)                 => r('POST', '/coins/' + shopId + '/claim', p),

  // Feedback
  submitFeedback: (p)                         => r('POST', '/feedback', p),
  listFeedback:   (page, limit)               => r('GET',  `/feedback?page=${page || 1}&limit=${limit || 20}`),
};

