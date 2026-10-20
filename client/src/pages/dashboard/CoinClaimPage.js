import React, { useEffect, useState, useCallback, useRef } from 'react';
import { api } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

const COIN_VALUE = 0.5; // ₹ per coin

/** Sub-component: Bank Transfer form */
function BankForm({ coins, setCoins, onSubmit, loading }) {
  const [f, setF] = useState({ accountHolder: '', bankName: '', accountNumber: '', ifscCode: '' });
  const upd = (k, v) => setF(p => ({ ...p, [k]: v }));

  return (
    <div>
      <div className="form-group">
        <label className="form-label">💰 Coins to Claim</label>
        <input type="number" className="form-ctrl" value={coins} min={1}
          onChange={e => setCoins(Math.max(1, parseInt(e.target.value) || 1))} />
        <div style={{ fontSize: '.75rem', color: 'var(--gray-400)', marginTop: 4 }}>
          ≈ ₹{(coins * COIN_VALUE).toFixed(2)} will be transferred
        </div>
      </div>
      {[
        { k: 'accountHolder', l: '👤 Account Holder Name', p: 'Full name as on bank account' },
        { k: 'bankName',      l: '🏦 Bank Name',           p: 'Bank Name' },
        { k: 'accountNumber', l: '🔢 Account Number',      p: 'Bank Account Number' },
        { k: 'ifscCode',      l: '🔑 IFSC Code',           p: 'IFSC Code (11 alphanumeric characters)', upper: true },
      ].map(({ k, l, p, upper }) => (
        <div className="form-group" key={k}>
          <label className="form-label">{l}</label>
          <input className="form-ctrl" value={f[k]} placeholder={p}
            onChange={e => upd(k, upper ? e.target.value.toUpperCase() : e.target.value)} />
        </div>
      ))}
      <button className="btn btn-primary" style={{ width: '100%' }} disabled={loading}
        onClick={() => onSubmit('bank', { ...f, coins })}>
        {loading ? '⏳ Submitting...' : '🏦 Submit Bank Transfer Claim'}
      </button>
    </div>
  );
}

/** Sub-component: UPI form */
function UPIForm({ coins, setCoins, onSubmit, loading }) {
  const [upiId, setUpiId] = useState('');
  return (
    <div>
      <div className="form-group">
        <label className="form-label">💰 Coins to Claim</label>
        <input type="number" className="form-ctrl" value={coins} min={1}
          onChange={e => setCoins(Math.max(1, parseInt(e.target.value) || 1))} />
        <div style={{ fontSize: '.75rem', color: 'var(--gray-400)', marginTop: 4 }}>
          ≈ ₹{(coins * COIN_VALUE).toFixed(2)} will be sent to your UPI
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">📲 UPI ID / Mobile Number</label>
        <input className="form-ctrl" value={upiId} placeholder="UPI ID (VPA) or 10-Digit Mobile Number"
          onChange={e => setUpiId(e.target.value)} />
      </div>
      <button className="btn btn-primary" style={{ width: '100%' }} disabled={loading}
        onClick={() => onSubmit('upi', { upiId, coins })}>
        {loading ? '⏳ Submitting...' : '📲 Submit UPI Claim'}
      </button>
    </div>
  );
}

/** Sub-component: QR Code form */
function QRForm({ coins, setCoins, onSubmit, loading }) {
  const [qrPreview, setQrPreview] = useState('');
  const fileRef = useRef(null);

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert('QR image must be under 2MB'); return; }
    const reader = new FileReader();
    reader.onload = ev => setQrPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  return (
    <div>
      <div className="form-group">
        <label className="form-label">💰 Coins to Claim</label>
        <input type="number" className="form-ctrl" value={coins} min={1}
          onChange={e => setCoins(Math.max(1, parseInt(e.target.value) || 1))} />
        <div style={{ fontSize: '.75rem', color: 'var(--gray-400)', marginTop: 4 }}>
          ≈ ₹{(coins * COIN_VALUE).toFixed(2)} will be sent to your QR account
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">📷 Upload QR Code Image</label>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
        <div style={{ border: '2px dashed var(--border)', borderRadius: 10, padding: 20, textAlign: 'center', cursor: 'pointer', background: 'var(--gray-50)' }}
          onClick={() => fileRef.current?.click()}>
          {qrPreview
            ? <img src={qrPreview} alt="QR" style={{ maxWidth: 160, maxHeight: 160, borderRadius: 8, display: 'block', margin: '0 auto' }} />
            : <><div style={{ fontSize: '2rem', marginBottom: 6 }}>📷</div><div style={{ fontSize: '.82rem', color: 'var(--gray-400)' }}>Click to upload QR code (max 2MB)</div></>
          }
        </div>
      </div>
      <button className="btn btn-primary" style={{ width: '100%' }} disabled={loading || !qrPreview}
        onClick={() => onSubmit('qr', { qrImageUrl: qrPreview, coins })}>
        {loading ? '⏳ Submitting...' : '📷 Submit QR Code Claim'}
      </button>
    </div>
  );
}

export default function CoinClaimPage({ setTitle }) {
  const { shop } = useAuth();
  const [balance, setBalance]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [submitting, setSubmit] = useState(false);
  const [method, setMethod]     = useState('bank');
  const [coins, setCoins]       = useState(1);
  const [toast, setToast]       = useState(null);
  const [tab, setTab]           = useState('claim'); // 'claim' | 'history'

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadBalance = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getCoinBalance(shop.shopId);
      setBalance(data);
      // Default claim to all available coins (min 1)
      setCoins(Math.max(1, data.coins || 1));
    } catch (e) {
      showToast('Failed to load coin balance', 'error');
    } finally {
      setLoading(false);
    }
  }, [shop.shopId]);

  useEffect(() => {
    setTitle('Coin Wallet / सिक्के');
    loadBalance();
  }, [setTitle, loadBalance]);

  const handleSubmit = async (claimMethod, fields) => {
    if (!balance || balance.coins < (fields.coins || 1)) {
      showToast('Insufficient coins', 'error'); return;
    }
    setSubmit(true);
    try {
      await api.claimCoins(shop.shopId, { method: claimMethod, ...fields });
      showToast('✅ Claim submitted! Admin will process within 48 hours.');
      await loadBalance();
    } catch (e) {
      showToast(e.message || 'Claim failed', 'error');
    } finally {
      setSubmit(false);
    }
  };

  const methodColor = { bank: '#2563eb', upi: '#7c3aed', qr: '#059669' };

  if (loading) return <div className="loader"><div className="spinner" /></div>;

  return (
    <div>
      {toast && (
        <div className="toast-wrap">
          <div className={`toast ${toast.type}`}>
            <div className="toast-dot" />{toast.msg}
          </div>
        </div>
      )}

      <div className="page-hdr">
        <h2>🪙 Coin Wallet</h2>
        <p>Earn coins for every booking · 1 Coin = ₹{COIN_VALUE.toFixed(1)}</p>
      </div>

      {/* Coin Balance Banner */}
      <div style={{
        background: 'linear-gradient(135deg,#7c3aed,#a855f7)',
        borderRadius: 14, padding: '20px 24px', marginBottom: 20,
        color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        boxShadow: '0 4px 20px rgba(124,58,237,.3)',
      }}>
        <div>
          <div style={{ fontSize: '.75rem', opacity: .8, fontWeight: 600, marginBottom: 4, letterSpacing: '.05em', textTransform: 'uppercase' }}>Available Coins</div>
          <div style={{ fontSize: '2.8rem', fontWeight: 900, lineHeight: 1 }}>{balance?.coins ?? 0}</div>
          <div style={{ fontSize: '.82rem', opacity: .75, marginTop: 4 }}>≈ ₹{((balance?.coins || 0) * COIN_VALUE).toFixed(2)} claimable</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '.7rem', opacity: .7, marginBottom: 4 }}>Total Earned</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>{balance?.totalEarned ?? 0}</div>
          <div style={{ fontSize: '.7rem', opacity: .7, marginTop: 8 }}>Pending Claim</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{balance?.pendingCoins ?? 0} coins</div>
        </div>
      </div>

      {/* How it works */}
      <div style={{ background: 'var(--gray-50)', borderRadius: 12, padding: '14px 18px', marginBottom: 20, border: '1px solid var(--border)' }}>
        <div style={{ fontWeight: 700, fontSize: '.84rem', marginBottom: 8, color: 'var(--gray-800)' }}>ℹ️ How Coins Work</div>
        <div style={{ fontSize: '.78rem', color: 'var(--gray-600)', lineHeight: 1.8 }}>
          <div>🎫 <strong>+1 coin</strong> added automatically for every confirmed booking</div>
          <div>💰 <strong>1 Coin = ₹{COIN_VALUE.toFixed(1)}</strong> — claim via Bank / UPI / QR</div>
          <div>⏱️ Admin processes claims within <strong>48 hours</strong></div>
          <div>✅ Coins are deducted when claim is submitted; refunded if rejected</div>
        </div>
      </div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 18, background: 'var(--bg)', borderRadius: 10, padding: 4, border: '1px solid var(--border)' }}>
        {[['claim', '🪙 Claim Coins'], ['history', '📋 Claim History']].map(([v, l]) => (
          <button key={v} onClick={() => setTab(v)}
            style={{
              flex: 1, padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font)', fontSize: '.8rem', fontWeight: 700,
              background: tab === v ? 'var(--white)' : 'transparent',
              color:      tab === v ? 'var(--purple)' : 'var(--gray-400)',
              boxShadow:  tab === v ? 'var(--shadow-sm)' : 'none',
            }}>
            {l}
          </button>
        ))}
      </div>

      {/* CLAIM TAB */}
      {tab === 'claim' && (
        <div className="card">
          <div className="card-hdr"><span className="card-title">💸 Submit Claim Request</span></div>
          <div className="card-body">
            {(balance?.coins || 0) === 0 ? (
              <div className="alert a-warn" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', marginBottom: 8 }}>🪙</div>
                <strong>No coins available yet.</strong><br />
                <span style={{ fontSize: '.82rem', color: 'var(--gray-500)' }}>
                  You earn 1 coin for each successful booking. Keep accepting bookings to earn more!
                </span>
              </div>
            ) : (
              <>
                {/* Method selector */}
                <div style={{ marginBottom: 18 }}>
                  <label className="form-label">💳 Payout Method</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginTop: 6 }}>
                    {[['bank', '🏦', 'Bank Transfer'], ['upi', '📲', 'UPI'], ['qr', '📷', 'QR Code']].map(([v, ic, l]) => (
                      <button key={v} onClick={() => setMethod(v)}
                        style={{
                          padding: '10px 8px', borderRadius: 10, cursor: 'pointer',
                          fontFamily: 'var(--font)', fontSize: '.78rem', fontWeight: 700,
                          border: method === v ? `2px solid ${methodColor[v]}` : '1px solid var(--border)',
                          background: method === v ? `${methodColor[v]}18` : 'var(--white)',
                          color: method === v ? methodColor[v] : 'var(--gray-500)',
                          textAlign: 'center',
                        }}>
                        <div style={{ fontSize: '1.4rem', marginBottom: 4 }}>{ic}</div>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>

                {method === 'bank' && <BankForm coins={coins} setCoins={setCoins} onSubmit={handleSubmit} loading={submitting} />}
                {method === 'upi'  && <UPIForm  coins={coins} setCoins={setCoins} onSubmit={handleSubmit} loading={submitting} />}
                {method === 'qr'   && <QRForm   coins={coins} setCoins={setCoins} onSubmit={handleSubmit} loading={submitting} />}
              </>
            )}
          </div>
        </div>
      )}

      {/* HISTORY TAB */}
      {tab === 'history' && (
        <div className="card">
          <div className="card-hdr"><span className="card-title">📋 Claim History</span></div>
          <div className="card-body">
            {(balance?.claims || []).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--gray-400)' }}>
                <div style={{ fontSize: '2rem', marginBottom: 8 }}>📋</div>
                No claims submitted yet.
              </div>
            ) : (
              [...(balance.claims)].reverse().map((c, i) => (
                <div key={i} style={{
                  border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px',
                  marginBottom: 10, background: 'var(--gray-50)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ fontWeight: 700, fontSize: '.9rem' }}>
                      {c.method === 'bank' ? '🏦' : c.method === 'upi' ? '📲' : '📷'} {c.coins} coins → ₹{c.amount?.toFixed(2)}
                    </div>
                    <span className={`badge ${c.status === 'approved' ? 'b-green' : c.status === 'rejected' ? 'b-red' : 'b-gray'}`}>
                      {c.status}
                    </span>
                  </div>
                  <div style={{ fontSize: '.75rem', color: 'var(--gray-500)', lineHeight: 1.7 }}>
                    <div>Method: {c.method.toUpperCase()}</div>
                    {c.upiId && <div>UPI: {c.upiId}</div>}
                    {c.accountNumber && <div>A/C: ****{c.accountNumber.slice(-4)} · {c.ifscCode}</div>}
                    {c.adminNote && <div style={{ color: 'var(--orange)', marginTop: 4 }}>Note: {c.adminNote}</div>}
                    <div>Submitted: {c.createdAt ? new Date(c.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '—'}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
