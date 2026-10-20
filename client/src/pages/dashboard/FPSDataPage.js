import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { api } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { getCurrentMonthString, generateMonthOptions } from '../../utils/dateUtils';

const MONTHS = generateMonthOptions(24);

const CT = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: '.78rem', boxShadow: 'var(--shadow-md)' }}>
      <div style={{ color: 'var(--gray-500)', marginBottom: 4, fontWeight: 600 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || 'var(--blue)', fontWeight: 700 }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toFixed(1) : p.value}
        </div>
      ))}
    </div>
  );
};

function getCommIcon(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('wheat')) return '🌾';
  if (n.includes('rice') || n.includes('frice')) return '🍚';
  if (n.includes('sugar')) return '🍬';
  return '📦';
}

function ReceiptModal({ receipt, onClose }) {
  const [copied, setCopied] = useState(false);

  const fmt = (d) => {
    if (!d) return '—';
    try {
      return new Date(d).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (_) {
      return String(d);
    }
  };

  const copyDetails = () => {
    const text = `AnnSeva e-PDS Receipt\nFPS: ${receipt.shopName} (${receipt.shopCode})\nRation Card: ${receipt.rationCardNo} (${receipt.cardType})\nAuth: ${receipt.authType || 'Biometric'}\nDate: ${receipt.loginTime || receipt.month}\nWheat: ${receipt.totalWheat || 0} kg | Rice: ${receipt.totalRice || 0} kg | Sugar: ${receipt.totalSugar || 0} kg\nTotal: ${receipt.totalGrain || 0} kg\nRef/Txn: ${receipt.txnId || receipt.receiptId || 'N/A'}`;
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formattedMonth = receipt.month
    ? new Date(receipt.month).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    : 'Current Allocation Month';

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 680, maxHeight: '92vh', overflowY: 'auto' }}>
        <div className="modal-hdr">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '1.2rem' }}>🧾</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '.98rem' }}>e-PDS Distribution Receipt / वितरण ई-रसीद</h3>
              <div style={{ fontSize: '.68rem', color: 'var(--gray-500)' }}>
                National Food Security Act (NFSA) · Food & Civil Supplies
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button className="btn btn-outline btn-sm btn-print-hide" onClick={copyDetails} title="Copy Details">
              {copied ? '✓ Copied' : '📋 Copy'}
            </button>
            <button className="btn btn-primary btn-sm btn-print-hide" onClick={() => window.print()} title="Print Receipt">
              🖨️ Print
            </button>
            <button className="modal-close btn-print-hide" onClick={onClose} title="Close">✕</button>
          </div>
        </div>

        <div className="modal-body">
          <div className="receipt">
            {/* Government Official Header */}
            <div className="receipt-hdr">
              <div className="r-gov">भारत सरकार • खाद्य एवं रसद विभाग, उत्तर प्रदेश</div>
              <h2>उचित मूल्य दुकान ई-वितरण रसीद</h2>
              <p>Fair Price Shop ePOS Distribution Receipt</p>
              <div style={{ marginTop: 6, display: 'inline-block', background: 'rgba(255,255,255,.2)', padding: '2px 10px', borderRadius: 4, fontSize: '.72rem', fontWeight: 700 }}>
                📅 Allotment: {formattedMonth}
              </div>
            </div>

            {/* Beneficiary Card Summary */}
            <div className="receipt-bene">
              <div className="rb-icon">👤</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                  <div className="rb-name">{receipt.beneficiaryName || 'NFSA Beneficiary'}</div>
                  <span className={`badge ${receipt.cardType === 'AAY' ? 'b-yellow' : 'b-green'}`}>
                    {receipt.cardType === 'AAY' ? '🟡 Antyodaya (AAY)' : '🟢 Priority (PHH)'}
                  </span>
                </div>
                <div className="rb-card" style={{ fontSize: '.84rem', marginTop: 3 }}>
                  Ration Card No: <strong>{receipt.rationCardNo}</strong>
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 5, flexWrap: 'wrap', fontSize: '.7rem' }}>
                  <span className="badge b-blue">✓ NFSA Active</span>
                  <span className="badge b-purple">{receipt.authType || 'Biometric'}</span>
                  {receipt.isCollected !== undefined && (
                    <span className={`badge ${receipt.isCollected ? 'b-green' : 'b-yellow'}`}>
                      {receipt.isCollected ? '✓ Ration Collected' : '⏳ Quota Available'}
                    </span>
                  )}
                  {receipt.loginTime && (
                    <span style={{ color: 'var(--gray-600)', alignSelf: 'center' }}>
                      🕒 {fmt(receipt.loginTime)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Fair Price Shop Details */}
            <div style={{ background: 'var(--blue-light)', border: '1px solid var(--blue-mid)', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
              <div style={{ fontSize: '.68rem', color: 'var(--blue-dark)', fontWeight: 800, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.04em', display: 'flex', alignItems: 'center', gap: 5 }}>
                <span>🏪</span> Fair Price Shop Details / उचित दर दुकान विवरण
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 6 }}>
                {[
                  ['FPS Shop Code', receipt.shopCode || 'N/A'],
                  ['Shop / FPS Name', receipt.shopName || `FPS-${receipt.shopCode}`],
                  ['Owner / Dealer Name', receipt.shopOwner || 'FPS Dealer'],
                  ['District', receipt.district || 'UTTAR PRADESH'],
                  ['Block / Tehsil', receipt.block || 'PDS Block'],
                  ['State', receipt.state || 'UTTAR PRADESH'],
                ].map(([l, v]) => (
                  <div key={l} style={{ background: '#fff', borderRadius: 6, padding: '5px 9px', border: '1px solid rgba(37,99,235,.15)' }}>
                    <div style={{ fontSize: '.62rem', color: 'var(--gray-400)', fontWeight: 600 }}>{l}</div>
                    <div style={{ fontSize: '.78rem', fontWeight: 700, color: 'var(--gray-800)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v || 'N/A'}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* 1. BENEFICIARY FAMILY MEMBERS LIST */}
            {receipt.members && receipt.members.length > 0 && (
              <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 14 }}>
                <div style={{ background: 'var(--gray-50)', padding: '9px 13px', fontSize: '.72rem', fontWeight: 800, color: 'var(--gray-700)', textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>👨‍👩‍👧‍👦 Beneficiary Family Members ({receipt.members.length}) / परिवार के सदस्य</span>
                  <span className="badge b-blue">{receipt.members.length} Members</span>
                </div>
                <div style={{ padding: '8px 12px', overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.78rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1.5px solid var(--border)', textAlign: 'left', color: 'var(--gray-500)', fontSize: '.68rem' }}>
                        <th style={{ padding: '5px 4px' }}>#</th>
                        <th style={{ padding: '5px 4px' }}>Member Name</th>
                        <th style={{ padding: '5px 4px', textAlign: 'center' }}>Age</th>
                        <th style={{ padding: '5px 4px', textAlign: 'center' }}>Gender</th>
                        <th style={{ padding: '5px 4px' }}>Aadhaar / KYC</th>
                        <th style={{ padding: '5px 4px', textAlign: 'center' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {receipt.members.map((m, idx) => (
                        <tr key={m.memberId || idx} style={{ borderBottom: '1px solid var(--gray-100)' }}>
                          <td style={{ padding: '6px 4px', color: 'var(--gray-400)', fontSize: '.72rem' }}>{idx + 1}</td>
                          <td style={{ padding: '6px 4px', fontWeight: 700, color: 'var(--gray-900)' }}>
                            {m.name || 'Beneficiary'}
                          </td>
                          <td style={{ padding: '6px 4px', textAlign: 'center', color: 'var(--gray-600)' }}>
                            {m.age ? `${m.age} yrs` : '—'}
                          </td>
                          <td style={{ padding: '6px 4px', textAlign: 'center', color: 'var(--gray-600)' }}>
                            {m.gender || '—'}
                          </td>
                          <td style={{ padding: '6px 4px', color: 'var(--gray-600)', fontFamily: 'monospace', fontSize: '.72rem' }}>
                            {m.kycUid || 'Seeded'}
                          </td>
                          <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                            <span className={`badge ${m.active === 'Active' ? 'b-green' : 'b-gray'}`} style={{ fontSize: '.65rem', padding: '1px 6px' }}>
                              {m.active || 'Active'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 2. ENTITLEMENTS BREAKDOWN (Only Non-Zero Values) */}
            {receipt.entitlements && receipt.entitlements.length > 0 && (
              <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 14 }}>
                <div style={{ background: 'var(--gray-50)', padding: '9px 13px', fontSize: '.72rem', fontWeight: 800, color: 'var(--gray-700)', textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid var(--border)' }}>
                  📦 Monthly Entitlement Allotment / मासिक पात्रता आवंटन
                </div>
                <div style={{ padding: '8px 12px', overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.8rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1.5px solid var(--border)', textAlign: 'left', color: 'var(--gray-500)', fontSize: '.7rem' }}>
                        <th style={{ padding: '6px 4px' }}>Commodity</th>
                        <th style={{ padding: '6px 4px', textAlign: 'center' }}>Allotted Qty</th>
                        <th style={{ padding: '6px 4px', textAlign: 'right' }}>Allotment Month</th>
                      </tr>
                    </thead>
                    <tbody>
                      {receipt.entitlements
                        .filter(e => parseFloat(e.qty || 0) > 0)
                        .map((e, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--gray-100)' }}>
                            <td style={{ padding: '6px 4px', fontWeight: 700 }}>
                              {getCommIcon(e.commodity)} {e.commodity}
                            </td>
                            <td style={{ padding: '6px 4px', textAlign: 'center', fontWeight: 800, color: 'var(--purple)' }}>
                              {e.qty} {e.unit || 'KG'}
                            </td>
                            <td style={{ padding: '6px 4px', textAlign: 'right', color: 'var(--gray-600)' }}>
                              {e.month || formattedMonth}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 3. TRANSACTION DETAILS (Distribution & Availed Commodities - Non-null/Non-zero) */}
            {receipt.transactions && receipt.transactions.length > 0 ? (
              <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 14 }}>
                <div style={{ background: 'var(--gray-50)', padding: '9px 13px', fontSize: '.72rem', fontWeight: 800, color: 'var(--gray-700)', textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>✓ Availed Distribution Transactions / वितरित राशन सामग्री</span>
                  <span className="badge b-green">Distributed</span>
                </div>
                <div style={{ padding: '10px 12px' }}>
                  {receipt.transactions.map((t, tidx) => (
                    <div key={tidx} style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 6, fontSize: '.74rem' }}>
                        <div>📅 Date: <strong>{t.transDate || receipt.loginTime || '—'}</strong></div>
                        <div>👤 Availed By: <strong style={{ color: 'var(--purple)' }}>{t.availedBy || receipt.availedBy || receipt.beneficiaryName}</strong></div>
                        <span className="badge b-purple">{t.transType || receipt.authType || 'Biometric'}</span>
                      </div>
                      
                      {/* Commodities list with non-zero values */}
                      {t.commodities && t.commodities.length > 0 ? (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                          {t.commodities
                            .filter(c => parseFloat(c.saleQty || c.sale_qty || c.allot_qty || 0) > 0)
                            .map((c, ci) => (
                              <span key={ci} className="badge b-yellow" style={{ fontSize: '.74rem', padding: '3px 8px' }}>
                                {getCommIcon(c.commName)} {c.commName}: {c.saleQty || c.sale_qty || c.allot_qty} {c.unit || 'KG'}
                              </span>
                            ))}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                          {receipt.totalWheat > 0 && <span className="badge b-yellow">🌾 Wheat: {receipt.totalWheat} kg</span>}
                          {receipt.totalRice > 0 && <span className="badge b-yellow">🍚 Rice: {receipt.totalRice} kg</span>}
                          {receipt.totalSugar > 0 && <span className="badge b-yellow">🍬 Sugar: {receipt.totalSugar} kg</span>}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Summary Bar */}
                  <div style={{ background: 'var(--purple-lt)', padding: '10px 14px', borderRadius: 8, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: 8, marginTop: 8 }}>
                    {receipt.totalWheat > 0 && (
                      <div style={{ textAlign: 'center', background: '#fff', borderRadius: 6, padding: '6px 4px', border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: '.62rem', color: 'var(--gray-400)' }}>Wheat</div>
                        <div style={{ fontSize: '.84rem', fontWeight: 800, color: 'var(--yellow)' }}>{receipt.totalWheat} kg</div>
                      </div>
                    )}
                    {receipt.totalRice > 0 && (
                      <div style={{ textAlign: 'center', background: '#fff', borderRadius: 6, padding: '6px 4px', border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: '.62rem', color: 'var(--gray-400)' }}>Rice</div>
                        <div style={{ fontSize: '.84rem', fontWeight: 800, color: 'var(--orange)' }}>{receipt.totalRice} kg</div>
                      </div>
                    )}
                    {receipt.totalSugar > 0 && (
                      <div style={{ textAlign: 'center', background: '#fff', borderRadius: 6, padding: '6px 4px', border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: '.62rem', color: 'var(--gray-400)' }}>Sugar</div>
                        <div style={{ fontSize: '.84rem', fontWeight: 800, color: 'var(--purple)' }}>{receipt.totalSugar} kg</div>
                      </div>
                    )}
                    <div style={{ textAlign: 'center', background: '#fff', borderRadius: 6, padding: '6px 4px', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: '.62rem', color: 'var(--gray-400)' }}>Total Distributed</div>
                      <div style={{ fontSize: '.84rem', fontWeight: 800, color: 'var(--green)' }}>
                        {receipt.totalGrain || ((receipt.totalWheat || 0) + (receipt.totalRice || 0) + (receipt.totalSugar || 0))} kg
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="alert a-info" style={{ marginBottom: 14 }}>
                ℹ️ <strong>Ration Not Yet Collected:</strong> Beneficiary quota has not been distributed for this month.
              </div>
            )}

            {/* 4. AUTHENTICATIONS RECORD */}
            {receipt.authentications && receipt.authentications.length > 0 && (
              <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 14 }}>
                <div style={{ background: 'var(--gray-50)', padding: '9px 13px', fontSize: '.72rem', fontWeight: 800, color: 'var(--gray-700)', textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid var(--border)' }}>
                  👆 ePOS Authentications Recorded / बायोमेट्रिक प्रमाणीकरण विवरण
                </div>
                <div style={{ padding: '8px 12px' }}>
                  {receipt.authentications.map((a, ai) => (
                    <div key={ai} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: ai !== receipt.authentications.length - 1 ? '1px solid var(--gray-100)' : 'none', fontSize: '.74rem' }}>
                      <div>
                        <strong>{a.memberName || 'Family Member'}</strong>
                        <span style={{ color: 'var(--gray-500)', marginLeft: 8 }}>🕒 {a.authTime || '—'}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span className="badge b-purple">{a.authType || 'Bio'}</span>
                        <span className="badge b-green">{a.status || 'Success'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Official Computerized Declaration */}
            <div style={{ background: 'var(--gray-50)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 13px', textAlign: 'center' }}>
              <div style={{ fontSize: '.66rem', color: 'var(--gray-500)', fontWeight: 600, marginBottom: 2 }}>
                ✓ Official Electronic POS Verified Record · Department of Food & Civil Supplies
              </div>
              <div style={{ fontSize: '.62rem', color: 'var(--gray-400)', fontStyle: 'italic' }}>
                Computer-generated distribution receipt under PMGKAY / NFSA Scheme. No physical signature required.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FPSDataPage({ setTitle }) {
  const { shop } = useAuth();
  const [searchParams] = useSearchParams();

  // Initialize with dynamic current month
  const defaultMonth = getCurrentMonthString();
  const [month, setMonth] = useState(defaultMonth);

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState('');
  
  // Set tab from URL query (?tab=units or ?tab=daily) or default to 'units'
  const initialTab = searchParams.get('tab') || 'units';
  const [tab, setTab] = useState(initialTab);

  // Receipt Modal State
  const [receipt, setReceipt] = useState(null);
  const [receiptLoading, setReceiptLoading] = useState('');
  const [copiedRc, setCopiedRc] = useState(null);

  // Unit-wise Search, Filter & Pagination states
  const [unitSearch, setUnitSearch] = useState('');
  const [schemeFilter, setSchemeFilter] = useState('ALL');
  const [authFilter, setAuthFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  useEffect(() => {
    setTitle('FPS Data / एफपीएस डेटा');
  }, [setTitle]);

  // Sync tab if URL changes
  useEffect(() => {
    const t = searchParams.get('tab');
    if (t && (t === 'daily' || t === 'units' || t === 'charts')) {
      setTab(t);
    }
  }, [searchParams]);

  const load = useCallback(async (m) => {
    if (!shop?.shopId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr('');
    setResult(null);
    setPage(1);
    try {
      const r = await api.getFPSData(shop.shopId, m);
      setResult(r);
    } catch (e) {
      setErr(e.message || 'Failed to fetch transaction data.');
    } finally {
      setLoading(false);
    }
  }, [shop?.shopId]);

  useEffect(() => {
    load(month);
  }, [month, load]);

  const handleMonth = (m) => {
    setMonth(m);
    setResult(null);
    setErr('');
    setPage(1);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard?.writeText(text);
    setCopiedRc(text);
    setTimeout(() => setCopiedRc(null), 1800);
  };

  const openReceipt = async (rowOrCard) => {
    const rc = typeof rowOrCard === 'object' ? rowOrCard.rationCardNo : rowOrCard;
    const row = typeof rowOrCard === 'object' ? rowOrCard : (d?.cardDetails || []).find(r => r.rationCardNo === rc);
    
    // Immediate receipt display with all available details
    const immediateReceipt = {
      rationCardNo: rc,
      cardType: row?.cardType || 'PHH',
      beneficiaryName: 'Beneficiary',
      shopName: snap.fpsName || shop?.shopName || `FPS-${shop?.shopId || ''}`,
      shopOwner: snap.ownerName || shop?.ownerName || 'FPS Dealer',
      shopCode: shop?.shopId || '',
      district: snap.district || 'UTTAR PRADESH',
      block: snap.block || 'PDS Block',
      state: 'UTTAR PRADESH',
      month: month,
      authType: row?.authMethod || 'Biometric',
      loginTime: row?.lastTxn || '',
      receiptId: row?.receiptId || '',
      txnId: row?.txnId || '',
      totalRice: ((row?.riceAay || 0) + (row?.ricePhh || 0) || row?.rice || 0),
      totalWheat: ((row?.wheatAay || 0) + (row?.wheatPhh || 0) || row?.wheat || 0),
      totalSugar: row?.sugar || 0,
      totalGrain: row?.total || 0,
      transactions: [{
        transRefNo: row?.txnId || 'TXN-01',
        transType: row?.authMethod || 'Biometric',
        transDate: row?.lastTxn || new Date().toISOString(),
        riceAayKg: row?.riceAay || 0,
        ricePhhKg: row?.ricePhh || 0,
        wheatAayKg: row?.wheatAay || 0,
        wheatPhhKg: row?.wheatPhh || 0,
        sugarAayQty: row?.sugar || 0,
      }],
    };
    setReceipt(immediateReceipt);
    setReceiptLoading(rc);

    try {
      if (shop?.shopId) {
        const r = await api.getReceipt(shop.shopId, rc, month);
        if (r?.receipt) {
          setReceipt(prev => ({
            ...prev,
            ...r.receipt,
            shopName: r.receipt.shopName || prev.shopName,
            shopOwner: r.receipt.shopOwner || prev.shopOwner,
            district: r.receipt.district || prev.district,
            block: r.receipt.block || prev.block,
          }));
        }
      }
    } catch (_) {
      // Immediate receipt already provides clean fallbacks
    } finally {
      setReceiptLoading('');
    }
  };

  const refresh = async () => {
    if (!shop?.shopId) return;
    setRefreshing(true);
    try {
      await api.refreshFPS(shop.shopId);
      await load(month);
    } catch (e) {
      setErr(e.message || 'Refresh failed');
    } finally {
      setRefreshing(false);
    }
  };

  const d = result?.data;
  const snap = result?.shopInfo || shop?.snapshot || {};
  const monthLabel = MONTHS.find(m => m.v === month)?.l || month;
  const authBadge = (m) => {
    const s = (m || '').toLowerCase();
    if (s.includes('bio')) return 'b-purple';
    if (s.includes('otp')) return 'b-teal';
    if (s.includes('iris')) return 'b-yellow';
    return 'b-blue';
  };

  // Filtered individual cards
  const filteredCards = useMemo(() => {
    if (!d?.cardDetails) return [];
    return d.cardDetails.filter(row => {
      if (schemeFilter !== 'ALL' && (row.cardType || '').toUpperCase() !== schemeFilter) return false;
      if (authFilter !== 'ALL') {
        const at = (row.authMethod || '').toLowerCase();
        if (authFilter === 'BIO' && !at.includes('bio')) return false;
        if (authFilter === 'OTP' && !at.includes('otp')) return false;
      }
      if (unitSearch.trim()) {
        const q = unitSearch.toLowerCase().trim();
        const rc = (row.rationCardNo || '').toLowerCase();
        const tid = (row.txnId || '').toLowerCase();
        const rid = (row.receiptId || '').toLowerCase();
        if (!rc.includes(q) && !tid.includes(q) && !rid.includes(q)) return false;
      }
      return true;
    });
  }, [d?.cardDetails, schemeFilter, authFilter, unitSearch]);

  const totalPages = Math.ceil(filteredCards.length / pageSize) || 1;
  const paginatedCards = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredCards.slice(start, start + pageSize);
  }, [filteredCards, page, pageSize]);

  return (
    <div>
      {receipt && <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />}

      <div className="page-hdr">
        <div className="ph-row">
          <div>
            <h2>🌾 FPS Transaction Data & E-Receipts</h2>
            <p>Distribution & ePOS Records · <strong style={{ color: 'var(--blue)' }}>{snap.fpsName || shop?.shopName}</strong></p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              value={month}
              onChange={e => handleMonth(e.target.value)}
              className="form-ctrl"
              style={{ width: 250, fontWeight: 700 }}
            >
              {MONTHS.map(m => (
                <option key={m.v} value={m.v}>
                  {m.l}
                </option>
              ))}
            </select>
            <button className="btn btn-outline btn-sm" onClick={refresh} disabled={refreshing}>
              {refreshing ? '⏳' : '🔄'} Refresh
            </button>
          </div>
        </div>
      </div>

      {err && <div className="alert a-error">⚠️ {err} — Try another month or click Refresh.</div>}

      {(snap.fpsName || shop?.shopName) && (
        <div className="dealer-banner">
          <div className="db-icon">🏪</div>
          <div style={{ flex: 1 }}>
            <div className="db-name">{snap.fpsName || shop?.shopName}</div>
            <div className="db-sub">
              👤 {snap.ownerName || shop?.ownerName || ''}
              {snap.district ? ` · ${snap.district}` : ''}
              {snap.block ? ` · ${snap.block}` : ''}
            </div>
            <div className="db-id">FPS Code: {shop.shopId} · Selected: {monthLabel}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              { v: (d?.summary?.totalCards || snap.totalCards || 0).toLocaleString(), l: 'Cards Served' },
              { v: (d?.summary?.totalTxns || 0).toLocaleString(), l: 'Distributions' },
              { v: `${snap.percentAch || d?.summary?.percentAch || 0}%`, l: 'Achievement' },
            ].map((s, i) => (
              <div key={i} style={{ textAlign: 'center', background: 'rgba(255,255,255,.15)', borderRadius: 8, padding: '7px 14px', minWidth: 70 }}>
                <div style={{ fontSize: '1.15rem', fontWeight: 900 }}>{s.v}</div>
                <div style={{ fontSize: '.62rem', opacity: .75 }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="loader"><div className="spinner" /></div>
      ) : d ? (
        <>
          {/* Summary Metric Grid */}
          <div className="fps-metric-grid">
            {[
              { icon: '🔄', val: (d.summary.totalTxns || 0).toLocaleString(), lbl: 'Transactions', c: 'var(--blue)' },
              { icon: '👥', val: (d.summary.totalCards || 0).toLocaleString(), lbl: 'Ration Cards', c: 'var(--purple)' },
              { icon: '🌾', val: `${(d.summary.totalWheat || 0).toFixed(1)}kg`, lbl: 'Total Wheat', c: 'var(--yellow)' },
              { icon: '🍚', val: `${(d.summary.totalRice || 0).toFixed(1)}kg`, lbl: 'Total Rice', c: 'var(--orange)' },
              { icon: '🍬', val: `${(d.summary.totalSugar || 0).toFixed(1)}kg`, lbl: 'Total Sugar', c: 'var(--gray-700)' },
              { icon: '🟢', val: d.summary.phhCount || 0, lbl: 'PHH Txns', c: 'var(--green)' },
              { icon: '🟡', val: d.summary.aayCount || 0, lbl: 'AAY Txns', c: 'var(--yellow)' },
              { icon: '👆', val: d.summary.fingerprint || 0, lbl: 'Biometric Auth', c: 'var(--purple)' },
            ].map((m, i) => (
              <div key={i} className="fps-metric">
                <div className="fm-icon">{m.icon}</div>
                <div className="fm-val" style={{ color: m.c }}>{m.val}</div>
                <div className="fm-lbl">{m.lbl}</div>
              </div>
            ))}
          </div>

          {/* Tab Navigation */}
          <div className="tab-bar">
            {[
              ['units', '📋 Individual Ration Cards (ई-रसीद)'],
              ['daily', '📅 Day-wise Distribution'],
              ['charts', '📊 Charts & Analytics'],
            ].map(([k, l]) => (
              <button
                key={k}
                className={`tab-btn ${tab === k ? 'active' : ''}`}
                onClick={() => setTab(k)}
              >
                {l}
              </button>
            ))}
          </div>

          {/* TAB 1: INDIVIDUAL RATION CARDS & RECEIPTS */}
          {tab === 'units' && (
            <div className="card">
              <div className="card-hdr" style={{ flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <span className="card-title">
                    📋 Individual Beneficiary Distributions · {filteredCards.length} Records
                  </span>
                  <div style={{ fontSize: '.72rem', color: 'var(--gray-500)', marginTop: 2 }}>
                    Click any ration card row or receipt button to generate official printable distribution receipt
                  </div>
                </div>
                <span className="badge b-green">
                  {filteredCards.length} / {d.cardDetails?.length || 0} Filtered
                </span>
              </div>

              {/* Search and Filters */}
              <div style={{ padding: '14px 16px 0' }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', marginBottom: 12 }}>
                  {/* Search Input */}
                  <div style={{ position: 'relative', flex: 1, minWidth: 260, maxWidth: 380 }}>
                    <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: '.85rem', color: 'var(--gray-400)' }}>
                      🔍
                    </span>
                    <input
                      type="text"
                      className="form-ctrl"
                      style={{ paddingLeft: 32 }}
                      placeholder="Search Ration Card # or Txn ID..."
                      value={unitSearch}
                      onChange={e => { setUnitSearch(e.target.value); setPage(1); }}
                    />
                  </div>

                  {unitSearch && (
                    <button className="btn btn-ghost btn-sm" onClick={() => { setUnitSearch(''); setPage(1); }}>
                      ✕ Clear Search
                    </button>
                  )}

                  {/* Scheme & Auth filters */}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', background: 'var(--gray-100)', borderRadius: 7, padding: 2, border: '1px solid var(--border)' }}>
                      {[
                        { k: 'ALL', l: 'All Schemes' },
                        { k: 'PHH', l: 'PHH' },
                        { k: 'AAY', l: 'AAY' },
                      ].map(f => (
                        <button
                          key={f.k}
                          onClick={() => { setSchemeFilter(f.k); setPage(1); }}
                          style={{
                            border: 'none',
                            background: schemeFilter === f.k ? '#fff' : 'transparent',
                            color: schemeFilter === f.k ? 'var(--gray-900)' : 'var(--gray-500)',
                            fontWeight: schemeFilter === f.k ? 700 : 500,
                            borderRadius: 6,
                            padding: '4px 9px',
                            fontSize: '.72rem',
                            cursor: 'pointer',
                          }}
                        >
                          {f.l}
                        </button>
                      ))}
                    </div>

                    <div style={{ display: 'flex', background: 'var(--gray-100)', borderRadius: 7, padding: 2, border: '1px solid var(--border)' }}>
                      {[
                        { k: 'ALL', l: 'All Auth' },
                        { k: 'BIO', l: '👆 Biometric' },
                        { k: 'OTP', l: '📱 Mobile OTP' },
                      ].map(f => (
                        <button
                          key={f.k}
                          onClick={() => { setAuthFilter(f.k); setPage(1); }}
                          style={{
                            border: 'none',
                            background: authFilter === f.k ? '#fff' : 'transparent',
                            color: authFilter === f.k ? 'var(--gray-900)' : 'var(--gray-500)',
                            fontWeight: authFilter === f.k ? 700 : 500,
                            borderRadius: 6,
                            padding: '4px 9px',
                            fontSize: '.72rem',
                            cursor: 'pointer',
                          }}
                        >
                          {f.l}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="alert a-info" style={{ borderRadius: 8, marginBottom: 12, fontSize: '.76rem' }}>
                  💡 <strong>Tip:</strong> Click on any row to open the complete distribution receipt with shop & card details ready for printing.
                </div>
              </div>

              {/* Transactions Table */}
              <div className="tbl-wrap">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}>#</th>
                      <th>Ration Card No.</th>
                      <th>Scheme</th>
                      <th>Auth Mode</th>
                      <th>Date & Time</th>
                      <th>Commodities Distributed</th>
                      <th>Total (kg)</th>
                      <th>Receipt / Txn ID</th>
                      <th style={{ textAlign: 'center' }}>E-Receipt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedCards.length === 0 ? (
                      <tr>
                        <td colSpan={9} style={{ textAlign: 'center', padding: 36, color: 'var(--gray-400)' }}>
                          No records matching your search or filters in {monthLabel}.
                        </td>
                      </tr>
                    ) : (
                      paginatedCards.map((row, i) => {
                        const isLoading = receiptLoading === row.rationCardNo;
                        const serial = (page - 1) * pageSize + i + 1;
                        return (
                          <tr
                            key={row.rationCardNo + '_' + (row.txnId || i)}
                            className="clickable-row"
                            onClick={() => !isLoading && openReceipt(row)}
                            title="Click to view full distribution receipt"
                          >
                            <td style={{ color: 'var(--gray-400)', fontSize: '.74rem' }}>{serial}</td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontFamily: 'monospace', fontWeight: 800, color: 'var(--blue)', fontSize: '.84rem' }}>
                                  {isLoading ? '⏳' : row.rationCardNo}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); copyToClipboard(row.rationCardNo); }}
                                  title="Copy Ration Card Number"
                                  style={{
                                    border: 'none',
                                    background: 'transparent',
                                    cursor: 'pointer',
                                    fontSize: '.7rem',
                                    color: copiedRc === row.rationCardNo ? 'var(--green)' : 'var(--gray-400)',
                                  }}
                                >
                                  {copiedRc === row.rationCardNo ? '✓' : '📋'}
                                </button>
                              </div>
                            </td>
                            <td>
                              <span className={`badge ${row.cardType === 'AAY' ? 'b-yellow' : 'b-green'}`}>
                                {row.cardType}
                              </span>
                            </td>
                            <td>
                              <span className={`badge ${authBadge(row.authMethod)}`}>
                                {row.authMethod || 'Biometric'}
                              </span>
                            </td>
                            <td style={{ fontSize: '.74rem', whiteSpace: 'nowrap', color: 'var(--gray-600)' }}>
                              📅 {row.lastTxn ? new Date(row.lastTxn).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                {row.commodities && row.commodities.length > 0 ? (
                                  row.commodities
                                    .filter(c => parseFloat(c.sale_qty || c.saleQty || 0) > 0)
                                    .map((c, ci) => (
                                      <span
                                        key={ci}
                                        style={{
                                          background: 'var(--gray-100)',
                                          border: '1px solid var(--border)',
                                          borderRadius: 4,
                                          padding: '2px 6px',
                                          fontSize: '.68rem',
                                          fontWeight: 600,
                                          color: 'var(--gray-800)',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: 3,
                                        }}
                                      >
                                        {getCommIcon(c.comm_name_en || c.commName)} {c.comm_name_en || c.commName}: <strong>{c.sale_qty || c.saleQty} kg</strong>
                                      </span>
                                    ))
                                ) : (
                                  <>
                                    {((row.wheatAay || 0) + (row.wheatPhh || 0) || row.wheat || 0) > 0 && (
                                      <span style={{ background: 'var(--yellow-lt)', borderRadius: 4, padding: '2px 6px', fontSize: '.68rem', fontWeight: 600, color: 'var(--yellow)' }}>
                                        🌾 Wheat: {((row.wheatAay || 0) + (row.wheatPhh || 0) || row.wheat || 0).toFixed(1)} kg
                                      </span>
                                    )}
                                    {((row.riceAay || 0) + (row.ricePhh || 0) || row.rice || 0) > 0 && (
                                      <span style={{ background: 'var(--orange-lt)', borderRadius: 4, padding: '2px 6px', fontSize: '.68rem', fontWeight: 600, color: 'var(--orange)' }}>
                                        🍚 Rice: {((row.riceAay || 0) + (row.ricePhh || 0) || row.rice || 0).toFixed(1)} kg
                                      </span>
                                    )}
                                    {(row.sugar || 0) > 0 && (
                                      <span style={{ background: 'var(--gray-100)', borderRadius: 4, padding: '2px 6px', fontSize: '.68rem', fontWeight: 600 }}>
                                        🍬 Sugar: {(row.sugar || 0).toFixed(1)} kg
                                      </span>
                                    )}
                                  </>
                                )}
                              </div>
                            </td>
                            <td style={{ fontWeight: 800, color: 'var(--blue)', fontSize: '.84rem' }}>
                              {(row.total || 0).toFixed(1)} kg
                            </td>
                            <td style={{ fontSize: '.68rem', color: 'var(--gray-500)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              <span style={{ fontFamily: 'monospace' }}>{row.receiptId || row.txnId || '—'}</span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <button
                                className="btn btn-outline btn-sm"
                                onClick={(e) => { e.stopPropagation(); openReceipt(row); }}
                                style={{ padding: '3px 8px', fontSize: '.72rem', fontWeight: 700 }}
                              >
                                🧾 Receipt
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', fontSize: '.76rem', color: 'var(--gray-500)', borderTop: '1px solid var(--border)' }}>
                  <div>
                    Showing {Math.min(filteredCards.length, (page - 1) * pageSize + 1)}–{Math.min(filteredCards.length, page * pageSize)} of {filteredCards.length} records
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      className="btn btn-outline btn-sm"
                      disabled={page <= 1}
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                    >
                      ◀ Prev
                    </button>
                    <span style={{ padding: '0 8px', fontWeight: 700, color: 'var(--gray-800)' }}>
                      {page} / {totalPages}
                    </span>
                    <button
                      className="btn btn-outline btn-sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    >
                      Next ▶
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: DAY-WISE DISTRIBUTION */}
          {tab === 'daily' && (
            <div className="card">
              <div className="card-hdr" style={{ flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <span className="card-title">📅 Day-wise Distribution Summary — {monthLabel}</span>
                  <div style={{ fontSize: '.72rem', color: 'var(--gray-500)', marginTop: 2 }}>
                    Official daily grain allocation & distribution trends
                  </div>
                </div>
                <span className="badge b-blue">{d.dailyTrend?.length || 0} Distribution Days</span>
              </div>
              <div className="tbl-wrap">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}>#</th>
                      <th>Date</th>
                      <th>Wheat AAY (kg)</th>
                      <th>Wheat PHH (kg)</th>
                      <th>Rice AAY (kg)</th>
                      <th>Rice PHH (kg)</th>
                      <th>Sugar (kg)</th>
                      <th>Total Grain (kg)</th>
                      <th>Transactions</th>
                      <th>AAY</th>
                      <th>PHH</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(d.dailyTrend || []).length === 0 ? (
                      <tr>
                        <td colSpan={11} style={{ textAlign: 'center', padding: 32, color: 'var(--gray-400)' }}>
                          No day-wise data available for {monthLabel}.
                        </td>
                      </tr>
                    ) : (
                      d.dailyTrend.map((row, i) => {
                        const totalKg = row.total || ((row.wheatAay || 0) + (row.wheatPhh || 0) + (row.riceAay || 0) + (row.ricePhh || 0) + (row.sugar || 0));
                        return (
                          <tr key={row.date}>
                            <td style={{ color: 'var(--gray-400)', fontSize: '.74rem' }}>{i + 1}</td>
                            <td style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                              📅 {new Date(row.date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </td>
                            <td>{(row.wheatAay || 0).toFixed(1)}</td>
                            <td>{(row.wheatPhh || 0).toFixed(1)}</td>
                            <td>{(row.riceAay || 0).toFixed(1)}</td>
                            <td>{(row.ricePhh || 0).toFixed(1)}</td>
                            <td>{(row.sugar || 0).toFixed(1)}</td>
                            <td style={{ fontWeight: 800, color: 'var(--blue)' }}>{totalKg.toFixed(1)}</td>
                            <td style={{ fontWeight: 800 }}>{row.transactions || row.count || 0}</td>
                            <td><span className="badge b-yellow">{row.aay || 0}</span></td>
                            <td><span className="badge b-green">{row.phh || 0}</span></td>
                          </tr>
                        );
                      })
                    )}
                    {(d.dailyTrend || []).length > 0 && (
                      <tr style={{ background: 'var(--blue-light)', fontWeight: 800 }}>
                        <td colSpan={2} style={{ color: 'var(--blue-dark)', fontSize: '.84rem' }}>TOTAL MONTHLY</td>
                        <td>{d.dailyTrend.reduce((s, r) => s + (r.wheatAay || 0), 0).toFixed(1)}</td>
                        <td>{d.dailyTrend.reduce((s, r) => s + (r.wheatPhh || 0), 0).toFixed(1)}</td>
                        <td>{d.dailyTrend.reduce((s, r) => s + (r.riceAay || 0), 0).toFixed(1)}</td>
                        <td>{d.dailyTrend.reduce((s, r) => s + (r.ricePhh || 0), 0).toFixed(1)}</td>
                        <td>{(d.summary.totalSugar || d.dailyTrend.reduce((s, r) => s + (r.sugar || 0), 0)).toFixed(1)}</td>
                        <td style={{ color: 'var(--blue-dark)', fontSize: '.9rem' }}>
                          {(d.summary.totalDistributed || (d.summary.totalRice + d.summary.totalWheat + (d.summary.totalSugar || 0))).toFixed(1)}
                        </td>
                        <td style={{ color: 'var(--blue-dark)' }}>{d.summary.totalTxns || 0}</td>
                        <td style={{ color: 'var(--yellow)' }}>{d.summary.aayCount || 0}</td>
                        <td style={{ color: 'var(--green)' }}>{d.summary.phhCount || 0}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: CHARTS & VISUALS */}
          {tab === 'charts' && (
            <>
              <div className="charts-grid">
                <div className="card">
                  <div className="card-hdr"><span className="card-title">📅 Daily Grain Trend (kg)</span></div>
                  <div className="card-body">
                    <ResponsiveContainer width="100%" height={210}>
                      <AreaChart data={d.dailyTrend || []}>
                        <defs>
                          <linearGradient id="rg" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ea580c" stopOpacity={0.25} />
                            <stop offset="95%" stopColor="#ea580c" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'var(--gray-400)' }} tickFormatter={d => d.slice(8)} />
                        <YAxis tick={{ fontSize: 9, fill: 'var(--gray-400)' }} />
                        <Tooltip content={<CT />} />
                        <Area type="monotone" dataKey="total" stroke="#ea580c" fill="url(#rg)" name="Total (kg)" strokeWidth={2.5} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="card">
                  <div className="card-hdr"><span className="card-title">⏰ Hourly Transaction Density</span></div>
                  <div className="card-body">
                    <ResponsiveContainer width="100%" height={210}>
                      <BarChart data={(d.hourlyDist || []).filter(h => h.count > 0 || (h.hour >= 8 && h.hour <= 18))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="label" tick={{ fontSize: 9, fill: 'var(--gray-400)' }} />
                        <YAxis tick={{ fontSize: 9, fill: 'var(--gray-400)' }} />
                        <Tooltip content={<CT />} />
                        <Bar dataKey="count" fill="var(--blue)" radius={[3, 3, 0, 0]} name="Transactions" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="g2">
                {[
                  {
                    data: [
                      { name: 'Rice (चावल)', value: d.summary.totalRice || 0, color: '#ea580c' },
                      { name: 'Wheat (गेहूं)', value: d.summary.totalWheat || 0, color: '#d97706' },
                      { name: 'Sugar (चीनी)', value: d.summary.totalSugar || 0, color: '#7c3aed' },
                    ].filter(x => x.value > 0),
                    title: '🍚🌾 Commodity Distribution Split (kg)',
                  },
                  {
                    data: [
                      { name: 'AAY (अंत्योदय)', value: d.summary.aayCount || 0, color: '#d97706' },
                      { name: 'PHH (पात्र गृहस्थी)', value: d.summary.phhCount || 0, color: '#059669' },
                    ].filter(x => x.value > 0),
                    title: '🃏 Beneficiary Scheme Split',
                  },
                ].map((p, pi) => (
                  <div key={pi} className="card">
                    <div className="card-hdr"><span className="card-title">{p.title}</span></div>
                    <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <ResponsiveContainer width="50%" height={160}>
                        <PieChart>
                          <Pie data={p.data} cx="50%" cy="50%" innerRadius={36} outerRadius={62} dataKey="value" strokeWidth={0}>
                            {p.data.map((e, i) => <Cell key={i} fill={e.color} />)}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                      <div style={{ flex: 1 }}>
                        {p.data.map((x, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
                            <div style={{ width: 8, height: 8, borderRadius: 3, background: x.color }} />
                            <span style={{ flex: 1, fontSize: '.78rem', color: 'var(--gray-600)' }}>{x.name}</span>
                            <strong style={{ color: x.color, fontSize: '.84rem' }}>
                              {typeof x.value === 'number' ? x.value.toFixed(1) : x.value}
                            </strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      ) : !err && (
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center', padding: 56 }}>
            <div style={{ fontSize: '3rem', marginBottom: 12 }}>🌾</div>
            <p style={{ color: 'var(--gray-500)' }}>Loading data for {monthLabel}...</p>
          </div>
        </div>
      )}
    </div>
  );
}
