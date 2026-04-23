// pages/Login.jsx — Pantalla de login
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App.jsx';

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ email: 'demo@correos.mx', password: 'demo123' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handle = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const submit = async e => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await login(form.email, form.password);
      nav('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo-wrap">
          <div className="login-logo-icon">📦</div>
          <div className="login-title">CorreosMX</div>
          <div className="login-sub">Sistema de Gestión de Envíos</div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={submit}>
          <div className="form-grid" style={{gap:'.9rem'}}>
            <div className="form-group">
              <label className="form-label">Correo Electrónico</label>
              <input
                className="form-input"
                type="email" name="email"
                value={form.email} onChange={handle}
                placeholder="usuario@correos.mx"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Contraseña</label>
              <input
                className="form-input"
                type="password" name="password"
                value={form.password} onChange={handle}
                placeholder="••••••••"
                required
              />
            </div>
            <button className="btn btn-primary" type="submit" disabled={loading} style={{marginTop:'.4rem'}}>
              {loading ? <span className="loader" style={{width:16,height:16}}/> : null}
              {loading ? 'Ingresando…' : 'Iniciar Sesión'}
            </button>
          </div>
        </form>

        <hr className="divider" />
        <div style={{background:'rgba(245,158,11,.08)',border:'1px solid rgba(245,158,11,.2)',borderRadius:6,padding:'.8rem 1rem',fontSize:'.78rem',color:'#7c8fa6'}}>
          <strong style={{color:'#f59e0b'}}>Demo:</strong><br/>
          Email: <code style={{color:'#e2e8f0'}}>demo@correos.mx</code><br/>
          Pass: <code style={{color:'#e2e8f0'}}>demo123</code>
        </div>
      </div>
    </div>
  );
}
