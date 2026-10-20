import React,{useEffect,useState,useCallback} from 'react';
import {api} from '../../utils/api';
import {useAuth} from '../../context/AuthContext';
const DAYS=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

export default function SlotManager({setTitle}){
  const{shop}=useAuth();
  const[slots,setSlots]=useState([]);
  // Use IST for default date
  const[date,setDate]=useState(()=>new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'}));
  const[loading,setLoading]=useState(false);
  const[gen,setGen]=useState(false);
  const[mode,setMode]=useState('single');
  const[dow,setDow]=useState([1,2,3,4,5,6]);
  const[toast,setToast]=useState(null);
  const[f,setF]=useState({startHour:9,endHour:17,duration:5,capacity:10,breakAfterMinutes:60,breakDuration:20,validUntil:new Date(Date.now()+30*86400000).toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'})});
  const upd=(k,v)=>setF(x=>({...x,[k]:v}));
  const showT=(msg,type='success')=>{setToast({msg,type});setTimeout(()=>setToast(null),3000);};

  const load=useCallback(async()=>{
    setLoading(true);
    try{const r=await api.getSlots(shop.shopId,date);setSlots(r.slots||[]);}
    catch(e){console.error(e);}
    finally{setLoading(false);}
  },[shop.shopId,date]);

  useEffect(()=>{setTitle('Slot Manager / स्लॉट प्रबंधक');load();},[setTitle,load]);

  const generate=async()=>{
    setGen(true);
    try{
      if(mode==='single'){const r=await api.generateSlots(shop.shopId,{date,...f});showT(`✅ ${r.count} slots created for ${date}`);}
      else{const r=await api.repeatSlots(shop.shopId,{...f,daysOfWeek:dow});showT(`✅ Slots for ${r.results?.length||0} days`);}
      load();
    }catch(e){showT(e.message,'error');}
    finally{setGen(false);}
  };

  const toggleDow=i=>setDow(d=>d.includes(i)?d.filter(x=>x!==i):[...d,i]);
  const toggleSlot=async s=>{
    try{await api.updateSlot(s._id,{status:s.status==='active'?'locked':'active'});load();}
    catch(e){showT(e.message,'error');}
  };
  const del=async id=>{
    if(!window.confirm('Delete this slot?')) return;
    try{await api.deleteSlot(id);showT('Slot deleted');load();}
    catch(e){showT(e.message,'error');}
  };

  const fmt=t=>new Date(t).toLocaleTimeString('en-IN',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit',hour12:true});
  const active=slots.filter(s=>!s.isBreak);
  const cap=active.reduce((a,s)=>a+s.capacity,0);
  const bk=active.reduce((a,s)=>a+s.bookedCount,0);
  const preview=f.endHour>f.startHour?Math.floor((f.endHour-f.startHour)*60/f.duration):0;

  return(
    <div>
      {toast&&<div className="toast-wrap"><div className={`toast ${toast.type}`}><div className="toast-dot"/>{toast.msg}</div></div>}
      <div className="page-hdr"><h2>⏱️ Slot Manager</h2><p>Generate and manage collection time slots</p></div>

      <div className="g2" style={{marginBottom:20}}>
        <div className="card">
          <div className="card-hdr">
            <span className="card-title">🔧 Slot Generator</span>
            <div style={{display:'flex',gap:3,background:'var(--bg)',borderRadius:7,padding:3,border:'1px solid var(--border)'}}>
              {['single','repeat'].map(m=>(
                <button key={m} onClick={()=>setMode(m)} style={{padding:'4px 14px',borderRadius:5,border:'none',cursor:'pointer',fontFamily:'var(--font)',fontSize:'.78rem',fontWeight:700,background:mode===m?'var(--white)':'transparent',color:mode===m?'var(--purple)':'var(--gray-400)',boxShadow:mode===m?'var(--shadow-sm)':'none'}}>
                  {m==='single'?'📅 Single Day':'🔁 Repeat'}
                </button>
              ))}
            </div>
          </div>
          <div className="card-body">
            {mode==='single'&&<div className="form-group"><label className="form-label">📅 Date</label><input type="date" value={date} onChange={e=>setDate(e.target.value)} className="form-ctrl"/></div>}
            <div className="g2">
              <div className="form-group"><label className="form-label">⏰ Start Hour</label>
                <select value={f.startHour} onChange={e=>upd('startHour',+e.target.value)} className="form-ctrl">
                  {Array.from({length:12},(_,i)=>i+6).map(h=><option key={h} value={h}>{String(h).padStart(2,'0')}:00</option>)}
                </select>
              </div>
              <div className="form-group"><label className="form-label">⏰ End Hour</label>
                <select value={f.endHour} onChange={e=>upd('endHour',+e.target.value)} className="form-ctrl">
                  {Array.from({length:13},(_,i)=>i+10).map(h=><option key={h} value={h}>{String(h).padStart(2,'0')}:00</option>)}
                </select>
              </div>
              <div className="form-group"><label className="form-label">⏱️ Duration (min)</label>
                <select value={f.duration} onChange={e=>upd('duration',+e.target.value)} className="form-ctrl">
                  {[1,2,3,4,5,6,7,8,9,10].map(d=><option key={d} value={d}>{d} min</option>)}
                </select>
              </div>
              <div className="form-group"><label className="form-label">👥 Capacity / Slot</label>
                <input type="number" min={1} max={200} value={f.capacity} onChange={e=>upd('capacity',+e.target.value)} className="form-ctrl"/>
              </div>
              <div className="form-group"><label className="form-label">☕ Break After</label>
                <select value={f.breakAfterMinutes} onChange={e=>upd('breakAfterMinutes',+e.target.value)} className="form-ctrl">
                  {[30,45,60,90,120,180].map(v=><option key={v} value={v}>{v} min</option>)}
                </select>
              </div>
              <div className="form-group"><label className="form-label">☕ Break Duration</label>
                <select value={f.breakDuration} onChange={e=>upd('breakDuration',+e.target.value)} className="form-ctrl">
                  {[10,15,20,30,45,60].map(v=><option key={v} value={v}>{v} min</option>)}
                </select>
              </div>
            </div>
            {mode==='repeat'&&(<>
              <div className="form-group"><label className="form-label">📆 Days of Week</label>
                <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                  {DAYS.map((d,i)=>(
                    <button key={i} onClick={()=>toggleDow(i)} style={{padding:'5px 11px',borderRadius:6,border:'1.5px solid',cursor:'pointer',fontFamily:'var(--font)',fontSize:'.78rem',fontWeight:700,background:dow.includes(i)?'var(--purple)':'var(--white)',color:dow.includes(i)?'#fff':'var(--gray-500)',borderColor:dow.includes(i)?'var(--purple)':'var(--border)'}}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-group"><label className="form-label">📅 Valid Until</label>
                <input type="date" value={f.validUntil} onChange={e=>upd('validUntil',e.target.value)} className="form-ctrl"/>
              </div>
            </>)}
            <div style={{background:'var(--purple-lt)',border:'1px solid var(--border)',borderRadius:7,padding:'9px 14px',marginBottom:14,fontSize:'.82rem',color:'var(--purple)'}}>
              <strong>Preview:</strong> ~{preview} slots/day · Capacity: ~{preview*f.capacity} people/day
            </div>
            <button className="btn btn-primary" style={{width:'100%',padding:11}} onClick={generate} disabled={gen}>
              {gen?'⏳ Generating...':`🚀 Generate ${mode==='repeat'?'Repeat':'Day'} Slots`}
            </button>
          </div>
        </div>

        <div>
          <div className="card" style={{marginBottom:14}}>
            <div className="card-hdr"><span className="card-title">📊 Overview — {date}</span><button className="btn btn-ghost btn-sm" onClick={load}>🔄</button></div>
            <div className="card-body">
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:14}}>
                {[{v:active.length,l:'Slots',c:'var(--purple)'},{v:bk,l:'Booked',c:'var(--green)'},{v:cap-bk,l:'Available',c:'var(--purple)'}].map((s,i)=>(
                  <div key={i} style={{textAlign:'center',padding:'10px 6px',background:'var(--bg)',borderRadius:8,border:'1px solid var(--border)'}}>
                    <div style={{fontSize:'1.5rem',fontWeight:800,color:s.c,fontFamily:'monospace'}}>{s.v}</div>
                    <div style={{fontSize:'.68rem',color:'var(--gray-400)'}}>{s.l}</div>
                  </div>
                ))}
              </div>
              <div className="progress"><div className="progress-bar" style={{width:`${cap>0?Math.round((bk/cap)*100):0}%`,background:'var(--purple)'}}/></div>
              <div style={{fontSize:'.7rem',color:'var(--gray-400)',marginTop:5}}>{cap>0?Math.round((bk/cap)*100):0}% utilization</div>
            </div>
          </div>
          <div className="alert a-info">
            <div>
              <div style={{fontWeight:700,marginBottom:6}}>🔗 Customer Booking Link</div>
              <code style={{fontSize:'.74rem',background:'rgba(0,0,0,.06)',padding:'2px 7px',borderRadius:4,display:'block',marginBottom:9,wordBreak:'break-all'}}>
                {window.location.origin}/customer/{shop?.shopId}
              </code>
              <button className="btn btn-outline btn-sm" onClick={()=>{navigator.clipboard?.writeText(`${window.location.origin}/customer/${shop?.shopId}`);showT('Link copied!');}}>
                📋 Copy Link
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-hdr">
          <span className="card-title">📋 Slots — {date}</span>
          <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="form-ctrl" style={{width:160}}/>
        </div>
        {loading?<div className="loader"><div className="spinner"/></div>:slots.length===0?(
          <div style={{textAlign:'center',padding:48,color:'var(--gray-400)'}}>
            <div style={{fontSize:'3rem',marginBottom:12}}>⏱️</div><p>No slots for this date. Generate slots above.</p>
          </div>
        ):(
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>Time</th><th>Duration</th><th>Capacity</th><th>Booked</th><th>Fill</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {slots.map(slot=>{
                  const pct=slot.capacity>0?Math.round((slot.bookedCount/slot.capacity)*100):0;
                  return(
                    <tr key={slot._id} style={{opacity:slot.isBreak?.45:1}}>
                      <td style={{fontWeight:700,fontFamily:'monospace'}}>{fmt(slot.startTime)} – {fmt(slot.endTime)}</td>
                      <td style={{color:'var(--gray-400)'}}>{slot.duration}m</td>
                      <td>{slot.isBreak?'—':slot.capacity}</td>
                      <td style={{fontWeight:600,color:'var(--purple)'}}>{slot.isBreak?'—':slot.bookedCount}</td>
                      <td style={{width:110}}>
                        {!slot.isBreak&&<div style={{display:'flex',alignItems:'center',gap:6}}>
                          <div style={{flex:1,height:5,background:'var(--bg-2)',borderRadius:3,overflow:'hidden'}}>
                            <div style={{width:`${pct}%`,height:'100%',background:pct>80?'var(--red)':pct>50?'var(--purple)':'var(--green)',borderRadius:3}}/>
                          </div>
                          <span style={{fontSize:'.7rem',color:'var(--gray-400)',width:28}}>{pct}%</span>
                        </div>}
                      </td>
                      <td>{slot.isBreak?<span className="badge b-gray">☕ Break</span>:<span className={`badge ${slot.status==='active'?'b-green':slot.status==='full'?'b-red':'b-gray'}`}>{slot.status}</span>}</td>
                      <td>{!slot.isBreak&&<div style={{display:'flex',gap:5}}>
                        <button className="btn btn-ghost btn-sm" onClick={()=>toggleSlot(slot)}>{slot.status==='active'?'🔒':'🔓'}</button>
                        <button className="btn btn-danger btn-sm" onClick={()=>del(slot._id)}>🗑️</button>
                      </div>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
