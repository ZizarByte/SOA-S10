// App.jsx — Componente raíz con router y contexto de autenticación
import React, { createContext, useContext, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom';
import { authAPI } from './services/api.js';

import LoginPage    from './pages/Login.jsx';
import Dashboard    from './pages/Dashboard.jsx';
import NewPackage   from './pages/NewPackage.jsx';
import PackageList  from './pages/PackageList.jsx';

// ── Auth Context ──────────────────────────────────────────────────────────
export const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

function AuthProvider({ children }) {
  const [user,  setUser]  = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const saved = localStorage.getItem('user');
    if (token && saved) { setUser(JSON.parse(saved)); }
    setReady(true);
  }, []);

  const login = async (email, password) => {
    const { data } = await authAPI.login(email, password);
    localStorage.setItem('token', data.token);
    localStorage.setItem('user',  JSON.stringify(data.user));
    setUser(data.user);
    return data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  if (!ready) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',color:'#7c8fa6',fontFamily:'DM Sans,sans-serif'}}>Cargando…</div>;
  return <AuthCtx.Provider value={{ user, login, logout }}>{children}</AuthCtx.Provider>;
}

// ── Guard ─────────────────────────────────────────────────────────────────
function Protected({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

// ── Sidebar ───────────────────────────────────────────────────────────────
function Sidebar() {
  const { user, logout } = useAuth();
  const nav = useNavigate();

  const handleLogout = () => { logout(); nav('/login'); };

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-mark">✦ CorreosMX</div>
        <div className="logo-sub">Gestor de Envíos v1.0</div>
      </div>

      <nav className="sidebar-nav">
        <NavLink to="/dashboard"  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
          Dashboard
        </NavLink>

        <NavLink to="/nuevo-envio" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
          Nuevo Envío
        </NavLink>

        <NavLink to="/mis-paquetes" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
          Mis Paquetes
        </NavLink>
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">{user?.name}</div>
        <div style={{marginBottom:'.6rem',fontSize:'.7rem'}}>{user?.email}</div>
        <button className="btn btn-outline btn-sm" onClick={handleLogout} style={{width:'100%',justifyContent:'center'}}>
          Cerrar Sesión
        </button>
      </div>
    </aside>
  );
}

// ── App Shell ─────────────────────────────────────────────────────────────
function AppShell({ children }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content">{children}</main>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={
            <Protected><AppShell><Dashboard /></AppShell></Protected>
          }/>
          <Route path="/nuevo-envio" element={
            <Protected><AppShell><NewPackage /></AppShell></Protected>
          }/>
          <Route path="/mis-paquetes" element={
            <Protected><AppShell><PackageList /></AppShell></Protected>
          }/>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
