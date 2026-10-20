import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

export default function ChangePasswordPage({ setTitle }) {
  const { shop, login, logout } = useAuth();
  const nav = useNavigate();
  const forced = !!shop?.mustChangePassword;

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { setTitle && setTitle('Change Password / पासवर्ड बदलें'); }, [setTitle]);

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setOk('');
    if (newPassword.length < 6) return setErr('New password must be at least 6 characters.');
    if (newPassword !== confirmPassword) return setErr('Passwords do not match.');
    setLoading(true);
    try {
      const d = await api.changePassword(currentPassword, newPassword);
      login(d.shop, d.token, d.sessionId);
      setOk('Password updated ✅');
      setTimeout(() => nav('/dashboard'), 700);
    } catch (e) {
      setErr(e.message || 'Could not change password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="page-hdr">
        <h2>🔒 {forced ? 'You must set a new password' : 'Change Password'}</h2>
        <p>
          {forced
            ? 'You are still using the default password. Set a new one to continue.'
            : 'Update the password used to log in to this FPS dashboard.'}
        </p>
      </div>

      <div className="card" style={{ maxWidth: 440 }}>
        <div className="card-body">
          {forced && (
            <div className="alert a-warn" style={{ marginBottom: 14 }}>
              For security, you can't use the dashboard until this is done.
            </div>
          )}
          {err && <div className="alert a-error" style={{ marginBottom: 14 }}>⚠️ {err}</div>}
          {ok && <div className="alert a-success" style={{ marginBottom: 14 }}>✅ {ok}</div>}

          <form onSubmit={submit}>
            <div className="form-group">
              <label className="form-label">Current Password</label>
              <input type="password" className="form-ctrl" value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)} required autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">New Password</label>
              <input type="password" className="form-ctrl" value={newPassword}
                onChange={e => setNewPassword(e.target.value)} required minLength={6} />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm New Password</label>
              <input type="password" className="form-ctrl" value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)} required minLength={6} />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
              {loading ? '⏳ Updating...' : '🔒 Update Password'}
            </button>
            {!forced && (
              <button type="button" className="btn btn-ghost" style={{ width: '100%', marginTop: 8 }}
                onClick={() => nav('/dashboard')}>
                Cancel
              </button>
            )}
          </form>

          {forced && (
            <div style={{ textAlign: 'center', marginTop: 14 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => { logout(); nav('/'); }}>
                ← Log out instead
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
