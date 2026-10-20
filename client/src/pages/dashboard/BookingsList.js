import React,{useEffect,useState,useCallback} from 'react';
import {api} from '../../utils/api';
import {useAuth} from '../../context/AuthContext';

const SB={confirmed:'b-blue',completed:'b-green',cancelled:'b-red',missed:'b-yellow'};

export default function BookingsList({setTitle}){
  const{shop}=useAuth();
  const[bookings,setBookings]=useState([]);
  const[loading,setLoading]=useState(true);
  const[date,setDate]=useState(()=>new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'}));
  const[status,setStatus]=useState('');
  const[search,setSearch]=useState('');
  const[cancelling,setCancelling]=useState(null);
  const[toast,setToast]=useState(null);

  const showT=(msg,type='success')=>{setToast({msg,type});setTimeout(()=>setToast(null),3000);};

  const load=useCallback(async()=>{
    setLoading(true);
    try{const r=await api.getBookings(shop.shopId,date,status);setBookings(r.bookings||[]);}
    catch(e){console.error(e);}
    finally{setLoading(false);}
  },[shop.shopId,date,status]);

  useEffect(()=>{setTitle('Bookings / बुकिंग');load();},[setTitle,load]);

  const cancel=async(id)=>{
    if(!window.confirm('Cancel this booking?')) return;
    setCancelling(id);
    try{await api.cancelBooking(id);showT('Booking cancelled');load();}
    catch(e){showT(e.message,'error');}
    finally{setCancelling(null);}
  };

  const filtered=bookings.filter(b=>
    !search||(b.rationCardNumber||'').toUpperCase().includes(search.toUpperCase())||
    (b.mobileNumber||'').includes(search)||(b.customerName||'').toLowerCase().includes(search.toLowerCase())
  );
  const counts={total:bookings.length,confirmed:bookings.filter(b=>b.status==='confirmed').length,cancelled:bookings.filter(b=>b.status==='cancelled').length,missed:bookings.filter(b=>b.status==='missed').length};

  return(
    <div>
      {toast&&<div className="toast-wrap"><div className={`toast ${toast.type}`}><div className="toast-dot"/>{toast.msg}</div></div>}
      <div className="page-hdr">
        <div className="ph-row">
          <div><h2>🎫 Bookings Manager</h2><p>View, search and manage all slot bookings</p></div>
          <button className="btn btn-outline btn-sm" onClick={()=>api.exportCSV(shop.shopId)}>⬇️ Export CSV</button>
        </div>
      </div>

      <div style={{display:'flex',gap:10,marginBottom:18,flexWrap:'wrap'}}>
        {[{val:counts.total,lbl:'Total',c:'var(--purple)',bg:'var(--purple-lt)'},{val:counts.confirmed,lbl:'Confirmed',c:'var(--green)',bg:'var(--green-lt)'},{val:counts.cancelled,lbl:'Cancelled',c:'var(--red)',bg:'var(--red-lt)'},{val:counts.missed,lbl:'Missed',c:'var(--yellow)',bg:'var(--yellow-lt)'}].map((s,i)=>(
          <div key={i} style={{background:s.bg,borderRadius:10,padding:'9px 18px',textAlign:'center',minWidth:80,border:'1px solid var(--border)'}}>
            <div style={{fontSize:'1.4rem',fontWeight:800,color:s.c}}>{s.val}</div>
            <div style={{fontSize:'.7rem',color:'var(--gray-400)'}}>{s.lbl}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{marginBottom:18}}>
        <div className="card-body" style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'flex-end'}}>
          <div style={{flex:1,minWidth:130}}>
            <label className="form-label">📅 Date</label>
            <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="form-ctrl"/>
          </div>
          <div style={{flex:1,minWidth:130}}>
            <label className="form-label">🏷️ Status</label>
            <select value={status} onChange={e=>setStatus(e.target.value)} className="form-ctrl">
              <option value="">All Status</option>
              <option value="confirmed">Confirmed</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="missed">Missed</option>
            </select>
          </div>
          <div style={{flex:2,minWidth:180}}>
            <label className="form-label">🔍 Search</label>
            <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Ration card, mobile or name..." className="form-ctrl"/>
          </div>
          <button className="btn btn-primary btn-sm" onClick={load}>Apply</button>
        </div>
      </div>

      <div className="card">
        <div className="card-hdr"><span className="card-title">Bookings ({filtered.length})</span><span style={{fontSize:'.8rem',color:'var(--gray-400)'}}>{date}</span></div>
        {loading?<div className="loader"><div className="spinner"/></div>:filtered.length===0?(
          <div style={{textAlign:'center',padding:56,color:'var(--gray-400)'}}>
            <div style={{fontSize:'3rem',marginBottom:12}}>🎫</div><p>No bookings found for selected filters</p>
          </div>
        ):(
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr><th>Token</th><th>Ration Card</th><th>Customer</th><th>Mobile</th><th>Time</th><th>Status</th><th>Booked At</th><th>Action</th></tr>
              </thead>
              <tbody>
                {filtered.map(b=>(
                  <tr key={b._id}>
                    <td><div style={{background:'var(--purple-lt)',border:'1px solid var(--border)',borderRadius:6,padding:'2px 10px',fontWeight:800,fontSize:'.85rem',color:'var(--purple)',display:'inline-block',fontFamily:'monospace'}}>#{b.tokenNumber}</div></td>
                    <td style={{fontFamily:'monospace',fontWeight:600,fontSize:'.82rem'}}>{b.rationCardNumber}</td>
                    <td>{b.customerName}</td>
                    <td style={{color:'var(--gray-400)',fontFamily:'monospace'}}>{b.mobileNumber}</td>
                    <td style={{fontWeight:700,color:'var(--purple)'}}>
                      {b.slotTime}
                      {b.reassignedDueToRaceCondition && (
                        <div title={`Original requested slot: ${b.originalSlotTime}`} style={{ fontSize: '.68rem', color: 'var(--orange)', fontWeight: 600 }}>
                          ⚡ Auto-allotted ({b.originalSlotTime})
                        </div>
                      )}
                    </td>
                    <td><span className={`badge ${SB[b.status]||'b-gray'}`}>{b.status}</span></td>
                    <td style={{fontSize:'.74rem',color:'var(--gray-400)'}}>{new Date(b.createdAt).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit',day:'numeric',month:'short'})}</td>
                    <td>{b.status==='confirmed'&&<button className="btn btn-danger btn-sm" onClick={()=>cancel(b._id)} disabled={cancelling===b._id}>{cancelling===b._id?'⏳':'✕ Cancel'}</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
