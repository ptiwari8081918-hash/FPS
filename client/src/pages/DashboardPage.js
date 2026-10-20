import React,{useState,useEffect} from 'react';
import {Routes,Route,useNavigate,useLocation,Link,Navigate} from 'react-router-dom';
import {useAuth} from '../context/AuthContext';
import DashboardHome from './dashboard/DashboardHome';
import AnalyticsPage from './dashboard/AnalyticsPage';
import FPSDataPage   from './dashboard/FPSDataPage';
import BookingsList  from './dashboard/BookingsList';
import SlotManager   from './dashboard/SlotManager';
import SettingsPage  from './dashboard/SettingsPage';
import CoinClaimPage from './dashboard/CoinClaimPage';
import ChangePasswordPage from './dashboard/ChangePasswordPage';
import FeedbackModal from '../components/FeedbackModal';

const NAV=[
  {path:'',icon:'🏠',label:'Dashboard',hi:'होम'},
  {path:'analytics',icon:'📊',label:'Analytics',hi:'विश्लेषण'},
  {path:'fps-data',icon:'🌾',label:'FPS Data',hi:'FPS डेटा'},
  {path:'bookings',icon:'🎫',label:'Bookings',hi:'बुकिंग'},
  {path:'slots',icon:'⏱️',label:'Slot Manager',hi:'स्लॉट'},
  {path:'coins',icon:'🪙',label:'Coin Wallet',hi:'सिक्के'},
  {path:'settings',icon:'⚙️',label:'Settings',hi:'सेटिंग्स'},
];

export default function DashboardPage(){
  const{shop,logout}=useAuth();
  const nav=useNavigate();
  const loc=useLocation();
  const[title,setTitle]=useState('Dashboard');
  const[sideOpen,setSideOpen]=useState(false);
  const[showFeedback,setShowFeedback]=useState(false);
  const snap=shop?.snapshot||{};
  // Fix: show only shopName once (shop owner and dealer are same person)
  const shopName=snap.fpsName||shop?.shopName||'FPS Shop';
  const ownerName=snap.ownerName||shop?.ownerName||'';
  const isOn=p=>{
    const f='/dashboard'+(p?'/'+p:'');
    return p===''?loc.pathname==='/dashboard'||loc.pathname==='/dashboard/':loc.pathname.startsWith(f);
  };
  // Close sidebar on route change (mobile)
  useEffect(()=>{ setSideOpen(false); },[loc.pathname]);

  const doLogout=()=>{ logout(); nav('/'); };

  // Default password not yet changed — lock the whole dashboard behind the
  // change-password screen until that's done.
  if(shop?.mustChangePassword && loc.pathname!=='/dashboard/change-password'){
    return <Navigate to="/dashboard/change-password" replace/>;
  }

  return(
    <div className="dash-layout">
      {/* Sidebar overlay (mobile) */}
      <div className={'sidebar-overlay'+(sideOpen?' open':'')} onClick={()=>setSideOpen(false)}/>

      <aside className={'sidebar'+(sideOpen?' open':'')}>
        <div className="sb-brand">
          <div className="sb-logo">
            <div className="sb-logo-icon">🌾</div>
            <div className="sb-logo-name">AnnSeva</div>
          </div>
          <div className="sb-shop-id">FPS: {shop?.shopId}</div>
          {/* Show shop name once — owner and dealer are the same person */}
          <div className="sb-shop-name">{shopName}</div>
          {ownerName&&(
            <div style={{fontSize:'.7rem',color:'rgba(255,255,255,.6)',marginTop:3,display:'flex',alignItems:'center',gap:4}}>
              <span>👤</span><span>{ownerName}</span>
            </div>
          )}
        </div>
        <nav className="sb-nav">
          <div className="sb-lbl">Menu</div>
          {NAV.map(n=>(
            <Link key={n.path} to={'/dashboard'+(n.path?'/'+n.path:'')}
              className={'sb-item'+(isOn(n.path)?' active':'')}>
              <span className="sb-icon">{n.icon}</span>
              <span>{n.label}<span className="sb-sub">{n.hi}</span></span>
            </Link>
          ))}
          <div className="sb-lbl" style={{marginTop:10}}>Quick</div>
          <button className="sb-item" onClick={()=>window.open('/customer/'+shop?.shopId,'_blank')}>
            <span className="sb-icon">🔗</span>
            <span>Customer Link<span className="sb-sub">ग्राहक लिंक</span></span>
          </button>
          <button className="sb-item" onClick={()=>setShowFeedback(true)}>
            <span className="sb-icon">💬</span>
            <span>Feedback<span className="sb-sub">प्रतिपुष्टि</span></span>
          </button>
        </nav>
        <div className="sb-foot">
          <button className="logout-btn" onClick={doLogout}>🚪 Logout / लॉगआउट</button>
        </div>
      </aside>

      <main className="dash-main">
        <div className="topbar">
          <div className="topbar-left">
            <button className="mobile-menu-btn" onClick={()=>setSideOpen(o=>!o)} aria-label="Toggle navigation">☰</button>
            <div className="topbar-title">{title}</div>
          </div>
          <div className="topbar-right">
            <button className="btn btn-ghost btn-sm topbar-hide-mobile" onClick={()=>setShowFeedback(true)}>
              💬 Feedback
            </button>
            <button className="btn btn-ghost btn-sm topbar-hide-mobile" onClick={()=>window.open('/customer/'+shop?.shopId,'_blank')}>
              🔗 Customer Link
            </button>
            <div className="shop-pill">
              <div className="sp-dot"/>
              <div>
                <div className="sp-name">{shopName}</div>
                <div className="sp-id">#{shop?.shopId}</div>
              </div>
            </div>
          </div>
        </div>
        <div className="page-body">
          <Routes>
            <Route path="/"          element={<DashboardHome setTitle={setTitle}/>}/>
            <Route path="/analytics" element={<AnalyticsPage setTitle={setTitle}/>}/>
            <Route path="/fps-data"  element={<FPSDataPage   setTitle={setTitle}/>}/>
            <Route path="/bookings"  element={<BookingsList   setTitle={setTitle}/>}/>
            <Route path="/slots"     element={<SlotManager    setTitle={setTitle}/>}/>
            <Route path="/coins"     element={<CoinClaimPage  setTitle={setTitle}/>}/>
            <Route path="/settings"  element={<SettingsPage   setTitle={setTitle}/>}/>
            <Route path="/change-password" element={<ChangePasswordPage setTitle={setTitle}/>}/>
          </Routes>
        </div>
      </main>

      {showFeedback && (
        <FeedbackModal
          onClose={()=>setShowFeedback(false)}
          defaultShopId={shop?.shopId}
        />
      )}
    </div>
  );
}
