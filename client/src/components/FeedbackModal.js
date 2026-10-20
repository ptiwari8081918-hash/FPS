import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';

const CATS = [
  ['general', '💬 General Feedback'],
  ['booking', '🎫 Slot Booking Experience'],
  ['distribution', '🌾 Ration Distribution'],
  ['dealer', '🏪 Fair Price Shop / Dealer'],
  ['technical', '🔧 Technical Issue / Bug'],
  ['suggestion', '💡 Suggestion / Idea'],
  ['complaint', '⚠️ Grievance / Complaint'],
];

function getClientToken() {
  try {
    let token = localStorage.getItem('annseva_client_token');
    if (!token) {
      token = 'ct_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
      localStorage.setItem('annseva_client_token', token);
    }
    return token;
  } catch (_) {
    return 'ct_fallback_' + Date.now();
  }
}

export default function FeedbackModal({ onClose, defaultShopId = '', defaultRationCard = '' }) {
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [form, setForm] = useState({
    name: '',
    mobile: '',
    email: '',
    category: 'general',
    rating: 5,
    shopId: defaultShopId,
    rationCard: defaultRationCard,
    message: '',
  });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem('annseva_feedback_submitted') === 'true') {
        setAlreadySubmitted(true);
      }
    } catch (_) {}
  }, []);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!form.name.trim()) {
      setErr('Please enter your name.');
      return;
    }
    if (!form.message.trim()) {
      setErr('Please enter your feedback message.');
      return;
    }
    if (form.mobile && !/^\d{10}$/.test(form.mobile.trim())) {
      setErr('Please enter a valid 10-digit mobile number.');
      return;
    }

    setErr('');
    setLoading(true);

    try {
      const payload = {
        name: form.name.trim(),
        mobile: form.mobile.trim() || undefined,
        email: form.email.trim() || undefined,
        category: form.category,
        rating: form.rating,
        shopId: form.shopId.trim() || undefined,
        rationCard: form.rationCard.trim() || undefined,
        message: form.message.trim(),
        clientToken: getClientToken(),
      };

      await api.submitFeedback(payload);
      try { localStorage.setItem('annseva_feedback_submitted', 'true'); } catch (_) {}
      setSuccess(true);
    } catch (error) {
      if (error.message?.includes('already') || error.message?.includes('Only one')) {
        try { localStorage.setItem('annseva_feedback_submitted', 'true'); } catch (_) {}
        setAlreadySubmitted(true);
      }
      setErr(error.message || 'Failed to submit feedback. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 540 }}>
        <div className="modal-hdr">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '1.25rem' }}>💬</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.02rem' }}>Share Your Feedback / प्रतिपुष्टि</h3>
              <p style={{ margin: 0, fontSize: '.7rem', color: 'var(--gray-500)' }}>
                Help us improve public ration distribution & booking
              </p>
            </div>
          </div>
          <button className="modal-close" onClick={onClose} title="Close">✕</button>
        </div>

        <div className="modal-body" style={{ padding: '18px 22px' }}>
          {alreadySubmitted ? (
            <div style={{ textAlign: 'center', padding: '36px 16px' }}>
              <div style={{ fontSize: '3rem', marginBottom: 12 }}>🛡️</div>
              <h3 style={{ color: 'var(--purple)', marginBottom: 8, fontSize: '1.15rem' }}>
                Feedback Already Submitted
              </h3>
              <p style={{ color: 'var(--gray-600)', fontSize: '.88rem', lineHeight: 1.6, maxWidth: 400, margin: '0 auto 18px' }}>
                You have already submitted your feedback from this device/account. To ensure authentic public reviews, only one feedback submission is permitted per citizen.
              </p>
              <div style={{ background: 'var(--gray-50)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', fontSize: '.78rem', color: 'var(--gray-500)', marginBottom: 20 }}>
                ✅ Your response has been safely recorded by AnnSeva & Food Dept.
              </div>
              <button className="btn btn-primary" onClick={onClose}>Close</button>
            </div>
          ) : success ? (
            <div style={{ textAlign: 'center', padding: '36px 16px' }}>
              <div style={{ fontSize: '3.2rem', marginBottom: 12 }}>🙏</div>
              <h3 style={{ color: 'var(--green)', marginBottom: 8, fontSize: '1.2rem' }}>
                धन्यवाद! Thank You!
              </h3>
              <p style={{ color: 'var(--gray-600)', fontSize: '.9rem', lineHeight: 1.6, maxWidth: 380, margin: '0 auto 20px' }}>
                Your valuable feedback has been securely submitted. Our team and the Department of Food & Civil Supplies appreciate your contribution.
              </p>
              <button className="btn btn-primary" onClick={onClose}>Close</button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div style={{ background: 'var(--purple-lt)', border: '1px solid rgba(124,58,237,.2)', borderRadius: 8, padding: '8px 12px', fontSize: '.75rem', color: 'var(--purple)', marginBottom: 16 }}>
                ℹ️ Note: Each user/device is permitted to submit one official feedback response.
              </div>

              {/* Name */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: '.8rem', fontWeight: 700, color: 'var(--gray-700)', display: 'block', marginBottom: 4 }}>
                  Full Name / नाम <span style={{ color: 'var(--red)' }}>*</span>
                </label>
                <input
                  type="text"
                  className="form-ctrl"
                  placeholder="Full Name"
                  value={form.name}
                  onChange={e => set('name', e.target.value)}
                  maxLength={100}
                  required
                />
              </div>

              {/* Mobile and Email row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: '.8rem', fontWeight: 700, color: 'var(--gray-700)', display: 'block', marginBottom: 4 }}>
                    Mobile Number / मोबाइल
                  </label>
                  <input
                    type="tel"
                    className="form-ctrl"
                    placeholder="10-Digit Mobile Number"
                    value={form.mobile}
                    onChange={e => set('mobile', e.target.value.replace(/\D/g, '').slice(0, 10))}
                    maxLength={10}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '.8rem', fontWeight: 700, color: 'var(--gray-700)', display: 'block', marginBottom: 4 }}>
                    Email / ईमेल (optional)
                  </label>
                  <input
                    type="email"
                    className="form-ctrl"
                    placeholder="Email Address"
                    value={form.email}
                    onChange={e => set('email', e.target.value)}
                    maxLength={200}
                  />
                </div>
              </div>

              {/* Shop ID and Ration Card row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: '.8rem', fontWeight: 700, color: 'var(--gray-700)', display: 'block', marginBottom: 4 }}>
                    FPS Shop Code (optional)
                  </label>
                  <input
                    type="text"
                    className="form-ctrl"
                    placeholder="FPS Shop ID (8 digits)"
                    value={form.shopId}
                    onChange={e => set('shopId', e.target.value)}
                    maxLength={20}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '.8rem', fontWeight: 700, color: 'var(--gray-700)', display: 'block', marginBottom: 4 }}>
                    Ration Card No. (optional)
                  </label>
                  <input
                    type="text"
                    className="form-ctrl"
                    placeholder="12-Digit Ration Card Number"
                    value={form.rationCard}
                    onChange={e => set('rationCard', e.target.value.toUpperCase())}
                    maxLength={24}
                  />
                </div>
              </div>

              {/* Category */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: '.8rem', fontWeight: 700, color: 'var(--gray-700)', display: 'block', marginBottom: 4 }}>
                  Category / श्रेणी
                </label>
                <select
                  className="form-ctrl"
                  value={form.category}
                  onChange={e => set('category', e.target.value)}
                >
                  {CATS.map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>

              {/* Star Rating */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: '.8rem', fontWeight: 700, color: 'var(--gray-700)', display: 'block', marginBottom: 4 }}>
                  Rating / रेटिंग (1–5 Stars)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {[1, 2, 3, 4, 5].map(star => (
                      <button
                        type="button"
                        key={star}
                        onClick={() => set('rating', star)}
                        style={{
                          fontSize: '1.4rem',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 2,
                          filter: form.rating >= star ? 'none' : 'grayscale(1) opacity(.35)',
                          transition: 'transform .15s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.2)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                      >
                        ⭐
                      </button>
                    ))}
                  </div>
                  <span style={{ fontSize: '.82rem', fontWeight: 700, color: 'var(--yellow)' }}>
                    {form.rating}/5
                  </span>
                </div>
              </div>

              {/* Message */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <label style={{ fontSize: '.8rem', fontWeight: 700, color: 'var(--gray-700)' }}>
                    Detailed Feedback / विवरण <span style={{ color: 'var(--red)' }}>*</span>
                  </label>
                  <span style={{ fontSize: '.72rem', color: 'var(--gray-400)' }}>
                    {form.message.length}/1000
                  </span>
                </div>
                <textarea
                  className="form-ctrl"
                  style={{ minHeight: 90, resize: 'vertical' }}
                  placeholder="Share your experience, shop timing feedback, grievance, or suggestions..."
                  value={form.message}
                  onChange={e => set('message', e.target.value)}
                  maxLength={1000}
                  required
                />
              </div>

              {err && (
                <div className="alert a-error" style={{ marginBottom: 12, fontSize: '.78rem' }}>
                  ⚠️ {err}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-outline" onClick={onClose} disabled={loading}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? '⏳ Submitting...' : '📤 Submit Feedback'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
