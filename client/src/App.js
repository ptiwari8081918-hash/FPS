import React from 'react';
import {BrowserRouter,Routes,Route,Navigate} from 'react-router-dom';
import {AuthProvider,useAuth} from './context/AuthContext';
import LandingPage   from './pages/LandingPage';
import LoginPage     from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import CustomerPage  from './pages/CustomerPage';

function Private({children}){const{shop}=useAuth();return shop?children:<Navigate to="/login" replace/>;}

export default function App(){
  return(
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage/>}/>
          <Route path="/login" element={<LoginPage/>}/>
          {/* Customer with optional shopId — supports district search mode */}
          <Route path="/customer/:shopId" element={<CustomerPage/>}/>
          <Route path="/customer" element={<CustomerPage/>}/>
          <Route path="/dashboard/*" element={<Private><DashboardPage/></Private>}/>
          <Route path="*" element={<Navigate to="/" replace/>}/>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
