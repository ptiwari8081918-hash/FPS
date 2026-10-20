import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { setUnauthorizedHandler } from '../utils/api';

const Ctx = createContext(null);

export function AuthProvider({ children }) {
  const [shop, setShop] = useState(() => {
    try { return JSON.parse(localStorage.getItem('fps_shop') || 'null'); } catch { return null; }
  });
  const [token, setToken] = useState(() => localStorage.getItem('fps_token') || null);
  const [sessionId, setSessionId] = useState(() => localStorage.getItem('fps_session_id') || null);

  // login(shopData, token, sessionId) — called after /auth/login or /auth/change-password,
  // both of which return a fresh { shop, token, sessionId } tuple.
  const login = useCallback((shopData, authToken, authSessionId) => {
    setShop(shopData);
    localStorage.setItem('fps_shop', JSON.stringify(shopData));
    if (authToken) {
      setToken(authToken);
      localStorage.setItem('fps_token', authToken);
    }
    if (authSessionId) {
      setSessionId(authSessionId);
      localStorage.setItem('fps_session_id', authSessionId);
    }
  }, []);

  const logout = useCallback(() => {
    setShop(null);
    setToken(null);
    setSessionId(null);
    localStorage.removeItem('fps_shop');
    localStorage.removeItem('fps_token');
    localStorage.removeItem('fps_session_id');
  }, []);

  useEffect(() => {
    // A 401 from any API call (expired/invalid session) drops us back to login.
    setUnauthorizedHandler(() => logout());
  }, [logout]);

  return <Ctx.Provider value={{ shop, token, sessionId, login, logout }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
