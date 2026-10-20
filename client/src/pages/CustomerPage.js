import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { getCurrentMonthString } from '../utils/dateUtils';
import FeedbackModal from '../components/FeedbackModal';

const S = { VERIFY: 'verify', SLOTS: 'slots', FORM: 'form', PAYMENT: 'payment', CONFIRM: 'confirm' };
const MONTH = getCurrentMonthString();

function loadRazorpayScript() {
  return new Promise(resolve => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

// Exact 39 LinkWell UP districts
const UP_DISTRICTS_FALLBACK = [
  'AGRA', 'ALIGARH', 'AMROHA', 'BAGHPAT', 'BAHRAICH', 'BALRAMPUR', 'BAREILLY',
  'BASTI', 'BIJNOR', 'BUDAUN', 'BULANDSHAHAR', 'ETAH', 'FIROZABAD',
  'GAUTAM BUDDHA NAGAR', 'GHAZIABAD', 'GONDA', 'HAPUR', 'HARDOI', 'HATHRAS',
  'KASGANJ', 'KHERI', 'LUCKNOW', 'MAINPURI', 'MATHURA', 'MEERUT', 'MORADABAD',
  'MUZAFFARNAGAR', 'PILIBHIT', 'RAE BARELI', 'RAMPUR', 'SAHARANPUR', 'SAMBHAL',
  'SANT KABIR NAGAR', 'SHAHJAHANPUR', 'SHAMLI', 'SHRAVASTI', 'SIDDHARTHNAGAR',
  'SITAPUR', 'UNNAO'
];

export function BeneSearch({ onBook, compact = false }) {
  const [districts, setDistricts] = useState([]);
  const [tehsils, setTehsils] = useState([]);
  const [fps, setFps] = useState([]);
  const [selDist, setSelDist] = useState('');
  const [selTeh, setSelTeh] = useState('');
  const [selFps, setSelFps] = useState('');
  const [shopFilter, setShopFilter] = useState('');
  const [loadDist, setLoadDist] = useState(false);
  const [loadTeh, setLoadTeh] = useState(false);
  const [loadFps, setLoadFps] = useState(false);
  const [err, setErr] = useState('');

  // 1. Fetch District dropdown via STATE API
  useEffect(() => {
    setLoadDist(true); setErr('');
    api.getDistricts()
      .then(d => {
        const list = Array.isArray(d) ? d : (d.districts || d.rows || []);
        const names = list.map(x => typeof x === 'string' ? x : (x.geography || x.district || '')).filter(Boolean);
        const unique = Array.from(new Set(names.length > 0 ? names : UP_DISTRICTS_FALLBACK));
        unique.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
        setDistricts(unique);
      })
      .catch(() => {
        // Safe offline / upstream fallback: exact LinkWell districts sorted alphabetically
        setDistricts([...UP_DISTRICTS_FALLBACK].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })));
      })
      .finally(() => setLoadDist(false));
  }, []);

  // 2. Fetch Block dropdown via DISTRICT API (geography = selectedDistrict)
  const loadTehsils = (dist) => {
    setSelDist(dist); setTehsils([]); setFps([]); setSelTeh(''); setSelFps(''); setShopFilter('');
    if (!dist) return;
    setLoadTeh(true); setErr('');
    api.getTehsils(dist)
      .then(d => {
        const list = Array.isArray(d) ? d : (d.tehsils || d.blocks || d.rows || []);
        const names = list.map(x => typeof x === 'string' ? x : (x.geography || x.tehsilName || '')).filter(Boolean);
        const unique = Array.from(new Set(names));
        unique.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
        setTehsils(unique);
      })
      .catch(() => setErr('Failed to load blocks for selected district.'))
      .finally(() => setLoadTeh(false));
  };

  // 3. Fetch FPS Shops via TEHSIL API (geography = selectedBlock@selectedDistrict)
  const loadFPS = (teh) => {
    setSelTeh(teh); setFps([]); setSelFps(''); setShopFilter('');
    if (!teh) return;
    setLoadFps(true); setErr('');
    api.getShopsByBlock(selDist, teh)
      .then(d => {
        const list = Array.isArray(d) ? d : (d.shops || d.rows || []);
        // Sort shops in ascending alphabetical order (A to Z)
        list.sort((a, b) => {
          const nameA = (a.fpsName || a.shopName || '').trim();
          const nameB = (b.fpsName || b.shopName || '').trim();
          const cmp = nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
          if (cmp !== 0) return cmp;
          return String(a.geography || a.fpsId || '').localeCompare(String(b.geography || b.fpsId || ''));
        });
        setFps(list);
      })
      .catch(() => setErr('Failed to load FPS shops.'))
      .finally(() => setLoadFps(false));
  };

  const handleSelectFpsChange = (val) => {
    setSelFps(val);
  };

  const handleProceedWithSelectedFps = () => {
    if (selFps) {
      onBook(String(selFps));
    }
  };

  const filteredShops = fps.filter(s => {
    if (!shopFilter.trim()) return true;
    const q = shopFilter.toLowerCase().trim();
    const name = (s.fpsName || s.shopName || '').toLowerCase();
    const id = String(s.geography || s.fpsId || '').toLowerCase();
    const owner = (s.ownerName || '').toLowerCase();
    return name.includes(q) || id.includes(q) || owner.includes(q);
  });

  return (
    <div className="bene-search-section">
      <div className="bene-search-hdr">
        <h3>🔍 Find My FPS Shop / अपनी उचित दर दुकान खोजें</h3>
        <p>Step 1: Select District → Step 2: Select Block → Step 3: Select Fair Price Shop (FPS)</p>
      </div>
      <div className="bene-search-body">
        {err && <div className="alert a-error">⚠️ {err}</div>}
        <div className="bene-selects">
          {/* Dropdown 1: District */}
          <div>
            <label className="form-label">
              📍 1. District / जिला {districts.length > 0 && `(${districts.length})`}
            </label>
            <select
              className="form-ctrl"
              value={selDist}
              onChange={e => loadTehsils(e.target.value)}
              disabled={loadDist}
            >
              <option value="">{loadDist ? '⏳ Loading Districts...' : 'Select District / जिला चुनें'}</option>
              {districts.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          {/* Dropdown 2: Block */}
          <div>
            <label className="form-label">
              🏘️ 2. Block/Tehsil / ब्लॉक {tehsils.length > 0 && `(${tehsils.length})`}
            </label>
            <select
              className="form-ctrl"
              value={selTeh}
              onChange={e => loadFPS(e.target.value)}
              disabled={!selDist || loadTeh}
            >
              <option value="">
                {loadTeh
                  ? '⏳ Loading Blocks...'
                  : selDist
                    ? 'Select Block / ब्लॉक चुनें'
                    : '— Select District first —'}
              </option>
              {tehsils.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Dropdown 3: FPS Shop */}
          <div>
            <label className="form-label">
              🏪 3. FPS Shop / दुकान {fps.length > 0 && `(${fps.length})`}
            </label>
            <select
              className="form-ctrl"
              value={selFps}
              onChange={e => handleSelectFpsChange(e.target.value)}
              disabled={!selTeh || loadFps || fps.length === 0}
            >
              <option value="">
                {loadFps
                  ? '⏳ Loading Shops...'
                  : selTeh
                    ? fps.length > 0
                      ? 'Select FPS Shop / दुकान चुनें'
                      : 'No shops found'
                    : '— Select Block first —'}
              </option>
              {fps.map((s, idx) => {
                const sId = String(s.geography || s.fpsId);
                const sName = s.fpsName || s.shopName || `FPS Shop ${sId}`;
                return (
                  <option key={sId || idx} value={sId}>
                    {sId} — {sName}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* Action button if shop is picked from dropdown */}
        {selFps && (
          <div style={{ margin: '6px 0 16px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              className="btn btn-primary"
              style={{ padding: '9px 20px', fontSize: '.88rem', fontWeight: 700 }}
              onClick={handleProceedWithSelectedFps}
            >
              🎫 Proceed to Book Slot with FPS #{selFps} →
            </button>
            <span style={{ fontSize: '.78rem', color: 'var(--gray-600)' }}>
              Selected: <strong>{fps.find(f => String(f.geography || f.fpsId) === selFps)?.fpsName || selFps}</strong>
            </span>
          </div>
        )}

        {loadFps && (
          <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--purple)', fontSize: '.88rem', fontWeight: 600 }}>
            <div className="spinner" style={{ margin: '0 auto 8px', width: 22, height: 22 }} />
            ⏳ Loading shops for {selTeh}, {selDist}...
          </div>
        )}

        {/* FPS Shops list cards */}
        {fps.length > 0 && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, margin: '14px 0 10px', paddingTop: 10, borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: '.84rem', color: 'var(--gray-800)', fontWeight: 700 }}>
                🏪 {fps.length} FPS shops found in {selTeh}, {selDist} <span style={{ fontSize: '.72rem', color: 'var(--gray-500)', fontWeight: 500 }}>(Sorted A → Z)</span>
              </div>
              <div style={{ width: '100%', maxWidth: 280 }}>
                <input
                  type="text"
                  className="form-ctrl"
                  placeholder="🔎 Filter shop by name / ID..."
                  value={shopFilter}
                  onChange={e => setShopFilter(e.target.value)}
                  style={{ padding: '6px 10px', fontSize: '.8rem' }}
                />
              </div>
            </div>

            {filteredShops.length === 0 ? (
              <div className="alert a-warn" style={{ marginTop: 8 }}>
                No shops match "{shopFilter}". Try searching by shop code or another keyword.
              </div>
            ) : (
              <div className="bene-shop-list">
                {filteredShops.map((shop, i) => {
                  const sId = String(shop.geography || shop.fpsId);
                  const isSelected = selFps === sId;
                  return (
                    <div
                      key={sId || i}
                      className="bene-shop-card"
                      style={isSelected ? { borderColor: 'var(--purple)', background: 'var(--purple-lt)', boxShadow: '0 0 0 2px var(--purple)' } : {}}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6, marginBottom: 4 }}>
                        <span className="bsc-fps">FPS ID: <strong>{sId}</strong></span>
                        {shop.isRegistered ? (
                          <span className="badge b-green" style={{ fontSize: '.62rem', padding: '2px 6px' }}>
                            ✓ AnnSeva Partner
                          </span>
                        ) : (
                          <span className="badge b-gray" style={{ fontSize: '.62rem', padding: '2px 6px' }}>
                            Verified Shop
                          </span>
                        )}
                      </div>
                      <div className="bsc-name" title={shop.fpsName || shop.shopName}>
                        {shop.fpsName || shop.shopName || 'FPS Shop'}
                      </div>
                      {shop.totalCards > 0 && (
                        <div style={{ fontSize: '.72rem', color: 'var(--gray-600)', marginBottom: 4 }}>
                          🃏 Cards: <strong>{shop.totalCards}</strong>
                          {shop.aayCards ? ` (AAY: ${shop.aayCards}, PHH: ${shop.phhCards})` : ''}
                        </div>
                      )}
                      {shop.ownerName && (
                        <div style={{ fontSize: '.72rem', color: 'var(--gray-500)', marginBottom: 4 }}>
                          👤 {shop.ownerName}
                        </div>
                      )}
                      <button
                        className="bsc-book-btn"
                        onClick={() => onBook(sId)}
                      >
                        🎫 Book Slot →
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {selTeh && !loadFps && fps.length === 0 && (
          <div className="alert a-warn" style={{ marginTop: 8 }}>
            No FPS shops listed for selected Block. You can directly enter your 8-digit FPS code above.
          </div>
        )}
      </div>
    </div>
  );
}

export default function CustomerPage() {
  const { shopId: paramShopId } = useParams();
  const navigate = useNavigate();
  const [shopId, setShopId] = useState(paramShopId || '');
  const [step, setStep] = useState(S.VERIFY);
  const [shop, setShop] = useState(null);
  const [slots, setSlots] = useState([]);
  const [sel, setSel] = useState(null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [form, setForm] = useState({ rationCardNumber: '', mobileNumber: '', customerName: '' });
  const [booking, setBooking] = useState(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('book');
  const [chkMob, setChkMob] = useState('');
  const [myBks, setMyBks] = useState(null);
  const [chkLoad, setChkLoad] = useState(false);
  const [showSearch, setShowSearch] = useState(!paramShopId);
  const [payLoading, setPayLoading] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  // Pre-verification states for Citizen Slot Booking
  const [cardVerification, setCardVerification] = useState(null);
  const [cardChecking, setCardChecking] = useState(false);
  const [cardConfirmed, setCardConfirmed] = useState(false);
  const [cardCheckErr, setCardCheckErr] = useState('');
  // Ref to prevent duplicate print triggers
  const printedRef = useRef(false);

  /** Print receipt in a new window — complete official government token */
  const handlePrint = () => {
    if (printedRef.current) return;
    printedRef.current = true;

    const b = booking || {};
    const hof = b.headOfFamily || cardVerification?.headOfFamily || (cardVerification?.members?.[0]?.name) || 'Primary Cardholder';
    const totMem = b.totalMembers || cardVerification?.totalMembers || cardVerification?.members?.length || 1;
    const cardScheme = b.scheme || cardVerification?.scheme || 'PHH';
    const ents = (b.entitlements && b.entitlements.length > 0) ? b.entitlements : (cardVerification?.entitlements || []);
    const mems = (b.members && b.members.length > 0) ? b.members : (cardVerification?.members || []);
    const totGrn = b.totalGrain || cardVerification?.totalGrain || ents.reduce((acc, e) => acc + (parseFloat(e.qty) || 0), 0);

    const entitlementsRows = ents.length > 0 ? ents.map(e => `
      <tr style="border-bottom:1px solid #e2e8f0">
        <td style="padding:7px 10px;font-weight:700;color:#1e293b">${e.commodity}</td>
        <td style="padding:7px 10px;text-align:center;font-weight:800;color:#7c3aed;font-size:14px">${e.qty} ${e.unit || 'KG'}</td>
        <td style="padding:7px 10px;text-align:right;color:#64748b;font-size:12px">${e.month || 'Current Month'}</td>
      </tr>
    `).join('') : `
      <tr><td colspan="3" style="padding:8px;text-align:center;color:#64748b">As per monthly NFSA entitlement</td></tr>
    `;

    const membersRows = mems.length > 0 ? mems.map((m, idx) => `
      <tr style="border-bottom:1px solid #f1f5f9">
        <td style="padding:6px 8px;color:#94a3b8;font-size:11px">${idx + 1}</td>
        <td style="padding:6px 8px;font-weight:600;color:#1e293b">
          ${m.name || 'Member'}
          ${m.name === hof ? '<span style="color:#d97706;font-size:10px;font-weight:bold;background:#fef3c7;padding:1px 6px;border-radius:4px;margin-left:6px">मुखिया / HOF</span>' : ''}
        </td>
        <td style="padding:6px 8px;text-align:center;color:#475569">${m.age ? m.age + ' yrs' : '—'}</td>
        <td style="padding:6px 8px;text-align:center;color:#475569">${m.gender || '—'}</td>
        <td style="padding:6px 8px;color:#059669;font-family:monospace;font-size:11px">${m.kycUid || 'Seeded ✓'}</td>
      </tr>
    `).join('') : `
      <tr><td colspan="5" style="padding:8px;text-align:center;color:#64748b">Beneficiary family details recorded</td></tr>
    `;

    const printContent = `
      <!DOCTYPE html>
      <html><head>
        <meta charset="utf-8" />
        <title>AnnSeva Token #${b.tokenNumber || ''} - ${b.rationCardNumber || ''}</title>
        <style>
          @page { size: A4 portrait; margin: 15mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1e293b; margin: 0; padding: 20px; font-size: 13px; line-height: 1.5; }
          .token-box { border: 2px dashed #7c3aed; background: #faf5ff; border-radius: 12px; padding: 18px; text-align: center; margin: 14px 0; }
          .token-title { font-size: 11px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; color: #7c3aed; }
          .token-big { font-size: 46px; font-weight: 900; color: #7c3aed; line-height: 1.1; margin: 6px 0; font-family: monospace; letter-spacing: 2px; }
          .badge-conf { display: inline-block; background: #dcfce7; color: #166534; font-weight: 800; padding: 3px 12px; border-radius: 50px; font-size: 12px; border: 1px solid #86efac; }
          .section-title { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #475569; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 4px; margin: 14px 0 8px; }
          .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
          .info-cell { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 10px; }
          .info-lbl { font-size: 10px; color: #64748b; font-weight: 600; text-transform: uppercase; }
          .info-val { font-size: 12.5px; font-weight: 700; color: #0f172a; margin-top: 1px; }
          table { width: 100%; border-collapse: collapse; }
          th { font-size: 11px; color: #475569; text-transform: uppercase; font-weight: 700; }
          .footer-box { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 14px; font-size: 11px; color: #475569; margin-top: 16px; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div style="text-align:center;border-bottom:2px solid #7c3aed;padding-bottom:10px">
          <div style="font-size:12px;font-weight:700;color:#64748b">भारत सरकार • खाद्य एवं रसद विभाग, उत्तर प्रदेश</div>
          <h2 style="margin:2px 0;color:#7c3aed;font-size:19px">🌾 AnnSeva — ई-वितरण स्लॉट टोकन (e-PDS Distribution Token)</h2>
          <div style="font-size:11px;color:#475569">Fair Price Shop Online Slot Allocation · National Food Security Act (NFSA)</div>
        </div>

        <div class="token-box">
          <div class="token-title">Official Slot Token Number / टोकन संख्या</div>
          <div class="token-big">#${b.tokenNumber || '—'}</div>
          <div><span class="badge-conf">✓ CONFIRMED & ACTIVE</span></div>
          <div style="margin-top:8px;font-size:13px;font-weight:700;color:#475569">
            📅 Slot Date: <span style="color:#0f172a">${b.slotDate || ''}</span> &nbsp;|&nbsp; 
            ⏰ Allotted Time: <span style="color:#7c3aed">${b.slotTime || ''} IST</span>
          </div>
          ${b.reassignedDueToRaceCondition ? `
            <div style="margin-top:10px;padding:8px 12px;background:#fffbeb;border:1.5px solid #d97706;border-radius:6px;font-size:11.5px;color:#92400e;text-align:left">
              <strong>⚡ स्लॉट स्वतः-पुनर्आवंटन सूचना (Concurrent Slot Reallocation Notice):</strong><br/>
              उच्च समवर्ती मांग (Race Condition) के कारण आपका मूल चयनित समय (<strong>${b.originalSlotTime}</strong>) भर जाने पर व्यवस्था द्वारा निकटतम उपलब्ध स्लॉट (<strong>${b.slotTime}</strong>) स्वतः आवंटित किया गया है।<br/>
              <span style="font-size:10.5px;color:#b45309">Original slot (${b.originalSlotTime}) filled due to simultaneous booking; auto-allotted nearest available slot (${b.slotTime}).</span>
            </div>
          ` : ''}
        </div>

        <div class="section-title">📋 Ration Card & Family Details / राशन कार्ड एवं पारिवारिक विवरण</div>
        <div class="grid-2">
          <div class="info-cell">
            <div class="info-lbl">🃏 Ration Card Number / कार्ड संख्या</div>
            <div class="info-val">${b.rationCardNumber || ''}</div>
          </div>
          <div class="info-cell">
            <div class="info-lbl">🏷️ Card Scheme / योजना</div>
            <div class="info-val">${cardScheme === 'AAY' ? 'Antyodaya (AAY) - अंत्योदय' : 'Priority (PHH) - पात्र गृहस्थी'}</div>
          </div>
          <div class="info-cell">
            <div class="info-lbl">👑 Head of Family / परिवार के मुखिया</div>
            <div class="info-val" style="color:#b45309">${hof}</div>
          </div>
          <div class="info-cell">
            <div class="info-lbl">👨‍👩‍👧‍👦 Total Family Members / कुल सदस्य</div>
            <div class="info-val">${totMem} Members (सदस्य)</div>
          </div>
          <div class="info-cell">
            <div class="info-lbl">👤 Token Holder / संग्रहकर्ता</div>
            <div class="info-val">${b.customerName || hof}</div>
          </div>
          <div class="info-cell">
            <div class="info-lbl">📱 Registered Mobile / मोबाइल</div>
            <div class="info-val">${b.mobileNumber || ''}</div>
          </div>
        </div>

        <div class="section-title">🏪 Fair Price Shop Details / उचित दर दुकान विवरण</div>
        <div class="grid-2">
          <div class="info-cell">
            <div class="info-lbl">FPS Shop Name</div>
            <div class="info-val">${shop?.shopName || 'FPS Shop'}</div>
          </div>
          <div class="info-cell">
            <div class="info-lbl">FPS Shop ID / दुकान कोड</div>
            <div class="info-val">${shop?.shopId || ''}</div>
          </div>
        </div>

        <div class="section-title">📦 Allotted Ration Commodities to Collect / इस टोकन पर देय राशन सामग्री</div>
        <div style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
          <table style="background:#fff">
            <thead>
              <tr style="background:#f1f5f9;border-bottom:1.5px solid #cbd5e1;text-align:left">
                <th style="padding:7px 10px">खाद्य सामग्री (Commodity)</th>
                <th style="padding:7px 10px;text-align:center">देय मात्रा (Allotted Qty)</th>
                <th style="padding:7px 10px;text-align:right">आवंटन माह (Allotment Month)</th>
              </tr>
            </thead>
            <tbody>
              ${entitlementsRows}
              <tr style="background:#ede9fe;font-weight:bold">
                <td style="padding:8px 10px;color:#7c3aed">कुल खाद्यान्न कोटा (Total Grain)</td>
                <td style="padding:8px 10px;text-align:center;color:#7c3aed;font-size:14px">${totGrn} KG</td>
                <td style="padding:8px 10px;text-align:right;color:#7c3aed">निःशुल्क / Subs.</td>
              </tr>
            </tbody>
          </table>
        </div>

        ${mems.length > 0 ? `
          <div class="section-title">👨‍👩‍👧‍👦 Family Beneficiary Members / परिवार के सदस्य विवरण</div>
          <div style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
            <table>
              <thead>
                <tr style="background:#f1f5f9;border-bottom:1.5px solid #cbd5e1;text-align:left">
                  <th style="padding:5px 8px">#</th>
                  <th style="padding:5px 8px">सदस्य का नाम (Member Name)</th>
                  <th style="padding:5px 8px;text-align:center">आयु (Age)</th>
                  <th style="padding:5px 8px;text-align:center">लिंग (Gender)</th>
                  <th style="padding:5px 8px">आधार / KYC स्थिति</th>
                </tr>
              </thead>
              <tbody>
                ${membersRows}
              </tbody>
            </table>
          </div>
        ` : ''}

        <div class="footer-box">
          <strong>⚠️ आवश्यक निर्देश / Important Instructions:</strong><br/>
          1. कृपया अपने साथ मूल आधार कार्ड एवं राशन कार्ड अवश्य लाएं।<br/>
          2. परिवार का कोई भी सदस्य जिसका आधार कार्ड सीडेड है, ई-पॉस (ePOS) मशीन पर बायोमेट्रिक प्रमाणीकरण करके राशन प्राप्त कर सकता है।<br/>
          3. टोकन में आवंटित समय स्लॉट पर ही दुकान पर उपस्थित हों ताकि भीड़ से बचा जा सके।<br/>
          <div style="margin-top:6px;display:flex;justify-content:space-between;border-top:1px dashed #cbd5e1;padding-top:6px">
            <span>📞 हेल्पलाइन नंबर: <strong>1967 (Toll-Free)</strong> / 1800-1800-150</span>
            <span>कंप्यूटरीकृत ई-टोकन पर्ची · मुद्रण: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</span>
          </div>
        </div>
      </body></html>
    `;

    const win = window.open('', '_blank', 'width=740,height=900');
    if (win) {
      win.document.write(printContent);
      win.document.close();
      win.onload = () => { win.focus(); win.print(); printedRef.current = false; };
    } else {
      printedRef.current = false;
      alert('Please allow popups for printing, or use Ctrl+P');
    }
  };

  const verify = useCallback(async (id) => {
    const sid = (id || shopId || '').trim();
    if (!sid) return;
    setLoading(true); setErr('');
    try {
      const r = await api.verifyShop(sid);
      setShop(r); setShopId(sid); setStep(S.SLOTS); setShowSearch(false);
    } catch (e) {
      setErr(e.message || 'Shop not found. Check the FPS code.');
      setStep(S.SLOTS);
    } finally { setLoading(false); }
  }, [shopId]);

  useEffect(() => {
    if (paramShopId) verify(paramShopId);
    else setStep(S.SLOTS);
  }, [paramShopId]); // eslint-disable-line

  const loadSlots = useCallback(async () => {
    if (!shop) return;
    setLoading(true); setErr('');
    try {
      const r = await api.getSlots(shop.shopId, date);
      setSlots((r.slots || []).filter(s => !s.isBreak));
    } catch (e) { setSlots([]); }
    finally { setLoading(false); }
  }, [shop, date]);

  useEffect(() => {
    if (shop && step === S.SLOTS) loadSlots();
  }, [shop, date, step, loadSlots]);

  const handleBeneBook = (fpsCode) => navigate(`/customer/${fpsCode}`);

  const verifyCardAllocation = async (cardNo) => {
    const rc = (cardNo || form.rationCardNumber || '').trim().toUpperCase();
    if (!rc) {
      setCardCheckErr('Please enter your 12-digit ration card number');
      return;
    }
    setCardChecking(true);
    setCardCheckErr('');
    setErr('');
    setCardVerification(null);
    setCardConfirmed(false);
    try {
      const slotD = date || new Date().toISOString().slice(0, 10);
      const dObj = new Date(slotD);
      const mStr = String(dObj.getMonth() + 1).padStart(2, '0');
      const yStr = String(dObj.getFullYear());
      const res = await api.verifyRationCard(rc, slotD, mStr, yStr);
      setCardVerification(res);
      // Ensure citizen explicitly selects which family member will collect ration
      setForm(p => ({ ...p, customerName: '' }));
    } catch (e) {
      setCardCheckErr(e.message || 'Unable to verify ration card.');
    } finally {
      setCardChecking(false);
    }
  };

  const initiatePayment = async () => {
    if (!form.rationCardNumber) {
      setErr('Please enter your 12-digit ration card number');
      return;
    }
    if (!cardVerification) {
      setErr('Please click "Verify Ration Card" to verify your allocation before proceeding.');
      return;
    }
    if (cardVerification.alreadyBooked) {
      setErr('A slot is already booked for this ration card in this distribution period. Further slot booking is not permitted.');
      return;
    }
    if (cardVerification.alreadyCollected) {
      setErr('Ration has already been collected for this month. You cannot proceed with booking.');
      return;
    }
    if (!form.customerName || !form.customerName.trim()) {
      setErr('Please select a beneficiary family member who will collect the ration.');
      return;
    }
    if (cardVerification.members && cardVerification.members.length > 0) {
      const isMember = cardVerification.members.some(
        m => (m.name || '').trim().toLowerCase() === form.customerName.trim().toLowerCase()
      );
      if (!isMember) {
        setErr('Selected beneficiary must be a verified family member from your ration card list.');
        return;
      }
    }
    if (!cardConfirmed) {
      setErr('Please review and confirm your beneficiary family details first.');
      return;
    }
    if (!form.mobileNumber || form.mobileNumber.length < 10) {
      setErr('Please enter a valid 10-digit mobile number');
      return;
    }
    setPayLoading(true); setErr('');
    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) throw new Error('Payment gateway could not be loaded. Please check your internet connection.');

      const orderData = await api.createPaymentOrder();
      const options = {
        key: orderData.key,
        amount: orderData.order.amount,
        currency: 'INR',
        name: 'AnnSeva — UP FPS Portal',
        description: 'Slot Booking Fee (₹1)',
        order_id: orderData.order.id,
        handler: async (response) => {
          try {
            await api.verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            await book(response.razorpay_payment_id);
          } catch (e) {
            setErr('Payment verified but booking failed: ' + e.message);
          }
        },
        prefill: { contact: form.mobileNumber, name: form.customerName || '' },
        theme: { color: '#7c3aed' },
        modal: { ondismiss: () => { setErr('Payment was cancelled.'); setPayLoading(false); } },
      };
      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (resp) => {
        setErr('Payment failed: ' + resp.error.description);
        setPayLoading(false);
      });
      rzp.open();
    } catch (e) {
      setErr(e.message);
      setPayLoading(false);
    }
  };

  const book = async (paymentId) => {
    setLoading(true); setErr('');
    try {
      const r = await api.createBooking({
        shopId: shop.shopId,
        slotId: sel._id,
        ...form,
        paymentId: paymentId || 'N/A',
        headOfFamily: cardVerification?.headOfFamily,
        totalMembers: cardVerification?.totalMembers,
        scheme: cardVerification?.scheme,
        entitlements: cardVerification?.entitlements,
        members: cardVerification?.members,
        totalGrain: cardVerification?.totalGrain,
      });
      setBooking({
        ...r.booking,
        headOfFamily: r.booking?.headOfFamily || cardVerification?.headOfFamily,
        totalMembers: r.booking?.totalMembers || cardVerification?.totalMembers,
        scheme: r.booking?.scheme || cardVerification?.scheme,
        entitlements: (r.booking?.entitlements && r.booking.entitlements.length > 0) ? r.booking.entitlements : (cardVerification?.entitlements || []),
        members: (r.booking?.members && r.booking.members.length > 0) ? r.booking.members : (cardVerification?.members || []),
        totalGrain: r.booking?.totalGrain || cardVerification?.totalGrain,
        reassignedDueToRaceCondition: Boolean(r.booking?.reassignedDueToRaceCondition || r.reassignedDueToRaceCondition),
        originalSlotTime: r.booking?.originalSlotTime || r.originalSlotTime || '',
        raceConditionNote: r.booking?.raceConditionNote || r.raceConditionNote || '',
      });
      setStep(S.CONFIRM);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); setPayLoading(false); }
  };

  const check = async () => {
    if (!chkMob.trim()) return;
    setChkLoad(true); setErr('');
    try { const r = await api.checkBooking(shop.shopId, chkMob.trim()); setMyBks(r.bookings); }
    catch (e) { setErr(e.message); setMyBks([]); }
    finally { setChkLoad(false); }
  };

  const fmt = t => new Date(t).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true });
  const today = new Date().toISOString().slice(0, 10);
  const reset = () => {
    setStep(S.SLOTS); setBooking(null); setSel(null);
    setForm({ rationCardNumber: '', mobileNumber: '', customerName: '' }); setErr('');
    setCardVerification(null); setCardConfirmed(false); setCardCheckErr('');
  };

  return (
    <div className="cust-page">
      <div className="cust-hdr">
        <div className="cust-emblem">🌾</div>
        <h1>AnnSeva — Slot Booking</h1>
        <p>उचित मूल्य दुकान – राशन स्लॉट बुकिंग सेवा</p>
        <div style={{ marginTop: 8, display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
          {shop && <div className="cust-shop-name" style={{ marginTop: 0 }}>📍 {shop.shopName}</div>}
          <button
            onClick={() => setShowFeedback(true)}
            style={{
              background: 'rgba(255,255,255,.15)',
              border: '1px solid rgba(255,255,255,.3)',
              color: '#fff',
              borderRadius: 50,
              padding: '4px 12px',
              fontSize: '.74rem',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            💬 Feedback
          </button>
        </div>
      </div>

      <div className="cust-body">
        {step !== S.CONFIRM && (
          <button
            className="mode-btn"
            style={{
              width: '100%', marginBottom: 12,
              background: showSearch ? 'var(--grad)' : 'rgba(255,255,255,.07)',
              color: showSearch ? '#fff' : 'rgba(255,255,255,.7)',
              border: showSearch ? 'none' : '1.5px solid rgba(255,255,255,.15)',
              borderRadius: 10, padding: '10px', fontSize: '.82rem', fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
            onClick={() => setShowSearch(s => !s)}
          >
            🔍 {showSearch ? 'Hide Search' : "Don't know FPS code? Search by District/Block"}
          </button>
        )}

        {showSearch && step !== S.CONFIRM && <BeneSearch onBook={handleBeneBook} />}

        {!shop && !showSearch && (
          <div className="cust-card">
            <div className="cust-card-hdr"><h3>🏪 Enter FPS Shop Code</h3><p>अपना FPS कोड डालें</p></div>
            <div style={{ padding: 16 }}>
              <div className="form-group">
                <label className="form-label">FPS Shop ID / दुकान कोड</label>
                <input className="form-ctrl" value={shopId} onChange={e => setShopId(e.target.value)}
                  placeholder="FPS Shop ID (8 digits)" onKeyDown={e => e.key === 'Enter' && verify()} />
              </div>
              {err && <div className="alert a-error">⚠️ {err}</div>}
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => verify()} disabled={loading}>
                {loading ? '⏳ Verifying...' : '🔍 Find Shop & Book Slot'}
              </button>
            </div>
          </div>
        )}

        {shop && step !== S.CONFIRM && (
          <div className="mode-toggle">
            {[['book', '🎫 Book Slot'], ['check', '🔍 Check Booking']].map(([m, l]) => (
              <button key={m} className={`mode-btn ${mode === m ? 'active' : ''}`}
                onClick={() => { setMode(m); setErr(''); setMyBks(null); }}>
                {l}
              </button>
            ))}
          </div>
        )}

        {err && <div className="alert a-error">⚠️ {err}</div>}

        {shop && mode === 'check' && step !== S.CONFIRM && (
          <div className="cust-card">
            <div className="cust-card-hdr"><h3>🔍 Check Your Booking</h3><p>अपनी बुकिंग की जानकारी देखें</p></div>
            <div style={{ padding: 16 }}>
              <div className="form-group">
                <label className="form-label">📱 Mobile Number / मोबाइल नंबर</label>
                <input type="tel" value={chkMob} onChange={e => setChkMob(e.target.value)}
                  placeholder="10-Digit Mobile Number" className="form-ctrl" maxLength={10}
                  onKeyDown={e => e.key === 'Enter' && check()} />
              </div>
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={check} disabled={chkLoad}>
                {chkLoad ? '⏳ Checking...' : '🔍 Find My Booking'}
              </button>
              {myBks !== null && (
                <div style={{ marginTop: 16 }}>
                  {myBks.length === 0
                    ? <div className="alert a-warn">No active bookings found for this mobile number.</div>
                    : myBks.map((b, i) => (
                      <div key={i} style={{ background: 'var(--gray-50)', border: '1px solid var(--border)', borderRadius: 10, padding: 13, marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <div style={{ background: 'var(--purple-lt)', border: '1px solid var(--purple)', borderRadius: 6, padding: '2px 11px', fontWeight: 900, fontSize: '1.05rem', color: 'var(--purple)', fontFamily: 'monospace' }}>
                            Token #{b.tokenNumber}
                          </div>
                          <span className={`badge ${b.status === 'confirmed' ? 'b-green' : 'b-gray'}`}>{b.status}</span>
                        </div>
                        <div style={{ fontSize: '.82rem', color: 'var(--gray-600)', lineHeight: 1.9 }}>
                          <div>🃏 Card: <strong style={{ color: 'var(--gray-900)' }}>{b.rationCardNumber}</strong></div>
                          <div>📅 Date: <strong>{b.slotDate}</strong></div>
                          <div>⏰ Time: <strong style={{ color: 'var(--purple)' }}>{b.slotTime}</strong></div>
                        </div>
                      </div>
                    ))
                  }
                </div>
              )}
            </div>
          </div>
        )}

        {loading && !shop && (
          <div style={{ textAlign: 'center', padding: 56 }}>
            <div className="spinner" style={{ margin: '0 auto 14px' }} />
            <p style={{ color: 'rgba(255,255,255,.75)' }}>Verifying shop...</p>
          </div>
        )}

        {shop && mode === 'book' && step === S.SLOTS && (
          <div className="booking-section-wrap">
            <div className="cust-card" style={{ margin: 0 }}>
              <div className="cust-card-hdr">
                <h3>📅 Choose Your Time Slot</h3>
                <p>अपना समय स्लॉट चुनें — {shop?.shopName}</p>
              </div>
              <div style={{ padding: 16 }}>
                <div className="form-group">
                  <label className="form-label">📅 Collection Date / संग्रह तिथि</label>
                  <input type="date" value={date} min={today} className="form-ctrl"
                    onChange={e => { setDate(e.target.value); setSel(null); }} />
                </div>
                {loading
                  ? <div className="loader"><div className="spinner" /></div>
                  : slots.length === 0
                    ? (
                      <div style={{ textAlign: 'center', padding: '28px 16px', color: 'var(--gray-500)' }}>
                        <div style={{ fontSize: '2.5rem', marginBottom: 10 }}>⏱️</div>
                        <p style={{ fontWeight: 600, marginBottom: 4 }}>No slots available for this date</p>
                        <p style={{ fontSize: '.82rem' }}>Try a different date or contact your FPS shop</p>
                      </div>
                    ) : (
                      <>
                        <div style={{ display: 'flex', gap: 10, fontSize: '.7rem', marginBottom: 10, color: 'rgba(255,255,255,.6)', flexWrap: 'wrap' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--gray-200)' }} /> Available</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--purple)' }} /> Selected</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4, opacity: .5 }}><div style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--gray-400)' }} /> Full/Locked</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))', gap: 8, maxHeight: 340, overflowY: 'auto', padding: 4 }}>
                          {slots.map(slot => {
                            const full = slot.status === 'full' || slot.bookedCount >= slot.capacity;
                            const locked = slot.status === 'locked';
                            const isSel = sel?._id === slot._id;
                            const pct = slot.capacity > 0 ? Math.round((slot.bookedCount / slot.capacity) * 100) : 0;
                            return (
                              <div key={slot._id}
                                className={`slot-card${full ? ' sf' : ''}${locked ? ' sl' : ''}${isSel ? ' sel' : ''}`}
                                onClick={() => !full && !locked && setSel(slot)}>
                                <div className="slot-time">{fmt(slot.startTime)}</div>
                                <div className="slot-cnt">👥 {slot.bookedCount}/{slot.capacity}</div>
                                <div className="slot-bar">
                                  <div className="slot-fill" style={{ width: `${pct}%`, background: pct >= 80 ? 'var(--red)' : pct >= 50 ? 'var(--orange)' : 'var(--green)' }} />
                                </div>
                                {full && <div style={{ fontSize: '.6rem', color: 'var(--red)', marginTop: 4, fontWeight: 700 }}>FULL</div>}
                                {isSel && <div style={{ fontSize: '.6rem', color: 'var(--purple)', marginTop: 4, fontWeight: 700 }}>✓ SELECTED</div>}
                              </div>
                            );
                          })}
                        </div>
                        <button
                          className="btn btn-primary"
                          style={{ width: '100%', marginTop: 14, padding: 11, opacity: sel ? 1 : 0.5 }}
                          onClick={() => sel && setStep(S.FORM)}
                          disabled={!sel}
                        >
                          {sel ? `Continue with ${fmt(sel.startTime)} →` : 'Select a slot above to continue'}
                        </button>
                      </>
                    )
                }
              </div>
            </div>
          </div>
        )}

        {shop && mode === 'book' && step === S.FORM && (
          <div className="cust-card">
            <div className="cust-card-hdr">
              <h3>📝 Beneficiary Verification & Details</h3>
              <p>Slot: {sel && fmt(sel.startTime)} on {date} — {shop?.shopName}</p>
            </div>
            <div style={{ padding: 16 }}>
              {/* Selected Slot Information */}
              <div style={{ background: 'var(--purple-lt)', border: '1px solid var(--purple)', borderRadius: 8, padding: '10px 13px', marginBottom: 14, display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ fontSize: '1.2rem' }}>🎫</span>
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--purple)', fontSize: '.84rem' }}>{sel && fmt(sel.startTime)} – {sel && fmt(sel.endTime)}</div>
                  <div style={{ fontSize: '.7rem', color: 'var(--gray-500)' }}>Date: {date} · {sel ? sel.capacity - sel.bookedCount : 0} seats remaining</div>
                </div>
              </div>

              {/* Step 1: 12-Digit Ration Card Input & Allocation Verification */}
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">
                  🃏 12-Digit Ration Card Number / राशन कार्ड संख्या
                  <span style={{ color: 'var(--red)' }}> *</span>
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    value={form.rationCardNumber}
                    maxLength={16}
                    onChange={e => {
                      const v = e.target.value.toUpperCase();
                      setForm(p => ({ ...p, rationCardNumber: v }));
                      if (cardVerification || cardCheckErr) {
                        setCardVerification(null);
                        setCardConfirmed(false);
                        setCardCheckErr('');
                      }
                    }}
                    onKeyDown={e => e.key === 'Enter' && verifyCardAllocation()}
                    placeholder="12-Digit Ration Card Number"
                    className="form-ctrl"
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => verifyCardAllocation()}
                    disabled={cardChecking || !form.rationCardNumber.trim()}
                    style={{ whiteSpace: 'nowrap', padding: '8px 14px', fontSize: '.8rem' }}
                  >
                    {cardChecking ? '⏳ Verifying...' : '🔍 Verify Card'}
                  </button>
                </div>
                <div style={{ fontSize: '.7rem', color: 'var(--gray-500)', marginTop: 4 }}>
                  Verifies monthly quota and ensures ration has not already been collected.
                </div>
              </div>

              {/* Card Checking Loader */}
              {cardChecking && (
                <div style={{ textAlign: 'center', padding: '16px', background: 'var(--blue-light)', border: '1px solid var(--blue-mid)', borderRadius: 8, marginBottom: 14 }}>
                  <div className="spinner" style={{ margin: '0 auto 8px', width: 22, height: 22 }} />
                  <div style={{ fontSize: '.8rem', fontWeight: 700, color: 'var(--blue-dark)' }}>
                    Verifying allocation and entitlements...
                  </div>
                  <div style={{ fontSize: '.72rem', color: 'var(--gray-500)' }}>
                    Checking family entitlement and collection records for this month
                  </div>
                </div>
              )}

              {/* Card Check Error */}
              {cardCheckErr && (
                <div className="alert a-error" style={{ marginBottom: 14 }}>
                  ⚠️ {cardCheckErr}
                </div>
              )}

              {/* CASE: Slot ALREADY BOOKED this distribution period -> BLOCK BOOKING */}
              {cardVerification && cardVerification.alreadyBooked && (
                <div style={{ background: '#fffbeb', border: '1.5px solid #d97706', borderRadius: 10, padding: '14px 16px', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: '1.4rem' }}>⚠️</span>
                    <div>
                      <strong style={{ fontSize: '.92rem', color: '#92400e' }}>
                        Slot Already Booked / इस वितरण अवधि के लिए स्लॉट पहले से बुक है
                      </strong>
                      <div style={{ fontSize: '.72rem', color: '#b45309' }}>
                        Active Token Found for this Distribution Period
                      </div>
                    </div>
                  </div>
                  <p style={{ margin: '0 0 10px', fontSize: '.82rem', color: '#78350f', lineHeight: 1.5 }}>
                    {cardVerification.message}
                  </p>

                  {cardVerification.existingBooking && (
                    <div style={{ background: '#fff', borderRadius: 8, padding: '10px 12px', border: '1px solid #fcd34d', marginBottom: 10, fontSize: '.78rem', lineHeight: 1.8 }}>
                      <div>🎫 <strong>Active Token:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: '1.1rem', color: 'var(--purple)' }}>#{cardVerification.existingBooking.tokenNumber}</span></div>
                      <div>📅 <strong>Booked Slot Date:</strong> {cardVerification.existingBooking.slotDate}</div>
                      <div>⏰ <strong>Allotted Time:</strong> <strong style={{ color: 'var(--purple)' }}>{cardVerification.existingBooking.slotTime}</strong></div>
                      <div>👤 <strong>Beneficiary Name:</strong> {cardVerification.existingBooking.customerName || 'Beneficiary'}</div>
                      {cardVerification.existingBooking.headOfFamily && (
                        <div>👑 <strong>Head of Family:</strong> {cardVerification.existingBooking.headOfFamily}</div>
                      )}
                    </div>
                  )}

                  <div style={{ background: '#fef3c7', color: '#92400e', padding: '8px 12px', borderRadius: 6, fontSize: '.76rem', fontWeight: 700 }}>
                    ⛔ Each ration card is permitted only one active slot booking per distribution cycle. Please carry your existing token to the shop.
                  </div>
                </div>
              )}

              {/* CASE A: Ration ALREADY COLLECTED this month -> BLOCK FURTHER BOOKING */}
              {cardVerification && cardVerification.alreadyCollected && (
                <div style={{ background: '#fef2f2', border: '1.5px solid #ef4444', borderRadius: 10, padding: '14px 16px', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: '1.4rem' }}>🚫</span>
                    <div>
                      <strong style={{ fontSize: '.92rem', color: '#991b1b' }}>
                        Ration Already Collected / राशन पहले ही प्राप्त किया जा चुका है
                      </strong>
                      <div style={{ fontSize: '.72rem', color: '#b91c1c' }}>
                        Official Electronic Distribution Record Found
                      </div>
                    </div>
                  </div>
                  <p style={{ margin: '0 0 10px', fontSize: '.82rem', color: '#7f1d1d', lineHeight: 1.5 }}>
                    {cardVerification.message}
                  </p>

                  {cardVerification.trans && (
                    <div style={{ background: '#fff', borderRadius: 8, padding: '10px 12px', border: '1px solid #fca5a5', marginBottom: 10, fontSize: '.78rem', lineHeight: 1.8 }}>
                      <div>📅 <strong>Distribution Date:</strong> {cardVerification.trans.availDate || 'Recorded'}</div>
                      <div>👤 <strong>Availed By Member:</strong> <strong style={{ color: '#991b1b' }}>{cardVerification.trans.availedBy}</strong></div>
                      <div>👆 <strong>Authentication Mode:</strong> {cardVerification.trans.transType || 'Biometric'}</div>
                      {cardVerification.trans.commodities?.length > 0 && (
                        <div style={{ marginTop: 6 }}>
                          <strong>📦 Distributed Commodities:</strong>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                            {cardVerification.trans.commodities.map((c, i) => (
                              <span key={i} className="badge b-yellow" style={{ fontSize: '.74rem', padding: '3px 8px' }}>
                                {c.commodity}: {c.qty} {c.unit}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ background: '#fee2e2', color: '#991b1b', padding: '8px 12px', borderRadius: 6, fontSize: '.76rem', fontWeight: 700 }}>
                    ⛔ As ration for this month is already collected, you cannot proceed further with slot booking.
                  </div>
                </div>
              )}

              {/* CASE B: Ration NOT COLLECTED -> SHOW FAMILY MEMBERS & ALLOTMENT, CONFIRM THEN PROCEED */}
              {cardVerification && cardVerification.eligible && (
                <div style={{ background: '#f0fdf4', border: '1.5px solid #22c55e', borderRadius: 10, padding: '14px 16px', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: '1.2rem' }}>✅</span>
                      <div>
                        <strong style={{ fontSize: '.88rem', color: '#166534' }}>
                          Ration Allocation Verified / राशन आवंटन सत्यापित
                        </strong>
                        <div style={{ fontSize: '.68rem', color: '#15803d' }}>
                          Scheme: {cardVerification.scheme || 'NFSA'} · Status: Active
                        </div>
                      </div>
                    </div>
                    <span className="badge b-green">✓ Eligible to Collect</span>
                  </div>

                  {/* Monthly Entitlements (Wheat, Rice, Sugar) */}
                  {cardVerification.entitlements?.length > 0 && (
                    <div style={{ marginBottom: 10, background: '#fff', padding: '10px 12px', borderRadius: 8, border: '1px solid #bbf7d0' }}>
                      <div style={{ fontSize: '.72rem', color: '#166534', fontWeight: 800, textTransform: 'uppercase', marginBottom: 6 }}>
                        📦 Monthly Entitlement / राशन सामग्री कोटा:
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {cardVerification.entitlements.map((e, i) => (
                          <div key={i} style={{ background: '#dcfce7', border: '1px solid #86efac', borderRadius: 6, padding: '4px 10px', fontSize: '.78rem', fontWeight: 700, color: '#15803d' }}>
                            {e.commodity}: {e.qty} {e.unit}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Beneficiary Family Members List — Mandatory Selection */}
                  {cardVerification.members?.length > 0 && (
                    <div style={{ marginBottom: 12, background: '#fff', padding: '12px 14px', borderRadius: 8, border: form.customerName ? '1.5px solid #86efac' : '2px dashed #f59e0b' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 4 }}>
                        <div style={{ fontSize: '.74rem', color: '#166534', fontWeight: 800, textTransform: 'uppercase' }}>
                          👨‍👩‍👧‍👦 राशन लेने वाले सदस्य का चयन करें (Select Beneficiary): <span style={{ color: 'var(--red)' }}>*</span>
                        </div>
                        {form.customerName ? (
                          <span style={{ fontSize: '.72rem', background: '#dcfce7', color: '#15803d', fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>
                            ✓ चयनित: {form.customerName}
                          </span>
                        ) : (
                          <span style={{ fontSize: '.72rem', background: '#fef3c7', color: '#b45309', fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>
                            ⚠️ चयन अनिवार्य है (Selection Required)
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '.7rem', color: '#64748b', marginBottom: 8 }}>
                        दुकान पर राशन लेने जाने वाले परिवार के सदस्य के नाम पर क्लिक करें:
                      </div>
                      <div style={{ display: 'grid', gap: 6 }}>
                        {cardVerification.members.map((m, i) => {
                          const isChosen = form.customerName === m.name;
                          return (
                            <div
                              key={m.memberId || i}
                              onClick={() => {
                                setForm(p => ({ ...p, customerName: m.name }));
                                setCardCheckErr('');
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '8px 12px',
                                borderRadius: 6,
                                border: isChosen ? '2px solid #16a34a' : '1px solid #e2e8f0',
                                background: isChosen ? '#dcfce7' : '#f8fafc',
                                cursor: 'pointer',
                                fontSize: '.78rem',
                                transition: 'all .15s ease',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <input
                                  type="radio"
                                  name="selectedBeneficiaryRadio"
                                  checked={isChosen}
                                  onChange={() => {
                                    setForm(p => ({ ...p, customerName: m.name }));
                                    setCardCheckErr('');
                                  }}
                                  style={{ accentColor: '#16a34a', cursor: 'pointer' }}
                                />
                                <div>
                                  <strong style={{ color: isChosen ? '#14532d' : '#0f172a' }}>{m.name}</strong>
                                  <span style={{ color: '#64748b', marginLeft: 8 }}>
                                    {m.age ? `${m.age} वर्ष` : ''} {m.gender ? `· ${m.gender}` : ''}
                                  </span>
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                {m.kycUid && <span style={{ fontSize: '.68rem', color: '#059669', background: '#ecfdf5', padding: '1px 6px', borderRadius: 4 }}>KYC: {m.kycUid}</span>}
                                <span style={{ fontSize: '.7rem', color: isChosen ? '#166534' : '#64748b', fontWeight: 700 }}>
                                  {isChosen ? '✓ चयनित (Selected)' : 'चुनें (Select)'}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Confirmation Action */}
                  {!cardConfirmed ? (
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ width: '100%', background: '#16a34a', borderColor: '#16a34a', padding: 10, fontWeight: 700 }}
                      onClick={() => {
                        if (!form.customerName || !form.customerName.trim()) {
                          setCardCheckErr('कृपया राशन प्राप्त करने वाले परिवार के सदस्य का चयन करें (Please select a beneficiary family member above).');
                          return;
                        }
                        setCardCheckErr('');
                        setCardConfirmed(true);
                      }}
                    >
                      ✓ Confirm Details & Proceed to Booking / विवरण की पुष्टि करें
                    </button>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#dcfce7', padding: '8px 12px', borderRadius: 6, fontSize: '.76rem', color: '#166534', fontWeight: 700 }}>
                      <span>✓ राशन प्राप्तकर्ता: <strong>{form.customerName}</strong> (सत्यापित)</span>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => setCardConfirmed(false)}
                        style={{ fontSize: '.7rem', color: '#15803d', padding: '2px 6px' }}
                      >
                        बदलें / Change
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Step 2: Contact Details & Payment Confirmation (Unlocked once card is verified & confirmed) */}
              {cardConfirmed && !cardVerification?.alreadyCollected && !cardVerification?.alreadyBooked && (
                <>
                  <div className="form-group">
                    <label className="form-label">
                      📱 10-Digit Mobile Number / मोबाइल नंबर
                      <span style={{ color: 'var(--red)' }}> *</span>
                    </label>
                    <input
                      type="tel"
                      value={form.mobileNumber}
                      maxLength={10}
                      onChange={e => setForm(p => ({ ...p, mobileNumber: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                      placeholder="10-Digit Mobile Number"
                      className="form-ctrl"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      👤 Selected Beneficiary Member / राशन प्राप्तकर्ता (सत्यापित)
                      <span style={{ color: 'var(--red)' }}> *</span>
                    </label>
                    {cardVerification?.members?.length > 0 ? (
                      <select
                        className="form-ctrl"
                        value={form.customerName}
                        onChange={e => setForm(p => ({ ...p, customerName: e.target.value }))}
                        required
                        style={{ fontWeight: 600, color: 'var(--gray-900)' }}
                      >
                        <option value="">-- परिवार के सदस्य का चयन करें (Select Beneficiary) --</option>
                        {cardVerification.members.map((m, i) => (
                          <option key={m.memberId || i} value={m.name}>
                            {m.name} {m.age ? `(${m.age} वर्ष` : ''}{m.gender ? ` · ${m.gender}` : ''}{m.kycUid ? ` · KYC: ${m.kycUid})` : m.age ? ')' : ''}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={form.customerName}
                        maxLength={100}
                        onChange={e => setForm(p => ({ ...p, customerName: e.target.value }))}
                        placeholder="Beneficiary Full Name"
                        className="form-ctrl"
                        required
                      />
                    )}
                    <div style={{ fontSize: '.7rem', color: '#166534', marginTop: 4, fontWeight: 600 }}>
                      ✓ चयनित सदस्य ई-पॉस (ePOS) मशीन पर बायोमेट्रिक प्रमाणीकरण करके राशन प्राप्त कर सकते हैं।
                    </div>
                  </div>

                  <div className="alert a-info" style={{ marginBottom: 12 }}>
                    💳 A non-refundable booking fee of <strong>₹1</strong> is required to confirm your slot via Razorpay.
                  </div>
                </>
              )}

              {/* Form Action Buttons */}
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button className="btn btn-outline" onClick={() => { setStep(S.SLOTS); setErr(''); }}>← Back</button>
                {(!cardVerification || (!cardVerification.alreadyCollected && !cardVerification.alreadyBooked)) && (
                  <button
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                    onClick={initiatePayment}
                    disabled={payLoading || loading || !cardConfirmed || cardVerification?.alreadyCollected || cardVerification?.alreadyBooked}
                  >
                    {payLoading || loading ? '⏳ Processing...' : '💳 Pay ₹1 & Confirm Booking'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {step === S.CONFIRM && booking && (
          <div className="booking-confirm-print">
            {/* Big Token Display */}
            <div className="token-card" style={{ marginBottom: 14 }}>
              <div style={{ fontSize: '2.2rem', marginBottom: 6 }}>🎉</div>
              <div style={{ fontSize: '.72rem', opacity: .8, marginBottom: 5, letterSpacing: '.1em', textTransform: 'uppercase', fontWeight: 700 }}>Your Official Token Number</div>
              <div className="token-num">#{booking.tokenNumber}</div>
              <div style={{ fontSize: '.86rem', opacity: .9, marginTop: 10 }}>📅 {booking.slotDate} · ⏰ {booking.slotTime} IST</div>
              <div style={{ fontSize: '.74rem', opacity: .75, marginTop: 3 }}>📍 {shop?.shopName} (FPS Code: {shop?.shopId})</div>
              {booking.reassignedDueToRaceCondition && (
                <div style={{
                  marginTop: 14,
                  background: 'rgba(255,255,255,.18)',
                  border: '1.5px solid rgba(255,255,255,.45)',
                  borderRadius: 10,
                  padding: '10px 14px',
                  fontSize: '.82rem',
                  color: '#fff',
                  textAlign: 'left',
                  lineHeight: 1.5
                }}>
                  <div style={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span>⚡</span> <span>स्लॉट स्वतः-पुनर्आवंटन (Auto-Allotted to Nearest Slot)</span>
                  </div>
                  <div>
                    उच्च मांग के कारण आपका मूल चयनित समय (<strong>{booking.originalSlotTime}</strong>) समवर्ती बुकिंग में भर गया था। सिस्टम द्वारा आपके लिए निकटतम उपलब्ध समय (<strong>{booking.slotTime}</strong>) तुरंत सुरक्षित कर दिया गया है।
                  </div>
                  <div style={{ fontSize: '.72rem', opacity: .85, marginTop: 4 }}>
                    Notice noted on printable token receipt: Auto-reassigned due to simultaneous contention.
                  </div>
                </div>
              )}
            </div>

            <div className="cust-card">
              <div style={{ padding: 18 }}>
                {/* 1. Card & Family Summary */}
                <div style={{ background: 'var(--gray-50)', borderRadius: 10, padding: '14px', border: '1px solid var(--border)', marginBottom: 14 }}>
                  <div style={{ fontSize: '.72rem', color: 'var(--gray-500)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
                    📋 Ration Card & Family Details / राशन कार्ड एवं परिवार
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8, fontSize: '.82rem' }}>
                    <div>🃏 Card No: <strong style={{ color: 'var(--gray-900)' }}>{booking.rationCardNumber}</strong></div>
                    <div>🏷️ Scheme: <span className="badge b-yellow">{booking.scheme || 'PHH'}</span></div>
                    <div>👑 Head of Family: <strong style={{ color: 'var(--purple)' }}>{booking.headOfFamily || (booking.members?.[0]?.name) || 'Primary Cardholder'}</strong></div>
                    <div>👨‍👩‍👧‍👦 Total Members: <strong>{booking.totalMembers || (booking.members?.length) || 1} Members</strong></div>
                    <div>👤 Token Holder: <strong>{booking.customerName || 'Beneficiary'}</strong></div>
                    <div>📱 Mobile: <strong>{booking.mobileNumber}</strong></div>
                  </div>
                </div>

                {/* 2. Exact Ration Quota to Collect */}
                {((booking.entitlements && booking.entitlements.length > 0) || (cardVerification?.entitlements && cardVerification.entitlements.length > 0)) && (
                  <div style={{ background: '#f5f3ff', borderRadius: 10, padding: '14px', border: '1px solid #ddd6fe', marginBottom: 14 }}>
                    <div style={{ fontSize: '.72rem', color: '#6d28d9', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>📦 Ration Commodities to Collect / इस टोकन पर देय राशन सामग्री</span>
                      <span className="badge b-purple">Quota Verified</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
                      {(booking.entitlements?.length > 0 ? booking.entitlements : cardVerification?.entitlements || []).map((e, idx) => (
                        <div key={idx} style={{ background: '#fff', border: '1px solid #c4b5fd', borderRadius: 8, padding: '8px 12px', textAlign: 'center' }}>
                          <div style={{ fontSize: '.72rem', color: '#6d28d9', fontWeight: 600 }}>{e.commodity}</div>
                          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#4c1d95', margin: '2px 0' }}>{e.qty} {e.unit || 'KG'}</div>
                          <div style={{ fontSize: '.65rem', color: 'var(--gray-400)' }}>{e.month || 'Current Month'}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: 8, fontSize: '.75rem', color: '#5b21b6', fontWeight: 700, textAlign: 'right' }}>
                      Total Grain Quota: {booking.totalGrain || cardVerification?.totalGrain || 0} KG
                    </div>
                  </div>
                )}

                {/* 3. Family Members Breakdown */}
                {((booking.members && booking.members.length > 0) || (cardVerification?.members && cardVerification.members.length > 0)) && (
                  <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 14 }}>
                    <div style={{ background: 'var(--gray-50)', padding: '8px 12px', fontSize: '.72rem', fontWeight: 800, color: 'var(--gray-700)', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>
                      👨‍👩‍👧‍👦 Beneficiary Family Members List / परिवार के सदस्य
                    </div>
                    <div style={{ padding: '8px 12px', overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.76rem' }}>
                        <thead>
                          <tr style={{ borderBottom: '1.5px solid var(--border)', textAlign: 'left', color: 'var(--gray-500)', fontSize: '.68rem' }}>
                            <th style={{ padding: '4px' }}>#</th>
                            <th style={{ padding: '4px' }}>Name</th>
                            <th style={{ padding: '4px', textAlign: 'center' }}>Age</th>
                            <th style={{ padding: '4px', textAlign: 'center' }}>Gender</th>
                            <th style={{ padding: '4px' }}>Aadhaar / KYC</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(booking.members?.length > 0 ? booking.members : cardVerification?.members || []).map((m, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid var(--gray-100)' }}>
                              <td style={{ padding: '5px 4px', color: 'var(--gray-400)' }}>{idx + 1}</td>
                              <td style={{ padding: '5px 4px', fontWeight: 600 }}>
                                {m.name}
                                {m.name === (booking.headOfFamily || cardVerification?.headOfFamily) && (
                                  <span style={{ marginLeft: 6, fontSize: '.62rem', background: '#fef3c7', color: '#b45309', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>मुखिया / HOF</span>
                                )}
                              </td>
                              <td style={{ padding: '5px 4px', textAlign: 'center', color: 'var(--gray-600)' }}>{m.age ? `${m.age} yrs` : '—'}</td>
                              <td style={{ padding: '5px 4px', textAlign: 'center', color: 'var(--gray-600)' }}>{m.gender || '—'}</td>
                              <td style={{ padding: '5px 4px', color: '#059669', fontFamily: 'monospace' }}>{m.kycUid || 'Seeded ✓'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="alert a-info" style={{ marginBottom: 14 }}>
                  <strong>Important:</strong> Bring your Aadhaar card and Ration card. Any active family member whose Aadhaar is seeded can authenticate and collect the allotted ration at your time slot.
                </div>

                <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                  <button className="btn btn-outline" style={{ flex: 1 }} onClick={reset}>📅 Book Another</button>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={handlePrint}>🖨️ Print Complete Token</button>
                </div>
                <button
                  className="btn btn-outline"
                  style={{ width: '100%', borderColor: 'var(--purple)', color: 'var(--purple)', fontSize: '.8rem' }}
                  onClick={() => setShowFeedback(true)}
                >
                  💬 Share Your Feedback / प्रतिपुष्टि
                </button>
              </div>
            </div>
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: 18 }}>
          <Link to="/" style={{ color: 'rgba(255,255,255,.5)', fontSize: '.78rem' }}>← Back to AnnSeva Home</Link>
        </div>
      </div>

      {showFeedback && (
        <FeedbackModal
          onClose={() => setShowFeedback(false)}
          defaultShopId={shop?.shopId || paramShopId}
          defaultRationCard={booking?.rationCardNumber || form.rationCardNumber}
        />
      )}
    </div>
  );
}
