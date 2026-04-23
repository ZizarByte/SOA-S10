// pages/Dashboard.jsx — Panel principal con estadísticas y envíos realizados
import React, { useState, useEffect, useCallback } from 'react';
import { dashboardAPI } from '../services/api.js';

function StatCard({ label, value, sub, accent }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${accent || ''}`}>{value}</div>
      {sub && <div style={{ fontSize: '.72rem', color: '#7c8fa6', marginTop: '.3rem' }}>{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const [stats,     setStats]     = useState(null);
  const [shipments, setShipments] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [search,    setSearch]    = useState('');
  const [query,     setQuery]     = useState('');
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');

  // Cargar estadísticas
  useEffect(() => {
    dashboardAPI.stats()
      .then(r => setStats(r.data))
      .catch(() => setError('No se pudo conectar con la API REST'));
  }, []);

  // Cargar envíos
  const load = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const r = await dashboardAPI.shipments({ page, limit: 8, search: query || undefined });
      setShipments(r.data.data);
      setPagination(r.data.pagination);
    } catch {
      setError('Error al cargar envíos');
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => { load(1); }, [load]);

  const handleSearch = e => {
    e.preventDefault();
    setQuery(search);
  };

  const fmt = n => `$${Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN`;
  const fmtDate = d => new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div className="page">
      {/* ── Header ── */}
      <div className="page-header">
        <h1 className="page-title">Panel de <span>Control</span></h1>
        <p className="page-sub">Resumen de actividad — conectado a la API REST (puerto 3001)</p>
      </div>

      {error && <div className="alert alert-error" style={{marginBottom:'1.5rem'}}>{error}</div>}

      {/* ── Stats ── */}
      <div className="stats-grid">
        <StatCard
          label="Total Envíos"
          value={stats ? stats.total_shipments : '—'}
          sub="Histórico completo"
        />
        <StatCard
          label="Gasto Total"
          value={stats ? fmt(stats.total_spent) : '—'}
          accent="amber"
          sub="Acumulado"
        />
        <StatCard
          label="Paquetes Pendientes"
          value={stats ? stats.pending_packages : '—'}
          sub="En espera de envío"
        />
        <StatCard
          label="Costo Promedio"
          value={stats ? fmt(stats.avg_cost) : '—'}
          accent="green"
          sub="Por envío"
        />
        <StatCard
          label="Últimos 30 días"
          value={stats ? stats.shipments_last_30_days : '—'}
          sub="Envíos recientes"
        />
      </div>

      {/* ── API Info badge ── */}
      <div style={{
        display: 'flex', gap: '.6rem', marginBottom: '1.5rem', flexWrap: 'wrap'
      }}>
        <div style={{
          display:'inline-flex', alignItems:'center', gap:'.5rem',
          background:'rgba(16,185,129,.08)', border:'1px solid rgba(16,185,129,.2)',
          borderRadius:20, padding:'.3rem .9rem', fontSize:'.72rem', color:'#10b981'
        }}>
          <span style={{width:7,height:7,borderRadius:'50%',background:'#10b981',display:'inline-block'}}/>
          GET /api/dashboard/shipments
        </div>
        <div style={{
          display:'inline-flex', alignItems:'center', gap:'.5rem',
          background:'rgba(16,185,129,.08)', border:'1px solid rgba(16,185,129,.2)',
          borderRadius:20, padding:'.3rem .9rem', fontSize:'.72rem', color:'#10b981'
        }}>
          <span style={{width:7,height:7,borderRadius:'50%',background:'#10b981',display:'inline-block'}}/>
          GET /api/dashboard/stats
        </div>
      </div>

      {/* ── Tabla de envíos ── */}
      <div className="card" style={{padding:0}}>
        {/* toolbar */}
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'1rem 1.4rem', borderBottom:'1px solid var(--border)', gap:'1rem', flexWrap:'wrap'
        }}>
          <div style={{fontFamily:'var(--font-head)', fontSize:'1rem', fontWeight:700, letterSpacing:'.06em', textTransform:'uppercase', color:'var(--text)'}}>
            Envíos Realizados
          </div>
          <form onSubmit={handleSearch} style={{display:'flex', gap:'.5rem'}}>
            <input
              className="form-input"
              style={{width:220, padding:'.45rem .8rem', fontSize:'.82rem'}}
              placeholder="Buscar tracking, destinatario…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <button type="submit" className="btn btn-outline btn-sm">Buscar</button>
            {query && (
              <button type="button" className="btn btn-outline btn-sm" onClick={() => { setSearch(''); setQuery(''); }}>✕</button>
            )}
          </form>
        </div>

        {/* tabla */}
        <div className="table-wrap">
          {loading ? (
            <div style={{textAlign:'center', padding:'3rem', color:'var(--text-muted)'}}>
              <span className="loader" style={{width:28,height:28}}/><br/>
              <span style={{fontSize:'.82rem', marginTop:'.8rem', display:'block'}}>Cargando envíos…</span>
            </div>
          ) : shipments.length === 0 ? (
            <div style={{textAlign:'center', padding:'3rem', color:'var(--text-dim)', fontSize:'.88rem'}}>
              No se encontraron envíos{query ? ` para "${query}"` : ''}.
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Código de Rastreo</th>
                  <th>Destinatario</th>
                  <th>Dirección</th>
                  <th>CP</th>
                  <th>Peso</th>
                  <th>Costo</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {shipments.map(s => (
                  <tr key={s.id}>
                    <td><span className="tracking-code">{s.tracking_code}</span></td>
                    <td style={{fontWeight:500}}>{s.recipient_name}</td>
                    <td style={{color:'var(--text-muted)', maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{s.recipient_address}</td>
                    <td style={{fontFamily:'var(--font-mono)', fontSize:'.78rem'}}>{s.postal_code}</td>
                    <td style={{color:'var(--text-muted)'}}>{s.weight} kg</td>
                    <td style={{color:'var(--amber)', fontWeight:600, fontFamily:'var(--font-mono)', fontSize:'.82rem'}}>{fmt(s.cost)}</td>
                    <td style={{color:'var(--text-muted)', fontSize:'.8rem'}}>{fmtDate(s.shipped_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* paginación */}
        {pagination.totalPages > 1 && (
          <div style={{
            display:'flex', alignItems:'center', justifyContent:'space-between',
            padding:'.8rem 1.4rem', borderTop:'1px solid var(--border)',
            fontSize:'.8rem', color:'var(--text-muted)'
          }}>
            <span>{pagination.total} envíos en total</span>
            <div style={{display:'flex', gap:'.4rem'}}>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => load(pagination.page - 1)}
                disabled={pagination.page <= 1}
              >← Anterior</button>
              <span style={{padding:'.4rem .8rem', background:'var(--bg-input)', borderRadius:4}}>
                {pagination.page} / {pagination.totalPages}
              </span>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => load(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
              >Siguiente →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
