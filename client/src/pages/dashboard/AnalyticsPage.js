import React,{useEffect,useState} from 'react';
import {AreaChart,Area,BarChart,Bar,XAxis,YAxis,Tooltip,ResponsiveContainer,CartesianGrid} from 'recharts';
import {api} from '../../utils/api';
import {useAuth} from '../../context/AuthContext';

const TT=({active,payload,label})=>{
  if(!active||!payload?.length) return null;
  return <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:8,padding:'8px 12px',fontSize:'.82rem'}}>
    <div style={{color:'var(--gray-400)',marginBottom:4}}>{label}</div>
    {payload.map((p,i)=><div key={i} style={{color:p.color||'var(--purple)',fontWeight:700}}>{p.name}: {p.value}</div>)}
  </div>;
};

export default function AnalyticsPage({setTitle}){
  const{shop}=useAuth();
  const[data,setData]=useState(null);
  const[loading,setLoading]=useState(true);
  useEffect(()=>{
    setTitle('Analytics / विश्लेषण');
    api.getAnalytics(shop.shopId).then(r=>setData(r.analytics)).catch(()=>{}).finally(()=>setLoading(false));
  },[shop.shopId,setTitle]);
  if(loading) return <div className="loader"><div className="spinner"/></div>;
  const snap=data?.snapshot||{};
  const peakHour=(data?.hourlyData||[]).reduce((mx,h)=>h.count>mx.count?h:mx,{count:0,label:'N/A'});
  const bestDay=(data?.weekTrend||[]).reduce((mx,d)=>d.count>mx.count?d:mx,{count:0,date:'N/A'});
  const avg=data?.weekTrend?.length?Math.round(data.weekTrend.reduce((s,d)=>s+d.count,0)/7):0;
  return(
    <div>
      <div className="page-hdr">
        <div className="ph-row">
          <div><h2>📊 Booking Analytics</h2><p>Detailed insights into slot bookings and shop performance</p></div>
          <button className="btn btn-outline btn-sm" onClick={()=>api.exportCSV(shop.shopId)}>⬇️ Export CSV</button>
        </div>
      </div>
      <div className="stats-grid">
        {[
          {icon:'🎫',val:data?.totalBookings||0,lbl:'Total Bookings',sub:'All time',cl:'c1',il:'i1'},
          {icon:'📅',val:data?.todayBookings||0,lbl:"Today's Bookings",sub:'Live',cl:'c2',il:'i2'},
          {icon:'❌',val:data?.missedBookings||0,lbl:'Missed',sub:'Did not show',cl:'c4',il:'i4'},
          {icon:'⚡',val:`${data?.utilizationRate||0}%`,lbl:'Utilization',sub:'Slots used',cl:'c3',il:'i3'},
        ].map((s,i)=>(
          <div key={i} className={`stat-card ${s.cl}`}>
            <div className={`sc-icon ${s.il}`}>{s.icon}</div>
            <div>
              <div className="sc-val">{typeof s.val==='number'?s.val.toLocaleString():s.val}</div>
              <div className="sc-lbl">{s.lbl}</div><div className="sc-sub">{s.sub}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="card">
        <div className="card-hdr"><span className="card-title">📈 7-Day Booking Trend</span></div>
        <div className="card-body">
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={data?.weekTrend||[]}>
              <defs><linearGradient id="ag2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#1e3a5f" stopOpacity={0.18}/>
                <stop offset="95%" stopColor="#1e3a5f" stopOpacity={0}/>
              </linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
              <XAxis dataKey="date" tick={{fontSize:11,fill:'var(--gray-400)'}} tickFormatter={d=>new Date(d).toLocaleDateString('en-IN',{weekday:'short',day:'numeric'})}/>
              <YAxis tick={{fontSize:10,fill:'var(--gray-400)'}}/>
              <Tooltip content={<TT/>}/>
              <Area type="monotone" dataKey="count" stroke="var(--purple)" strokeWidth={2.5} fill="url(#ag2)" name="Bookings"/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="charts-grid">
        <div className="card">
          <div className="card-hdr"><span className="card-title">⏰ Hourly Pattern</span><span className="badge b-orange">Peak: {peakHour.label}</span></div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={(data?.hourlyData||[]).filter(h=>h.hour>=7&&h.hour<=19)}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
                <XAxis dataKey="label" tick={{fontSize:9,fill:'var(--gray-400)'}}/>
                <YAxis tick={{fontSize:10,fill:'var(--gray-400)'}}/>
                <Tooltip content={<TT/>}/>
                <Bar dataKey="count" fill="var(--purple)" radius={[4,4,0,0]} name="Bookings"/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <div className="card-hdr"><span className="card-title">📡 Distribution Metrics</span></div>
          <div className="card-body">
            {[
              ['Total Cards',(snap.totalCards||0).toLocaleString(),'var(--purple)',100],
              ['AAY Cards',(snap.aayCards||0).toLocaleString(),'var(--yellow)',snap.totalCards?Math.round((snap.aayCards/snap.totalCards)*100):0],
              ['PHH Cards',(snap.phhCards||0).toLocaleString(),'var(--green)',snap.totalCards?Math.round((snap.phhCards/snap.totalCards)*100):0],
              ['Achievement',`${snap.percentAch||0}%`,'var(--purple)',snap.percentAch||0],
              ['Total Txns',(snap.totalTxns||0).toLocaleString(),'var(--purple)',snap.percentAch||0],
            ].map(([l,v,c,p])=>(
              <div key={l} style={{marginBottom:13}}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:'.82rem',marginBottom:4}}>
                  <span style={{color:'var(--gray-500)',fontWeight:500}}>{l}</span>
                  <strong style={{color:c}}>{v}</strong>
                </div>
                <div className="progress" style={{height:5}}><div className="progress-bar" style={{width:`${Math.min(p,100)}%`,background:c}}/></div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="g3 mt6">
        {[
          {icon:'🏆',title:'Best Day',val:bestDay.date?.slice(5)||'N/A',sub:`${bestDay.count} bookings`,c:'var(--green)',bg:'var(--green-lt)'},
          {icon:'⚡',title:'Peak Hour',val:peakHour.label,sub:`${peakHour.count} bookings`,c:'var(--purple)',bg:'var(--accent-light)'},
          {icon:'📊',title:'Daily Average',val:avg,sub:'Last 7 days',c:'var(--purple)',bg:'var(--purple-light)'},
        ].map((c,i)=>(
          <div key={i} style={{background:c.bg,borderRadius:'var(--radius)',padding:'20px 22px',border:'1px solid var(--border)'}}>
            <div style={{fontSize:'1.8rem',marginBottom:8}}>{c.icon}</div>
            <div style={{fontSize:'1.5rem',fontWeight:800,color:c.c,marginBottom:4,fontFamily:'monospace'}}>{c.val}</div>
            <div style={{fontWeight:700,color:'var(--gray-800)',fontSize:'.9rem'}}>{c.title}</div>
            <div style={{fontSize:'.76rem',color:'var(--gray-400)',marginTop:4}}>{c.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
