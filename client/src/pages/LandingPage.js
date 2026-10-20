import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import FeedbackModal from '../components/FeedbackModal';
import { BeneSearch } from './CustomerPage';

const API_BASE = process.env.REACT_APP_API_URL || '';

const SLIDES = [
  { img: '/slider1.jpg', tag: 'UP खाद्य एवं रसद विभाग', h: 'फोर्टिफाइड चावल से महिलाओं और बच्चों को मिल रहा पोषण', p: 'पोषक तत्वों का खजाना – फोर्टिफाइड चावल ही है खाना' },
  { img: '/slider2.jpg', tag: 'World Food Programme', h: 'स्कूलों में मध्याह्न भोजन अब हुआ और भी पौष्टिक', p: 'स्वस्थ जीवन का आधार – फोर्टिफाइड चावल का उपहार' },
  { img: '/slider3.jpg', tag: 'National Food Security Mission', h: 'Digitise Ration Distribution — Transparent & Secure', p: 'UP Government Initiative: FPS Slot Booking & Live Analytics' },
  { img: '/slider4.jpg', tag: 'Beneficiary Services', h: 'Book Your Ration Slot from Home', p: 'Say goodbye to long queues — get your token number instantly online.' },
];

const FEATS = [
  { icon: '🎫', bg: '#ede9fe', t: 'Smart Slot Booking',   hi: 'स्मार्ट बुकिंग',      d: 'Book ration collection slots online. No more long queues at FPS shops.' },
  { icon: '📊', bg: '#d1fae5', t: 'Live Distribution Analytics', hi: 'लाइव डेटा विश्लेषण', d: 'Real-time data synchronization. Day-wise & unit-wise distribution reports.' },
  { icon: '🧾', bg: '#fce7f3', t: 'Digital Receipts',     hi: 'डिजिटल रसीद',         d: 'Instant distribution receipts for every ration card — click to view and print.' },
  { icon: '🔒', bg: '#fff7ed', t: 'Fraud Prevention',     hi: 'धोखाधड़ी रोकथाम',    d: 'Auto-detect duplicate bookings. One ration card, one slot per day.' },
  { icon: '📱', bg: '#fef3c7', t: 'Mobile Friendly',      hi: 'मोबाइल फर्स्ट',       d: 'Works on any smartphone. Beneficiaries get instant token numbers.' },
  { icon: '⚡', bg: '#fee2e2', t: 'Auto Slot Scheduler',  hi: 'ऑटो शेड्यूलर',       d: 'Generate daily slots with break management. Set weekly repeat schedules.' },
];

const TERMS_CONTENT = `Terms & Conditions — AnnSeva UP FPS Portal

1. This portal is developed for educational and demonstration purposes only.
2. Data displayed is synchronized with official records.
3. Slot bookings made through this portal are for demonstration; real ration collection is governed by UP government rules.
4. Users must carry valid Aadhaar and ration cards for actual ration collection.
5. This platform does not store sensitive personal data beyond what is necessary for slot booking.
6. Any misuse of the platform will be subject to applicable laws.
7. The developer is not responsible for discrepancies between this portal and official government records.
8. For official ration-related queries, contact the UP Food & Civil Supplies Department: Helpline 1967.`;

/** Booking Status Modal — search by ration card OR mobile, no FPS code needed */
function BookingStatusModal({ onClose }) {
  const [searchType, setSearchType] = useState('mobile');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  // Track if print has been triggered to prevent duplicate prints
  const printedRef = useRef(false);

  const search = async () => {
    const trimmed = query.trim();
    if (!trimmed) { setErr('Please enter a value to search'); return; }
    if (searchType === 'mobile' && !/^\d{10}$/.test(trimmed)) {
      setErr('Enter a valid 10-digit mobile number'); return;
    }
    setErr(''); setLoading(true); setResults(null);
    try {
      const param = searchType === 'mobile'
        ? `mobileNumber=${encodeURIComponent(trimmed)}`
        : `rationCardNumber=${encodeURIComponent(trimmed.toUpperCase())}`;
      const res = await fetch(`${API_BASE}/api/bookings/status?${param}`);
      const data = await res.json();
      if (!data.success) { setErr(data.message || 'No bookings found'); setResults([]); }
      else setResults(data.bookings || []);
    } catch {
      setErr('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = (booking) => {
    if (printedRef.current) return;
    printedRef.current = true;

    const printContent = `
      <html><head><title>Booking Receipt — AnnSeva</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 32px; color: #222; }
        h2 { color: #7c3aed; margin-bottom: 4px; }
        .label { color: #666; font-size: 12px; margin-top: 10px; }
        .value { font-weight: bold; font-size: 15px; }
        .token { font-size: 40px; font-weight: 900; color: #7c3aed; margin: 16px 0; }
        .divider { border: 1px solid #eee; margin: 12px 0; }
        .footer { margin-top: 24px; font-size: 11px; color: #888; }
      </style></head>
      <body>
        <h2>🌾 AnnSeva — FPS Booking Receipt</h2>
        <p style="color:#666;margin:0 0 16px">UP Fair Price Shop Slot Booking System</p>
        <hr class="divider"/>
        <div class="label">Token Number</div>
        <div class="token">#${booking.tokenNumber}</div>
        <hr class="divider"/>
        <div class="label">Ration Card</div><div class="value">${booking.rationCardNumber}</div>
        <div class="label">Customer Name</div><div class="value">${booking.customerName || 'Beneficiary'}</div>
        <div class="label">Mobile</div><div class="value">${booking.mobileNumber}</div>
        <div class="label">FPS Shop</div><div class="value">${booking.shopName || booking.shopId}</div>
        <div class="label">FPS Code</div><div class="value">${booking.shopId}</div>
        <div class="label">Slot Date</div><div class="value">${booking.slotDate}</div>
        <div class="label">Slot Time (IST)</div><div class="value">${booking.slotTime}</div>
        ${booking.reassignedDueToRaceCondition ? `
          <div style="background:#fffbeb;border:1px solid #d97706;border-radius:6px;padding:8px 12px;margin:10px 0;font-size:11px;color:#92400e">
            ⚡ <strong>स्लॉट स्वतः-पुनर्आवंटन (Reallocation Notice):</strong><br/>
            उच्च मांग व समवर्ती बुकिंग (Race Condition) के कारण मूल समय (${booking.originalSlotTime}) भर जाने पर निकटतम उपलब्ध स्लॉट (${booking.slotTime}) स्वतः आवंटित किया गया।
          </div>
        ` : ''}
        <div class="label">Status</div><div class="value">${booking.status.toUpperCase()}</div>
        <hr class="divider"/>
        <div class="footer">
          Carry your Aadhaar &amp; Ration Card. Report to FPS shop at allotted time.<br/>
          Helpline: 1967 | Printed: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
        </div>
      </body></html>`;

    const win = window.open('', '_blank', 'width=600,height=700');
    if (win) {
      win.document.write(printContent);
      win.document.close();
      win.onload = () => { win.focus(); win.print(); printedRef.current = false; };
    } else {
      printedRef.current = false;
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 520 }}>
        <div className="modal-hdr">
          <h3>🔍 Check Booking Status</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: '.84rem', color: 'var(--gray-500)', marginBottom: 16 }}>
            Find your booking using your Ration Card Number or Mobile Number — no FPS code needed.
          </p>

          {/* Search type toggle */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            {[['mobile', '📱 Mobile Number'], ['ration', '🃏 Ration Card']].map(([v, l]) => (
              <button key={v}
                onClick={() => { setSearchType(v); setQuery(''); setErr(''); setResults(null); }}
                style={{
                  flex: 1, padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
                  fontFamily: 'var(--font)', fontSize: '.82rem', fontWeight: 700,
                  border: searchType === v ? '2px solid var(--purple)' : '1px solid var(--border)',
                  background: searchType === v ? 'var(--purple-lt)' : 'var(--white)',
                  color: searchType === v ? 'var(--purple)' : 'var(--gray-600)',
                }}>
                {l}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input
              className="form-ctrl" style={{ flex: 1 }}
              type={searchType === 'mobile' ? 'tel' : 'text'}
              maxLength={searchType === 'mobile' ? 10 : 20}
              value={query}
              onChange={e => setQuery(searchType === 'mobile' ? e.target.value : e.target.value.toUpperCase())}
              placeholder={searchType === 'mobile' ? '10-Digit Mobile Number' : '12-Digit Ration Card Number'}
              onKeyDown={e => e.key === 'Enter' && search()}
            />
            <button className="btn btn-primary" style={{ flexShrink: 0 }} onClick={search} disabled={loading}>
              {loading ? '⏳' : '🔍 Search'}
            </button>
          </div>

          {err && <div className="alert a-error" style={{ marginBottom: 8 }}>⚠️ {err}</div>}

          {results && results.length === 0 && !err && (
            <div className="alert a-warn">No active bookings found.</div>
          )}

          {results && results.length > 0 && results.map((b, i) => (
            <div key={i} style={{
              background: 'var(--gray-50)', border: '1px solid var(--border)',
              borderRadius: 12, padding: 14, marginBottom: 12,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{
                  background: 'var(--purple-lt)', border: '1px solid var(--purple)',
                  borderRadius: 8, padding: '3px 14px',
                  fontWeight: 900, fontSize: '1.1rem', color: 'var(--purple)', fontFamily: 'monospace',
                }}>
                  Token #{b.tokenNumber}
                </div>
                <span className={`badge ${b.status === 'confirmed' ? 'b-green' : 'b-gray'}`}>{b.status}</span>
              </div>
              <div style={{ fontSize: '.82rem', color: 'var(--gray-600)', lineHeight: 2 }}>
                <div>🃏 Card: <strong style={{ color: 'var(--gray-900)' }}>{b.rationCardNumber}</strong></div>
                <div>🏪 FPS Shop: <strong>{b.shopName || b.shopId}</strong></div>
                <div>🔑 FPS Code: <strong style={{ color: 'var(--purple)' }}>{b.shopId}</strong></div>
                <div>📅 Date: <strong>{b.slotDate}</strong></div>
                <div>⏰ Time (IST): <strong style={{ color: 'var(--purple)' }}>{b.slotTime}</strong></div>
                {b.reassignedDueToRaceCondition && (
                  <div style={{ marginTop: 4, background: '#fffbeb', border: '1px solid #f59e0b', borderRadius: 6, padding: '3px 8px', fontSize: '.74rem', color: '#b45309', fontWeight: 600, lineHeight: 1.4 }}>
                    ⚡ Auto-allotted nearest slot (original: {b.originalSlotTime})
                  </div>
                )}
              </div>
              <button
                className="btn btn-outline"
                style={{ width: '100%', marginTop: 10, fontSize: '.8rem', padding: '7px' }}
                onClick={() => handlePrint(b)}>
                🖨️ Print Receipt
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}



export default function LandingPage() {
  const [cur, setCur]               = useState(0);
  const [shopId, setShopId]         = useState('');
  const [showTerms, setShowTerms]   = useState(false);
  const [showStatus, setShowStatus] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showDistrictModal, setShowDistrictModal] = useState(false);
  const nav   = useNavigate();
  const timer = useRef(null);

  const goSlide = i => {
    setCur(i);
    clearInterval(timer.current);
    timer.current = setInterval(() => setCur(c => (c + 1) % SLIDES.length), 4800);
  };
  useEffect(() => {
    timer.current = setInterval(() => setCur(c => (c + 1) % SLIDES.length), 4800);
    return () => clearInterval(timer.current);
  }, []);

  const goBook = () => shopId.trim() && nav('/customer/' + shopId.trim());

  return (
    <div>
      {/* NAVBAR */}
      <nav className="navbar">
        <div className="navbar-logo">
          <div className="logo-mark">🌾</div>
          <div>
            <div className="brand">AnnSeva</div>
            <div className="tagline">UP FPS Portal · उत्तर प्रदेश</div>
          </div>
        </div>
        <div className="navbar-links">
          <button className="nav-btn" style={{ cursor: 'pointer', background: 'none', border: '1px solid var(--purple)', color: 'var(--purple)', borderRadius: 8 }} onClick={() => setShowFeedback(true)}>💬 Feedback</button>
          <Link to="/login" className="nav-btn">FPS Login</Link>
          <Link to="/login" className="nav-btn solid">Dashboard →</Link>
        </div>
      </nav>

      {/* HERO */}
      <div className="hero">
        {SLIDES.map((s, i) => (
          <div key={i} className={'slide' + (i === cur ? ' active' : '')}>
            <img
              className="slide-img"
              src={s.img}
              alt={s.h}
              loading={i === 0 ? "eager" : "lazy"}
              decoding="async"
              fetchpriority={i === 0 ? "high" : "low"}
              onError={e => { e.target.style.display = 'none'; }}
            />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg,#1a0533,#3b0764)', zIndex: -1 }} />
            <div className="slide-overlay">
              <div className="slide-content">
                <div className="slide-tag">✦ {s.tag}</div>
                <h1>{s.h}</h1>
                <p>{s.p}</p>
                <Link to="/login" className="btn btn-accent" style={{ fontSize: '.95rem', padding: '11px 26px' }}>Get Started →</Link>
              </div>
            </div>
          </div>
        ))}
        <div className="slide-dots">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              className={'slide-dot' + (i === cur ? ' active' : '')}
              onClick={() => goSlide(i)}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Book bar — fully responsive container */}
      <div className="book-bar-container">
        <div className="book-bar">
          <div className="bb-field">
            <label className="bb-label">🏪 FPS Shop Code</label>
            <input className="bb-input" value={shopId} onChange={e => setShopId(e.target.value)}
              placeholder="FPS Shop ID (8 digits)" onKeyDown={e => e.key === 'Enter' && goBook()} />
          </div>
          <div className="bb-field">
            <label className="bb-label">📅 Collection Date</label>
            <input type="date" className="bb-input" defaultValue={new Date().toISOString().slice(0, 10)} />
          </div>
          <div className="bb-actions">
            <button className="btn btn-accent bb-btn" onClick={goBook}>
              🎫 Book Slot
            </button>
            <button className="btn btn-outline bb-btn" onClick={() => setShowDistrictModal(true)}>
              🔍 Find by District
            </button>
            <button className="btn btn-outline bb-btn status-btn" onClick={() => setShowStatus(true)}>
              📋 Check Booking Status
            </button>
          </div>
        </div>
      </div>

      {/* STATS STRIP */}
      <div className="stats-strip-wrap">
        <div className="stats-strip">
          {[['80,000+', 'FPS Shops in UP'], ['1.8 Cr+', 'Ration Card Holders'], ['15 Cr+', 'Beneficiaries Served'], ['99.2%', 'Aadhaar Transactions']].map(([n, l]) => (
            <div key={l} className="ss-item"><div className="ss-num">{n}</div><div className="ss-lbl">{l}</div></div>
          ))}
        </div>
      </div>

      {/* FEATURES */}
      <div className="section">
        <div className="eyebrow">✦ Platform Features</div>
        <h2 className="sec-title">Everything your FPS shop needs</h2>
        <p className="sec-sub">Complete digital management for Uttar Pradesh Fair Price Shops</p>
        <div className="feat-grid">
          {FEATS.map((f, i) => (
            <div key={i} className="feat-card">
              <div className="feat-icon" style={{ background: f.bg }}>{f.icon}</div>
              <h3>{f.t}</h3><div className="feat-hi">{f.hi}</div><p>{f.d}</p>
            </div>
          ))}
        </div>
      </div>

      {/* HOW IT WORKS */}
      <div className="how-it-works-sec">
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div className="eyebrow">✦ Simple Process</div>
          <h2 className="sec-title">How beneficiaries book slots</h2>
          <p className="sec-sub">3 easy steps — no app download required</p>
          <div className="steps-grid">
            {[['01', '🔍', 'Find FPS Shop', 'अपनी दुकान खोजें', 'Enter your FPS code OR search by District → Tehsil → Block.'],
              ['02', '🎫', 'Choose Slot', 'स्लॉट चुनें', 'Pick a convenient time and enter your ration card number.'],
              ['03', '✅', 'Get Token', 'टोकन पाएं', 'Receive token number instantly. Show it at the FPS shop.'],
            ].map(([n, ic, t, h, d]) => (
              <div key={n} className="step-card">
                <div className="step-num">{n}</div><div className="step-icon">{ic}</div>
                <h3>{t}</h3><div className="step-hi">{h}</div><p>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* GALLERY */}
      <div className="gallery-sec">
        <div className="eyebrow" style={{ paddingTop: 44 }}>✦ Government Initiative</div>
        <h2 className="sec-title" style={{ marginBottom: 22 }}>Food Security Drive</h2>
        <div className="gallery-grid">
          <div><img src="/slider3.jpg" alt="event" loading="lazy" decoding="async" onError={e => e.target.style.display = 'none'} /></div>
          <div><img src="/slider1.jpg" alt="rice"  loading="lazy" decoding="async" onError={e => e.target.style.display = 'none'} /></div>
          <div><img src="/slider4.jpg" alt="bene"  loading="lazy" decoding="async" onError={e => e.target.style.display = 'none'} /></div>
        </div>
      </div>

      {/* FEEDBACK SECTION */}
      <div className="feedback-sec">
        <div style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
          <div className="eyebrow">✦ We Value Your Voice</div>
          <h2 className="sec-title">Share Your Feedback</h2>
          <p className="sec-sub" style={{ marginBottom: 28 }}>
            Tell us about your experience with AnnSeva — your suggestions help us serve the beneficiaries of Uttar Pradesh better.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" style={{ padding: '12px 32px', fontSize: '.95rem' }} onClick={() => setShowFeedback(true)}>
              💬 Give Feedback
            </button>
            <button className="btn btn-outline" style={{ padding: '12px 28px', fontSize: '.95rem' }} onClick={() => setShowStatus(true)}>
              📋 Check Booking Status
            </button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginTop: 32, flexWrap: 'wrap' }}>
            {[['⭐', 'Rate Experience'], ['💡', 'Suggest Features'], ['🐛', 'Report Issues'], ['🙌', 'Share Stories']].map(([ic, lb]) => (
              <div key={lb} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.6rem', marginBottom: 4 }}>{ic}</div>
                <div style={{ fontSize: '.78rem', color: 'var(--gray-600)', fontWeight: 600 }}>{lb}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="cta-band">
        <h2>Ready to modernise your FPS shop?</h2>
        <p>Join thousands of Fair Price Shops across Uttar Pradesh on AnnSeva</p>
        <div className="cta-btns">
          <Link to="/login" className="btn btn-accent" style={{ fontSize: '.95rem', padding: '12px 32px', background: '#fff', color: '#7c3aed' }}>
            🏪 FPS Shop Login
          </Link>
          <Link to="/customer" className="btn btn-ghost" style={{ fontSize: '.95rem', padding: '12px 32px', color: '#fff', borderColor: 'rgba(255,255,255,.35)' }}>
            🎫 Try as Customer
          </Link>
          <button className="btn btn-ghost" style={{ fontSize: '.95rem', padding: '12px 32px', color: '#fff', borderColor: 'rgba(255,255,255,.35)' }}
            onClick={() => setShowDistrictModal(true)}>
            🔍 Find Shop by District
          </button>
          <button className="btn btn-ghost" style={{ fontSize: '.95rem', padding: '12px 32px', color: '#fff', borderColor: 'rgba(255,255,255,.55)', background: 'rgba(255,255,255,.08)' }}
            onClick={() => setShowStatus(true)}>
            📋 Check Booking Status
          </button>
          <button className="btn btn-ghost" style={{ fontSize: '.95rem', padding: '12px 32px', color: '#fff', borderColor: 'rgba(255,255,255,.55)', background: 'rgba(255,255,255,.12)' }}
            onClick={() => setShowFeedback(true)}>
            💬 Give Feedback
          </button>
        </div>
      </div>

      {/* FOOTER */}
      <footer className="site-footer">
        <div className="footer-top">
          <div className="footer-brand">
            <div className="fb-logo">
              <div className="fb-icon">🌾</div>
              <div className="fb-name">AnnSeva</div>
            </div>
            <p>FPS Distribution Dashboard — Real-time ration analytics for Fair Price Shops across Uttar Pradesh. Built to digitise and streamline the public distribution system.</p>
          </div>
          <div className="footer-col">
            <h4>Quick Links</h4>
            <Link to="/login">FPS Login</Link>
            <Link to="/customer">Book Slot</Link>
            <span onClick={() => setShowDistrictModal(true)} style={{ cursor: 'pointer' }}>Find Shop by District</span>
            <Link to="/login">Dashboard</Link>
          </div>
          <div className="footer-col">
            <h4>Support</h4>
            <p>Helpline: <strong style={{ color: '#c084fc' }}>1967</strong> (Toll Free)</p>
            <p>PDS Helpline: <strong style={{ color: '#c084fc' }}>1967</strong></p>
          </div>
          <div className="footer-col">
            <h4>Developer</h4>
            <div className="footer-dev">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--grad)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#fff', fontSize: '.85rem' }}>PT</div>
                <div className="dev-name">Pranjal Tiwari</div>
              </div>
              <div className="dev-email">✉ pranjal2410217@akgec.ac.in</div>
              <div className="dev-college">AKGEC — Ajay Kumar Garg Engineering College</div>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <p>© 2026 AnnSeva — UP FPS Distribution Portal · खाद्य एवं रसद विभाग, उत्तर प्रदेश सरकार</p>
          <div style={{ display: 'flex', gap: 16 }}>
            <span className="tc" onClick={() => setShowTerms(true)}>Terms &amp; Conditions</span>
            <span className="tc">Privacy Policy</span>
          </div>
        </div>
      </footer>

      {/* Terms Modal */}
      {showTerms && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowTerms(false)}>
          <div className="modal-box">
            <div className="modal-hdr">
              <h3>📄 Terms &amp; Conditions</h3>
              <button className="modal-close" onClick={() => setShowTerms(false)}>✕</button>
            </div>
            <div className="modal-body">
              <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '.84rem', color: 'var(--gray-600)', lineHeight: 1.75 }}>{TERMS_CONTENT}</pre>
            </div>
          </div>
        </div>
      )}

      {/* Booking Status Modal */}
      {showStatus && <BookingStatusModal onClose={() => setShowStatus(false)} />}

      {/* Search by District & Block Modal */}
      {showDistrictModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowDistrictModal(false)}>
          <div className="modal-box" style={{ maxWidth: 820, maxHeight: '90vh' }}>
            <div className="modal-hdr">
              <h3>🔍 Find FPS Shop by District &amp; Block</h3>
              <button className="modal-close" onClick={() => setShowDistrictModal(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ padding: 16 }}>
              <BeneSearch onBook={id => { setShowDistrictModal(false); nav('/customer/' + id); }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
