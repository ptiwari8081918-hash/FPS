import React,{useState} from 'react';
import {useNavigate,Link} from 'react-router-dom';
import {api} from '../utils/api';
import {useAuth} from '../context/AuthContext';

export default function LoginPage(){
  const[shopId,setShopId]=useState('');
  const[pw,setPw]=useState('');
  const[err,setErr]=useState('');
  const[loading,setLoading]=useState(false);
  const{login}=useAuth();
  const nav=useNavigate();

  const submit=async e=>{
    e.preventDefault();setErr('');setLoading(true);
    try{
      const d=await api.login(shopId.trim(),pw);
      login(d.shop,d.token,d.sessionId);
      nav(d.shop.mustChangePassword ? '/dashboard/change-password' : '/dashboard');
    }catch(e){setErr(e.message||'Login failed.');}
    finally{setLoading(false);}
  };

  return(
    <div className="login-page">
      <div className="login-card">
        <div className="login-top">
          <div className="login-emblem">🌾</div>
          <h2>AnnSeva — FPS Login</h2>
          <p>उचित मूल्य दुकान पोर्टल · उत्तर प्रदेश</p>
        </div>
        <div className="login-body">
          {err&&<div className="alert a-error">⚠️ {err}</div>}
          <form onSubmit={submit}>
            <div className="form-group">
              <label className="form-label">FPS Shop ID / दुकान कोड</label>
              <input className="form-ctrl" placeholder="FPS Shop ID (8 digits)" value={shopId}
                onChange={e=>setShopId(e.target.value)} required autoFocus/>
            </div>
            <div className="form-group">
              <label className="form-label">Password / पासवर्ड</label>
              <input type="password" className="form-ctrl" placeholder="Enter your password"
                value={pw} onChange={e=>setPw(e.target.value)} required/>
            </div>
            <button type="submit" className="btn btn-primary"
              style={{width:'100%',padding:11,fontSize:'.9rem'}} disabled={loading}>
              {loading?'⏳ Verifying...':'🚀 Login to Dashboard'}
            </button>
          </form>
          <div style={{marginTop:16,background:'var(--gray-50)',border:'1px solid var(--border)',borderRadius:'var(--r-sm)',padding:'12px 14px'}}>
            <div style={{fontSize:'.74rem',fontWeight:700,color:'var(--blue)',marginBottom:7}}>ℹ️ How it works</div>
            {[
              'Enter your FPS Shop ID',
              'First login synchronizes your shop data automatically',
              'Contact support if you have not set a password',
              'If data takes time to load, retry after a few seconds',
            ].map((t,i)=>(
              <div key={i} style={{fontSize:'.74rem',color:'var(--gray-500)',padding:'2px 0',display:'flex',gap:5}}>
                <span style={{color:'var(--blue)',fontWeight:700}}>→</span>{t}
              </div>
            ))}
          </div>
          <div style={{textAlign:'center',marginTop:14}}>
            <Link to="/" style={{color:'var(--gray-400)',fontSize:'.76rem'}}>← Back to Home</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
