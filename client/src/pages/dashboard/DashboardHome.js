import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { api } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import FeedbackModal from '../../components/FeedbackModal';

const TT = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 11px', fontSize: '.78rem', boxShadow: 'var(--shadow-md)' }}>
      <div style={{ color: 'var(--gray-500)', marginBottom: 3, fontWeight: 600 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || 'var(--purple)', fontWeight: 700 }}>
          {p.name}: {p.value}
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
  if (n.includes('maize')) return '🌽';
  if (n.includes('jowar') || n.includes('bajra')) return '🌾';
  return '📦';
}

function getCommodityOrder(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('wheat')) return 1;
  if (n.includes('rice') || n.includes('frice')) return 2;
  if (n.includes('sugar')) return 3;
  return 4;
}

const generate12Months = () => {
  const options = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const m = String(d.getMonth() + 1);
    const y = String(d.getFullYear());
    const shortLabel = d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
    const fullLabel = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    options.push({
      m,
      y,
      val: `${m}-${y}`,
      shortLabel: i === 0 ? `${shortLabel} (Current)` : shortLabel,
      fullLabel: i === 0 ? `${fullLabel} (Current Month)` : fullLabel,
      isCurrent: i === 0,
    });
  }
  return options;
};

const YEAR_MONTH_OPTIONS = generate12Months();

export default function DashboardHome({ setTitle }) {
  const { shop } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Set default to CURRENT month and year
  const now = new Date();
  const currentMonth = String(now.getMonth() + 1);
  const currentYear = String(now.getFullYear());

  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(currentYear);

  // Stock Register State
  const [stockData, setStockData] = useState(null);
  const [stockLoading, setStockLoading] = useState(false);
  const [stockError, setStockError] = useState(null);

  // Live Transactions State
  const [txnData, setTxnData] = useState(null);
  const [txnLoading, setTxnLoading] = useState(false);
  const [txnError, setTxnError] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const navigate = useNavigate();

  const snap = shop?.snapshot || {};
  const shopName = stockData?.distNameEn
    ? `FPS ${shop?.shopId} · ${stockData.distNameEn} (${stockData.afso_name_en || ''})`
    : snap.fpsName || shop?.shopName || 'FPS Shop';
  const ownerName = snap.ownerName || shop?.ownerName || '';

  useEffect(() => {
    setTitle('Dashboard');
    if (shop?.shopId) {
      api.getAnalytics(shop.shopId)
        .then(r => setData(r.analytics))
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [shop?.shopId, setTitle]);

  const fetchLiveData = useCallback(async (m, y) => {
    if (!shop?.shopId) return;
    setStockLoading(true);
    setTxnLoading(true);
    setStockError(null);
    setTxnError(null);

    // Stock Register call
    try {
      const s = await api.getStockRegister(shop.shopId, m, y);
      if (s?.success) setStockData(s);
      else setStockError(s?.message || 'Stock register unavailable');
    } catch (err) {
      setStockError(err.message || 'Error loading stock register');
    } finally {
      setStockLoading(false);
    }

    // Transactions call
    try {
      const t = await api.getTransactions(shop.shopId, m, y);
      if (t?.success) setTxnData(t);
      else setTxnError(t?.message || 'No transactions found');
    } catch (err) {
      setTxnError(err.message || 'Error loading transactions');
    } finally {
      setTxnLoading(false);
    }
  }, [shop?.shopId]);

  useEffect(() => {
    fetchLiveData(selectedMonth, selectedYear);
  }, [fetchLiveData, selectedMonth, selectedYear]);

  // Day-wise distribution data from live transactions
  const dailyDistribution = useMemo(() => {
    return txnData?.dailyTrend || [];
  }, [txnData?.dailyTrend]);

  // Order commodities strictly: 1. Wheat, 2. Rice/FRice, 3. Sugar, 4. Others (Maize, Jowar, Bajra, etc.)
  const sortedStockItems = useMemo(() => {
    if (!stockData?.items) return [];
    return [...stockData.items].sort((a, b) => {
      const pA = getCommodityOrder(a.commNameEn);
      const pB = getCommodityOrder(b.commNameEn);
      if (pA !== pB) return pA - pB;
      return (a.commNameEn || '').localeCompare(b.commNameEn || '');
    });
  }, [stockData?.items]);

  if (loading) return <div className="loader"><div className="spinner" /></div>;

  const pct = stockData?.summary?.percentIssued !== undefined
    ? stockData.summary.percentIssued
    : snap.percentAch || data?.utilizationRate || 0;

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const peakHour = (data?.hourlyData || []).reduce((mx, h) => h.count > mx.count ? h : mx, { count: 0, label: 'N/A' });
  const aiMsg = pct < 50
    ? `Achievement is at ${pct}%. Stock distribution is below target for ${selectedMonth}/${selectedYear}.`
    : pct < 80
      ? `Good progress — ${pct}% achievement. Peak hour: ${peakHour.label}.`
      : `Outstanding! ${pct}% stock achievement with ${txnData?.summary?.totalTxns || data?.todayBookings || 0} distributions recorded.`;

  // Auth pie data from live transactions or snapshot fallback
  const authPie = txnData?.summary
    ? [
        { name: 'Biometric', value: txnData.summary.biometricCount || 0, color: '#7c3aed' },
        { name: 'Mobile OTP', value: txnData.summary.otpCount || 0, color: '#fcb045' },
        { name: 'Iris', value: txnData.summary.irisCount || 0, color: '#fd1d1d' },
      ].filter(a => a.value > 0)
    : snap.fingerprintTxns !== undefined && (snap.fingerprintTxns || snap.irisTxns || snap.otpTxns)
      ? [
          { name: 'Fingerprint', value: snap.fingerprintTxns || 0, color: '#7c3aed' },
          { name: 'Iris', value: snap.irisTxns || 0, color: '#fd1d1d' },
          { name: 'OTP', value: snap.otpTxns || 0, color: '#fcb045' },
        ]
      : [];

  return (
    <div>
      {/* Dealer banner */}
      <div className="dealer-banner">
        <div className="db-icon">🏪</div>
        <div style={{ flex: 1 }}>
          <div className="db-name">{shopName}</div>
          {ownerName && <div className="db-sub">👤 {ownerName} · FPS Code: {shop?.shopId}</div>}
          {!ownerName && <div className="db-sub">FPS Code: {shop?.shopId}</div>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            className="btn btn-sm"
            onClick={() => setShowFeedback(true)}
            style={{
              background: 'rgba(255,255,255,.22)',
              color: '#fff',
              border: '1px solid rgba(255,255,255,.35)',
              borderRadius: 8,
              fontSize: '.74rem',
              fontWeight: 700,
              padding: '6px 14px',
              cursor: 'pointer',
            }}
          >
            💬 Feedback
          </button>
          {pct > 0 && (
            <div style={{ textAlign: 'center', background: 'rgba(255,255,255,.2)', borderRadius: 9, padding: '7px 16px', border: '1px solid rgba(255,255,255,.25)' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 900 }}>{pct}%</div>
              <div style={{ fontSize: '.62rem', opacity: .8 }}>Distribution Achieved</div>
            </div>
          )}
        </div>
      </div>

      {/* Welcome Bar */}
      <div className="welcome-box">
        <div>
          <div className="wb-title">नमस्ते 👋</div>
          <div className="wb-sub">{today}</div>
          <div className="wb-info">FPS Portal · FPS {shop?.shopId}</div>
        </div>
        <div className="wb-pills">
          {[
            { v: txnData?.summary?.totalTxns || data?.todayBookings || 0, l: "Total Distributed" },
            { v: data?.remainingSlots || 0, l: 'Slots Left' },
            { v: `${pct}%`, l: 'Achievement', hi: true },
          ].map((s, i) => (
            <div key={i} className={'wb-pill' + (s.hi ? ' hi' : '')}>
              <div className="wb-val">{s.v}</div>
              <div className="wb-lbl">{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Insight */}
      <div className="ai-box">
        <div className="ai-ic">🤖</div>
        <div className="ai-txt"><strong>AI Insight:</strong> {aiMsg}</div>
      </div>

      {/* ============================================================== */}
      {/* LIVE STOCK REGISTER SECTION */}
      {/* ============================================================== */}
      <div style={{ marginBottom: 20 }}>
        <div className="stock-reg-hdr">
          <div className="stock-reg-title-wrap">
            <div className="stock-reg-title">
              🌾 Live Stock Register
            </div>
            {stockData?.distNameEn && (
              <span className="badge b-blue" style={{ fontSize: '.7rem', whiteSpace: 'normal', textAlign: 'left' }}>
                📍 {stockData.distNameEn} ({stockData.afso_name_en || 'Block'})
              </span>
            )}
            <span className="badge b-green">● Live</span>
          </div>

          {/* Month Selector (1 Year) & Refresh */}
          <div className="stock-reg-ctrls">
            {/* Quick Pills for recent 4 months */}
            <div className="month-pills-scroll">
              {YEAR_MONTH_OPTIONS.slice(0, 4).map(opt => {
                const isActive = selectedMonth === opt.m && selectedYear === opt.y;
                return (
                  <button
                    key={opt.val}
                    onClick={() => { setSelectedMonth(opt.m); setSelectedYear(opt.y); }}
                    className={`month-pill-btn ${isActive ? 'active' : ''}`}
                  >
                    {opt.shortLabel}
                  </button>
                );
              })}
            </div>

            {/* 12-Month (1 Year) Dropdown */}
            <select
              aria-label="Select month (1 year history)"
              value={`${selectedMonth}-${selectedYear}`}
              onChange={(e) => {
                const [m, y] = e.target.value.split('-');
                setSelectedMonth(m);
                setSelectedYear(y);
              }}
              className="stock-month-select"
            >
              {YEAR_MONTH_OPTIONS.map((opt) => (
                <option key={opt.val} value={opt.val}>
                  📅 {opt.fullLabel}
                </option>
              ))}
            </select>

            {selectedMonth === currentMonth && selectedYear === currentYear ? (
              <span className="badge b-green" title="Viewing live current month">● Live</span>
            ) : (
              <span className="badge b-orange" title="Viewing historical month">📁 Archive</span>
            )}

            <button
              className="btn btn-outline btn-sm"
              style={{ fontSize: '.72rem', padding: '5px 10px', whiteSpace: 'nowrap' }}
              onClick={() => fetchLiveData(selectedMonth, selectedYear)}
              disabled={stockLoading || txnLoading}
              title="Refresh live stock data"
            >
              {stockLoading || txnLoading ? '🔄' : '🔄 Refresh'}
            </button>
          </div>
        </div>

        {stockLoading ? (
          <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--gray-500)' }}>
            <div className="spinner" style={{ margin: '0 auto 10px' }} />
            <div>Loading live stock register...</div>
          </div>
        ) : stockError ? (
          <div className="card" style={{ padding: 16, background: '#fff1f2', border: '1px solid #fecdd3', color: '#be123c', borderRadius: 8 }}>
            ⚠️ {stockError}
          </div>
        ) : stockData?.items ? (
          <>
            {/* Top stock register summary counters */}
            <div className="snap-grid" style={{ marginBottom: 12 }}>
              {[
                ['📦', (stockData.summary?.totalAllotted || 0).toLocaleString() + ' KG', 'Total Allotted', 'var(--blue)'],
                ['📥', (stockData.summary?.totalReceived || 0).toLocaleString() + ' KG', 'Total Received', 'var(--purple)'],
                ['📤', (stockData.summary?.totalIssued || 0).toLocaleString() + ' KG', 'Total Distributed', 'var(--green)'],
                ['⚖️', (stockData.summary?.totalCb || 0).toLocaleString() + ' KG', 'Closing Balance', 'var(--orange)'],
                ['🎯', `${stockData.summary?.percentIssued || 0}%`, 'Distributed %', 'var(--teal)'],
                ['🕒', stockData.refreshTime ? stockData.refreshTime.split(' ')[0] : 'Today', 'Sync Date', 'var(--gray-600)'],
              ].map(([ic, v, l, col]) => (
                <div key={l} className="snap-item">
                  <div className="snap-icon">{ic}</div>
                  <div className="snap-val" style={{ color: col }}>{v}</div>
                  <div className="snap-lbl">{l}</div>
                </div>
              ))}
            </div>

            {/* Individual Commodity Cards in order: Wheat -> Rice -> Sugar -> Others */}
            <div className="commodity-grid">
              {sortedStockItems.map((item, idx) => {
                const allotted = parseFloat(item.allottedQty || 0);
                const issued = parseFloat(item.issuedQty || 0);
                const cb = parseFloat(item.cb || 0);
                const received = parseFloat(item.receivedQty || 0);
                const cPct = allotted > 0 ? Math.min(100, parseFloat(((issued / allotted) * 100).toFixed(1))) : 0;
                const icon = getCommIcon(item.commNameEn);

                return (
                  <div
                    key={idx}
                    style={{
                      background: '#fff',
                      border: '1px solid var(--border)',
                      borderRadius: 10,
                      padding: '14px 16px',
                      boxShadow: 'var(--shadow-sm)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: '1.4rem' }}>{icon}</span>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: '.92rem', color: 'var(--gray-900)' }}>
                              {item.commNameEn}
                            </div>
                            <div style={{ fontSize: '.68rem', color: 'var(--gray-400)' }}>
                              ID: {item.commId} · Unit: {item.commMeasureUnit || 'KG'}
                            </div>
                          </div>
                        </div>
                        <span className={`badge ${cPct >= 90 ? 'b-green' : cPct > 0 ? 'b-orange' : 'b-gray'}`}>
                          {cPct}%
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px', fontSize: '.76rem', marginBottom: 12 }}>
                        <div>
                          <div style={{ color: 'var(--gray-400)', fontSize: '.66rem' }}>Allotted Qty</div>
                          <strong style={{ color: 'var(--gray-800)' }}>{allotted.toLocaleString()} kg</strong>
                        </div>
                        <div>
                          <div style={{ color: 'var(--gray-400)', fontSize: '.66rem' }}>Received Qty</div>
                          <strong style={{ color: 'var(--gray-800)' }}>{received.toLocaleString()} kg</strong>
                        </div>
                        <div>
                          <div style={{ color: 'var(--gray-400)', fontSize: '.66rem' }}>Distributed Qty</div>
                          <strong style={{ color: 'var(--green)' }}>{issued.toLocaleString()} kg</strong>
                        </div>
                        <div>
                          <div style={{ color: 'var(--gray-400)', fontSize: '.66rem' }}>Closing Balance</div>
                          <strong style={{ color: cb > 0 ? 'var(--orange)' : 'var(--gray-500)' }}>{cb.toLocaleString()} kg</strong>
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="progress" style={{ height: 6 }}>
                        <div
                          className="progress-bar"
                          style={{
                            width: `${cPct}%`,
                            background: cPct >= 90 ? 'var(--green)' : cPct >= 50 ? 'var(--orange)' : 'var(--purple)',
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: '.64rem', color: 'var(--gray-400)' }}>
                        <span>Issued: {issued} kg</span>
                        <span>Remaining: {cb} kg</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : null}
      </div>

      {/* ============================================================== */}
      {/* LIVE TRANSACTIONS SECTION */}
      {/* ============================================================== */}
      <div style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="card-hdr" style={{ flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="card-title" style={{ fontSize: '.94rem', fontWeight: 800 }}>
                ⚡ Live Beneficiary Transactions
              </span>
              <span className="badge b-purple">
                {txnData?.summary?.totalTxns || 0} Distributions
              </span>
            </div>
            <div style={{ fontSize: '.72rem', color: 'var(--gray-500)' }}>
              <span className="badge b-green">● Live Synchronized</span>
            </div>
          </div>

          <div className="card-body">
            {txnLoading ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--gray-500)' }}>
                <div className="spinner" style={{ margin: '0 auto 10px' }} />
                <div>Loading live beneficiary transactions...</div>
              </div>
            ) : txnError ? (
              <div style={{ padding: 14, background: '#fff1f2', border: '1px solid #fecdd3', color: '#be123c', borderRadius: 8 }}>
                ℹ️ {txnError}
              </div>
            ) : txnData?.summary ? (
              <>
                {/* Summary Pills */}
                <div className="snap-grid" style={{ marginBottom: 16 }}>
                  {[
                    ['📋', (txnData.summary.totalTxns || 0).toLocaleString(), 'Total Txns', 'var(--blue)'],
                    ['👥', (txnData.summary.totalCards || 0).toLocaleString(), 'Unique Ration Cards', 'var(--purple)'],
                    ['🟢', (txnData.summary.phhCount || 0).toLocaleString(), 'PHH Scheme', 'var(--green)'],
                    ['🟡', (txnData.summary.aayCount || 0).toLocaleString(), 'AAY Scheme', 'var(--orange)'],
                    ['👆', (txnData.summary.biometricCount || 0).toLocaleString(), 'Biometric Auth', 'var(--purple)'],
                    ['📱', (txnData.summary.otpCount || 0).toLocaleString(), 'Mobile OTP Auth', 'var(--teal)'],
                  ].map(([ic, v, l, col]) => (
                    <div key={l} className="snap-item">
                      <div className="snap-icon">{ic}</div>
                      <div className="snap-val" style={{ color: col }}>{v}</div>
                      <div className="snap-lbl">{l}</div>
                    </div>
                  ))}
                </div>

                {txnData.summary.totalTxns === 0 && (
                  <div style={{ margin: '0 0 16px', padding: '12px 16px', background: 'var(--blue-light)', border: '1px solid var(--blue-mid)', borderRadius: 8, fontSize: '.78rem', color: 'var(--blue-dark)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                    <div>
                      ℹ️ No transactions recorded yet for <strong>{selectedMonth}/{selectedYear}</strong>. You can explore previous months using the selector above.
                    </div>
                    {selectedMonth !== '9' && (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => { setSelectedMonth('9'); setSelectedYear('2026'); }}
                        style={{ fontSize: '.72rem', padding: '5px 12px' }}
                      >
                        View Sep 2026 (272 Live Records) ▶
                      </button>
                    )}
                  </div>
                )}

                {/* Day-wise Distribution Table (Restored & Enhanced) */}
                <div style={{ marginTop: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ fontSize: '.84rem', fontWeight: 800, color: 'var(--gray-900)' }}>
                      📅 Day-wise Distribution Summary — {selectedMonth}/{selectedYear}
                    </div>
                    <span className="badge b-blue">{dailyDistribution.length} Active Days</span>
                  </div>

                  <div className="tbl-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th style={{ width: 40 }}>#</th>
                          <th>Date</th>
                          <th>Transactions</th>
                          <th>Total Grain</th>
                          <th>Wheat (kg)</th>
                          <th>Rice (kg)</th>
                          <th>Sugar (kg)</th>
                          <th>AAY Scheme</th>
                          <th>PHH Scheme</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dailyDistribution.length === 0 ? (
                          <tr>
                            <td colSpan="9" style={{ textAlign: 'center', padding: '24px', color: 'var(--gray-400)' }}>
                              No day-wise distribution recorded for {selectedMonth}/{selectedYear}.
                            </td>
                          </tr>
                        ) : (
                          dailyDistribution.map((dRow, idx) => (
                            <tr key={dRow.date}>
                              <td style={{ color: 'var(--gray-400)', fontSize: '.72rem' }}>{idx + 1}</td>
                              <td style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                                📅 {dRow.date}
                              </td>
                              <td style={{ fontWeight: 800, color: 'var(--blue)' }}>
                                {dRow.count || dRow.transactions || 0}
                              </td>
                              <td style={{ fontWeight: 800, color: 'var(--purple)', fontSize: '.84rem' }}>
                                {(dRow.totalKg || dRow.total || 0).toLocaleString()} kg
                              </td>
                              <td style={{ color: 'var(--yellow)', fontWeight: 600 }}>
                                {(dRow.wheat || (dRow.wheatAay || 0) + (dRow.wheatPhh || 0) || 0).toLocaleString()} kg
                              </td>
                              <td style={{ color: 'var(--orange)', fontWeight: 600 }}>
                                {(dRow.rice || (dRow.riceAay || 0) + (dRow.ricePhh || 0) || 0).toLocaleString()} kg
                              </td>
                              <td style={{ color: 'var(--gray-600)' }}>
                                {(dRow.sugar || 0).toLocaleString()} kg
                              </td>
                              <td><span className="badge b-yellow">{dRow.aay || 0}</span></td>
                              <td><span className="badge b-green">{dRow.phh || 0}</span></td>
                            </tr>
                          ))
                        )}
                        {dailyDistribution.length > 0 && (
                          <tr style={{ background: 'var(--purple-lt)', fontWeight: 800 }}>
                            <td colSpan={2} style={{ color: 'var(--purple)', fontSize: '.84rem' }}>TOTAL MONTHLY SUMMARY</td>
                            <td style={{ color: 'var(--blue)' }}>
                              {dailyDistribution.reduce((s, r) => s + (r.count || r.transactions || 0), 0)}
                            </td>
                            <td style={{ color: 'var(--purple)', fontSize: '.88rem' }}>
                              {parseFloat(dailyDistribution.reduce((s, r) => s + (r.totalKg || r.total || 0), 0).toFixed(2)).toLocaleString()} kg
                            </td>
                            <td style={{ color: 'var(--yellow)' }}>
                              {parseFloat(dailyDistribution.reduce((s, r) => s + (r.wheat || (r.wheatAay || 0) + (r.wheatPhh || 0) || 0), 0).toFixed(2)).toLocaleString()} kg
                            </td>
                            <td style={{ color: 'var(--orange)' }}>
                              {parseFloat(dailyDistribution.reduce((s, r) => s + (r.rice || (r.riceAay || 0) + (r.ricePhh || 0) || 0), 0).toFixed(2)).toLocaleString()} kg
                            </td>
                            <td style={{ color: 'var(--gray-700)' }}>
                              {parseFloat(dailyDistribution.reduce((s, r) => s + (r.sugar || 0), 0).toFixed(2)).toLocaleString()} kg
                            </td>
                            <td><span className="badge b-yellow">{dailyDistribution.reduce((s, r) => s + (r.aay || 0), 0)}</span></td>
                            <td><span className="badge b-green">{dailyDistribution.reduce((s, r) => s + (r.phh || 0), 0)}</span></td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Relocated Individual Ration Card Callout to FPS Data Page */}
                <div style={{ marginTop: 16, background: 'linear-gradient(135deg, var(--blue-light), var(--purple-lt))', border: '1.5px solid var(--blue-mid)', borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
                  <div style={{ flex: 1, minWidth: 260 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: '1.3rem' }}>🌾</span>
                      <strong style={{ fontSize: '.94rem', color: 'var(--gray-900)' }}>
                        Individual Ration Card Distribution & E-Receipts
                      </strong>
                      <span className="badge b-green">Available in FPS Data</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '.78rem', color: 'var(--gray-600)', lineHeight: 1.5 }}>
                      Individual ration card records have been organized under the <strong>FPS Data</strong> tab. Search any ration card number, view full commodity issuances, and click any card to print the official government distribution e-receipt.
                    </p>
                  </div>
                  <button
                    className="btn btn-primary"
                    onClick={() => navigate('/dashboard/fps-data?tab=units')}
                    style={{ padding: '9px 18px', fontSize: '.84rem', boxShadow: 'var(--shadow-md)', whiteSpace: 'nowrap' }}
                  >
                    View All Ration Cards & Receipts ➔
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* SHOP BOOKING STATS & CAPACITY */}
      {/* ============================================================== */}
      <div className="stats-grid">
        {[
          { icon: '🎫', val: data?.totalBookings || 0, lbl: 'Total Bookings', sub: 'All time', cl: '', il: '' },
          { icon: '📅', val: data?.todayBookings || 0, lbl: "Today's Bookings", sub: 'Live', cl: 'c-green', il: 'g' },
          { icon: '⏱️', val: data?.totalSlots || 0, lbl: 'Total Slots', sub: `${data?.remainingSlots || 0} remaining`, cl: 'c-orange', il: 'o' },
          { icon: '⚡', val: `${data?.utilizationRate || 0}%`, lbl: 'Utilization', sub: 'Booked vs capacity', cl: 'c-purple', il: 'p' },
        ].map((s, i) => (
          <div key={i} className={`stat-card ${s.cl}`}>
            <div className={`sc-icon ${s.il}`}>{s.icon}</div>
            <div>
              <div className="sc-val">{typeof s.val === 'number' ? s.val.toLocaleString() : s.val}</div>
              <div className="sc-lbl">{s.lbl}</div>
              <div className="sc-sub">{s.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="charts-grid">
        <div className="card">
          <div className="card-hdr"><span className="card-title">📈 7-Day Booking Trend</span></div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={190}>
              <AreaChart data={data?.weekTrend || []}>
                <defs>
                  <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--gray-400)' }} tickFormatter={d => d.slice(5)} />
                <YAxis tick={{ fontSize: 9, fill: 'var(--gray-400)' }} />
                <Tooltip content={<TT />} />
                <Area type="monotone" dataKey="count" stroke="var(--purple)" strokeWidth={2.5} fill="url(#ag)" name="Bookings" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-hdr"><span className="card-title">⏰ Hourly Distribution</span></div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={(data?.hourlyData || []).filter(h => h.hour >= 7 && h.hour <= 18)}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: 'var(--gray-400)' }} />
                <YAxis tick={{ fontSize: 9, fill: 'var(--gray-400)' }} />
                <Tooltip content={<TT />} />
                <Bar dataKey="count" fill="var(--orange)" radius={[3, 3, 0, 0]} name="Bookings" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Auth + Progress */}
      <div className="g2 mt4">
        {authPie.length > 0 && authPie.some(a => a.value > 0) ? (
          <div className="card">
            <div className="card-hdr"><span className="card-title">🔐 Live Authentication Breakdown</span></div>
            <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <ResponsiveContainer width="50%" height={140}>
                <PieChart>
                  <Pie data={authPie} cx="50%" cy="50%" innerRadius={33} outerRadius={60} dataKey="value" strokeWidth={0}>
                    {authPie.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip content={<TT />} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ flex: 1 }}>
                {authPie.map((a, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 9 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: a.color, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: '.78rem', color: 'var(--gray-600)' }}>{a.name}</span>
                    <strong style={{ color: a.color, fontSize: '.82rem' }}>{a.value.toLocaleString()}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : <div />}

        <div className="card">
          <div className="card-hdr"><span className="card-title">🎯 Distribution Achievement</span></div>
          <div className="card-body">
            <div style={{ textAlign: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: '3rem', fontWeight: 900, color: pct >= 75 ? 'var(--green)' : pct >= 50 ? 'var(--orange)' : 'var(--red)', fontFamily: 'monospace' }}>
                {pct}%
              </div>
              <div style={{ fontSize: '.78rem', color: 'var(--gray-500)' }}>
                Stock Issued vs Allotted ({selectedMonth}/{selectedYear})
              </div>
            </div>
            <div className="progress">
              <div className="progress-bar" style={{ width: `${Math.min(pct, 100)}%`, background: pct >= 75 ? 'var(--green)' : pct >= 50 ? 'var(--orange)' : 'var(--red)' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, fontSize: '.66rem', color: 'var(--gray-400)' }}>
              <span>0%</span>
              <span>100%</span>
            </div>
            <div style={{ marginTop: 12, background: 'var(--gray-50)', borderRadius: 7, padding: '10px 12px', fontSize: '.78rem', color: 'var(--gray-600)', lineHeight: 1.9 }}>
              <div>📦 Total Allotted: <strong style={{ color: 'var(--gray-800)' }}>{(stockData?.summary?.totalAllotted || 0).toLocaleString()} kg</strong></div>
              <div>📤 Total Issued: <strong style={{ color: 'var(--green)' }}>{(stockData?.summary?.totalIssued || 0).toLocaleString()} kg</strong></div>
              <div>⚖️ Closing Balance: <strong style={{ color: 'var(--orange)' }}>{(stockData?.summary?.totalCb || 0).toLocaleString()} kg</strong></div>
            </div>
          </div>
        </div>
      </div>

      {showFeedback && (
        <FeedbackModal
          onClose={() => setShowFeedback(false)}
          defaultShopId={shop?.shopId}
        />
      )}
    </div>
  );
}
