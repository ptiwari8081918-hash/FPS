import React,{useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {api} from '../../utils/api';
import {useAuth} from '../../context/AuthContext';

export default function SettingsPage({setTitle}){
  const{shop,login}=useAuth();
  const[f,setF]=useState({language:shop?.language||'en',slotDuration:shop?.slotDuration||5,slotCapacity:shop?.slotCapacity||1});
  const[loading,setLoading]=useState(false);
  const[toast,setToast]=useState(null);
  const snap=shop?.snapshot||{};
  const upd=(k,v)=>setF(x=>({...x,[k]:v}));
  const showT=(msg,type='success')=>{setToast({msg,type});setTimeout(()=>setToast(null),3000);};
  useEffect(()=>{setTitle('Settings / सेटिंग्स');},[setTitle]);

  // Single name — owner and dealer are same person
  const shopName=snap.fpsName||shop?.shopName||'FPS Shop';
  const ownerName=snap.ownerName||shop?.ownerName||'N/A';

  const save=async()=>{
    setLoading(true);
    try{
      const p={language:f.language,slotDuration:f.slotDuration,slotCapacity:f.slotCapacity};
      const r=await api.updateShop(shop.shopId,p);
      login({...shop,language:r.shop.language,slotDuration:r.shop.slotDuration,slotCapacity:r.shop.slotCapacity});
      showT('Settings saved ✅');
    }catch(e){showT(e.message,'error');}
    finally{setLoading(false);}
  };

  const refresh=async()=>{
    setLoading(true);
    try{
      const r=await api.refreshFPS(shop.shopId);
      login({...shop,snapshot:r.snapshot,shopName:r.snapshot?.fpsName||shop.shopName});
      showT('Shop details refreshed ✅');
    }
    catch(e){showT(e.message,'error');}
    finally{setLoading(false);}
  };

  const link=`${window.location.origin}/customer/${shop?.shopId}`;

  return(
    <div>
      {toast&&<div className="toast-wrap"><div className={`toast ${toast.type}`}><div className="toast-dot"/>{toast.msg}</div></div>}

      {/* Shop banner — single name display */}
      <div className="dealer-banner" style={{marginBottom:18}}>
        <div className="db-icon">🏪</div>
        <div style={{flex:1}}>
          <div className="db-name">{shopName}</div>
          <div className="db-sub">👤 {ownerName} · FPS {shop?.shopId}</div>
          {snap.district&&<div className="db-id">📍 {snap.district}{snap.block?` · ${snap.block}`:''}</div>}
        </div>
        <span className="badge b-green" style={{flexShrink:0}}>● Verified Shop</span>
      </div>

      <div className="page-hdr"><h2>⚙️ Settings</h2><p>Manage shop preferences, password, and account settings</p></div>

      <div className="g2">
        <div>
          {/* Shop info card */}
          <div className="card" style={{marginBottom:14}}>
            <div className="card-hdr"><span className="card-title">🏪 Shop Information</span></div>
            <div className="card-body">
              {[
                ['FPS Shop ID', shop?.shopId, 'var(--purple)'],
                ['Shop Name', shopName, 'var(--gray-800)'],
                ['Owner / Dealer', ownerName, 'var(--gray-800)'],
                ['District', snap.district||'N/A', 'var(--gray-600)'],
                ['Block', snap.block||'N/A', 'var(--gray-600)'],
                ['Village', snap.village||'N/A', 'var(--gray-600)'],
                ['Mobile', snap.mobileNo||'N/A', 'var(--gray-600)'],
                ['Total Cards', (snap.totalCards||0).toLocaleString(), 'var(--blue)'],
                ['AAY Cards', (snap.aayCards||0).toLocaleString(), 'var(--yellow)'],
                ['PHH Cards', (snap.phhCards||0).toLocaleString(), 'var(--green)'],
                ['Achievement', `${snap.percentAch||0}%`, 'var(--orange)'],
                ['Total Txns (Jan 2026)', (snap.totalTxns||0).toLocaleString(), 'var(--purple)'],
              ].map(([k,v,c])=>(
                <div key={k} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'1px solid var(--border)'}}>
                  <span style={{fontSize:'.8rem',color:'var(--gray-500)',fontWeight:500}}>{k}</span>
                  <strong style={{fontSize:'.8rem',color:c}}>{v||'N/A'}</strong>
                </div>
              ))}
              <button className="btn btn-primary" style={{width:'100%',marginTop:14}} onClick={refresh} disabled={loading}>
                🔄 Refresh Shop Details
              </button>
            </div>
          </div>

          {/* Customer link card */}
          <div className="card">
            <div className="card-hdr"><span className="card-title">🔗 Customer Booking Link</span></div>
            <div className="card-body">
              <div style={{background:'var(--purple-lt)',border:'1px solid var(--purple)',borderRadius:8,padding:'10px 12px',fontSize:'.78rem',fontFamily:'monospace',wordBreak:'break-all',marginBottom:12,color:'var(--purple)'}}>
                {link}
              </div>
              <div style={{display:'flex',gap:8}}>
                <button className="btn btn-outline" style={{flex:1}} onClick={()=>{navigator.clipboard.writeText(link);showT('Link copied!');}}>
                  📋 Copy Link
                </button>
                <button className="btn btn-primary" style={{flex:1}} onClick={()=>window.open(link,'_blank')}>
                  🔗 Open Link
                </button>
              </div>
            </div>
          </div>
        </div>

        <div>
          {/* Preferences */}
          <div className="card" style={{marginBottom:14}}>
            <div className="card-hdr"><span className="card-title">🎛️ Slot Preferences</span></div>
            <div className="card-body">
              <div className="form-group">
                <label className="form-label">🌐 Language</label>
                <select value={f.language} onChange={e=>upd('language',e.target.value)} className="form-ctrl">
                  <option value="en">English</option>
                  <option value="hi">हिंदी</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">⏱️ Default Slot Duration</label>
                <select value={f.slotDuration} onChange={e=>upd('slotDuration',+e.target.value)} className="form-ctrl">
                  {[1,2,3,4,5,6,7,8,9,10,15,20,30].map(d=><option key={d} value={d}>{d} minutes</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">👥 Default Slot Capacity</label>
                <input type="number" min={1} max={10} value={f.slotCapacity}
                  onChange={e=>upd('slotCapacity',+e.target.value)} className="form-ctrl"/>
              </div>
              <button className="btn btn-primary" style={{width:'100%'}} onClick={save} disabled={loading}>
                {loading?'⏳ Saving...':'✅ Save Preferences'}
              </button>
            </div>
          </div>

          {/* Password */}
          <div className="card">
            <div className="card-hdr"><span className="card-title">🔒 Password</span></div>
            <div className="card-body">
              <p style={{fontSize:'.8rem',color:'var(--gray-500)',marginBottom:12}}>
                For security, password changes happen on a dedicated screen and require your current password.
              </p>
              <Link to="/dashboard/change-password" className="btn btn-primary" style={{width:'100%',textAlign:'center',display:'block'}}>
                🔒 Change Password
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
