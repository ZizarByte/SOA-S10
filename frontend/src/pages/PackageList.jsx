// pages/PackageList.jsx — Gestión CRUD de paquetes pendientes
import React, { useState, useEffect, useCallback } from 'react';
import { packagesAPI, soapAPI } from '../services/api.js';

function EditModal({ pkg, onClose, onSaved }) {
  const [form, setForm] = useState({
    sender_name:           pkg.sender_name,
    recipient_name:        pkg.recipient_name,
    recipient_address:     pkg.recipient_address,
    recipient_postal_code: pkg.recipient_postal_code,
    weight:                pkg.weight,
    width:                 pkg.width,
    height:                pkg.height,
    depth:                 pkg.depth,
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const handle = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const submit = async e => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      await packagesAPI.update(pkg.id, {
        ...form,
        weight: parseFloat(form.weight),
        width:  parseFloat(form.width),
        height: parseFloat(form.height),
        depth:  parseFloat(form.depth),
      });
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al actualizar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position:'fixed', inset:0, background:'rgba(0,0,0,.7)', zIndex:999,
      display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem'
    }}>
      <div className="card" style={{width:'100%', maxWidth:560, maxHeight:'90vh', overflowY:'auto'}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.2rem'}}>
          <div style={{fontFamily:'var(--font-head)', fontSize:'1.2rem', fontWeight:800, letterSpacing:'.06em', textTransform:'uppercase'}}>
            Editar Paquete
          </div>
          <button onClick={onClose} style={{background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer', fontSize:'1.2rem'}}>✕</button>
        </div>

        {error && <div className="alert alert-error" style={{marginBottom:'1rem'}}>{error}</div>}

        <form onSubmit={submit}>
          <div className="form-grid" style={{gap:'.8rem'}}>
            <div className="form-group">
              <label className="form-label">Remitente</label>
              <input className="form-input" name="sender_name" value={form.sender_name} onChange={handle} required />
            </div>
            <div className="form-group">
              <label className="form-label">Destinatario</label>
              <input className="form-input" name="recipient_name" value={form.recipient_name} onChange={handle} required />
            </div>
            <div className="form-group">
              <label className="form-label">Dirección</label>
              <input className="form-input" name="recipient_address" value={form.recipient_address} onChange={handle} required />
            </div>
            <div className="form-row-2 form-grid">
              <div className="form-group">
                <label className="form-label">Código Postal</label>
                <input className="form-input" name="recipient_postal_code" value={form.recipient_postal_code} onChange={handle} style={{fontFamily:'var(--font-mono)'}} required />
              </div>
              <div className="form-group">
                <label className="form-label">Peso (kg)</label>
                <input className="form-input" type="number" name="weight" step="0.1" value={form.weight} onChange={handle} required />
              </div>
            </div>
            <div className="form-grid form-row-3">
              <div className="form-group">
                <label className="form-label">Ancho cm</label>
                <input className="form-input" type="number" name="width" step="0.5" value={form.width} onChange={handle} />
              </div>
              <div className="form-group">
                <label className="form-label">Alto cm</label>
                <input className="form-input" type="number" name="height" step="0.5" value={form.height} onChange={handle} />
              </div>
              <div className="form-group">
                <label className="form-label">Largo cm</label>
                <input className="form-input" type="number" name="depth" step="0.5" value={form.depth} onChange={handle} />
              </div>
            </div>
            <div style={{display:'flex', gap:'.6rem', marginTop:'.4rem'}}>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? <><span className="loader" style={{width:14,height:14}}/> Guardando…</> : '💾 Guardar Cambios'}
              </button>
              <button type="button" className="btn btn-outline" onClick={onClose}>Cancelar</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function PackageList() {
  const [packages, setPackages] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [success,  setSuccess]  = useState('');
  const [editing,  setEditing]  = useState(null);
  const [confirming, setConfirming] = useState(null); // id del paquete a confirmar
  const [calcLoading, setCalcLoading] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await packagesAPI.list();
      setPackages(r.data);
    } catch {
      setError('Error al cargar paquetes. ¿Está corriendo la API REST en puerto 3001?');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async id => {
    if (!window.confirm('¿Eliminar este paquete?')) return;
    try {
      await packagesAPI.delete(id);
      setSuccess('Paquete eliminado');
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al eliminar');
    }
  };

  // Calcular costo SOAP y luego confirmar envío REST
  const handleConfirm = async id => {
    const pkg = packages.find(p => p.id === id);
    if (!pkg) return;

    // Si ya tiene costo, confirmar directo
    if (pkg.cost) {
      try {
        const r = await packagesAPI.confirm(id);
        setSuccess(`✔ Envío confirmado. Tracking: ${r.data.tracking_code}`);
        load();
      } catch (err) {
        setError(err.response?.data?.error || 'Error al confirmar');
      }
      return;
    }

    // Sin costo: calcular primero con SOAP
    setCalcLoading(id);
    try {
      const soap = await soapAPI.calculateCost({
        weight: pkg.weight, width: pkg.width, height: pkg.height, depth: pkg.depth,
        serviceType: 'STANDARD', destinationPostalCode: pkg.recipient_postal_code,
      });
      // Actualizar paquete con costo y barcode
      await packagesAPI.update(id, { cost: soap.cost, barcode: soap.barcode });
      // Confirmar
      const r = await packagesAPI.confirm(id);
      setSuccess(`✔ Envío confirmado (costo calculado vía SOAP: $${soap.cost} MXN). Tracking: ${r.data.tracking_code}`);
      load();
    } catch (err) {
      setError('Error al calcular costo o confirmar envío');
    } finally {
      setCalcLoading(null);
    }
  };

  const fmtMXN  = n => n ? `$${Number(n).toLocaleString('es-MX', { minimumFractionDigits:2 })} MXN` : '—';
  const fmtDate = d => new Date(d).toLocaleDateString('es-MX', { day:'2-digit', month:'short', year:'numeric' });

  return (
    <div className="page">
      {editing && (
        <EditModal
          pkg={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); setSuccess('Paquete actualizado'); load(); }}
        />
      )}

      {/* ── Header ── */}
      <div className="page-header">
        <h1 className="page-title">Mis <span>Paquetes</span></h1>
        <p className="page-sub">CRUD via API REST (GET · POST · PUT · DELETE) — puerto 3001</p>
      </div>

      {/* ── Endpoint badges ── */}
      <div style={{display:'flex', gap:'.5rem', marginBottom:'1.5rem', flexWrap:'wrap'}}>
        {['GET /api/packages','PUT /api/packages/:id','DELETE /api/packages/:id','POST /api/packages/:id/confirm'].map(e => (
          <div key={e} style={{
            display:'inline-flex', alignItems:'center', gap:'.4rem',
            background:'rgba(16,185,129,.08)', border:'1px solid rgba(16,185,129,.2)',
            borderRadius:20, padding:'.25rem .75rem',
            fontSize:'.68rem', color:'#10b981', fontFamily:'var(--font-mono)'
          }}>
            <span style={{fontWeight:700}}>{e.split(' ')[0]}</span> {e.split(' ')[1]}
          </div>
        ))}
      </div>

      {success && <div className="alert alert-success" style={{marginBottom:'1rem'}}>{success}</div>}
      {error   && <div className="alert alert-error"   style={{marginBottom:'1rem'}}>{error}</div>}

      {/* ── Tabla ── */}
      <div className="card" style={{padding:0}}>
        <div style={{
          padding:'1rem 1.4rem', borderBottom:'1px solid var(--border)',
          display:'flex', justifyContent:'space-between', alignItems:'center'
        }}>
          <div style={{fontFamily:'var(--font-head)', fontWeight:700, fontSize:'1rem', letterSpacing:'.06em', textTransform:'uppercase'}}>
            Paquetes Pendientes
          </div>
          <a href="/nuevo-envio" className="btn btn-primary btn-sm">+ Nuevo Envío</a>
        </div>

        {loading ? (
          <div style={{textAlign:'center', padding:'3rem', color:'var(--text-muted)'}}>
            <span className="loader" style={{width:28,height:28}}/><br/>
            <span style={{fontSize:'.82rem', marginTop:'.8rem', display:'block'}}>Cargando…</span>
          </div>
        ) : packages.length === 0 ? (
          <div style={{textAlign:'center', padding:'3rem', color:'var(--text-dim)'}}>
            <div style={{fontSize:'2.5rem', marginBottom:'.5rem'}}>📭</div>
            <div style={{fontSize:'.88rem'}}>No tienes paquetes pendientes.</div>
            <a href="/nuevo-envio" className="btn btn-primary btn-sm" style={{marginTop:'1rem', display:'inline-flex'}}>Crear Primer Envío</a>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Tracking</th>
                  <th>Remitente</th>
                  <th>Destinatario</th>
                  <th>CP</th>
                  <th>Peso</th>
                  <th>Costo</th>
                  <th>Estado</th>
                  <th>Creado</th>
                  <th style={{textAlign:'right'}}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {packages.map(pkg => (
                  <tr key={pkg.id}>
                    <td><span className="tracking-code">{pkg.tracking_code}</span></td>
                    <td style={{fontWeight:500, fontSize:'.85rem'}}>{pkg.sender_name}</td>
                    <td style={{fontSize:'.85rem'}}>{pkg.recipient_name}</td>
                    <td style={{fontFamily:'var(--font-mono)', fontSize:'.75rem'}}>{pkg.recipient_postal_code}</td>
                    <td style={{color:'var(--text-muted)', fontSize:'.82rem'}}>{pkg.weight} kg</td>
                    <td style={{fontFamily:'var(--font-mono)', fontSize:'.78rem', color: pkg.cost ? 'var(--amber)' : 'var(--text-dim)'}}>
                      {fmtMXN(pkg.cost)}
                    </td>
                    <td>
                      <span className={`badge badge-${pkg.status === 'pending' ? 'pending' : 'shipped'}`}>
                        {pkg.status === 'pending' ? '⏳ Pendiente' : '✅ Enviado'}
                      </span>
                    </td>
                    <td style={{color:'var(--text-muted)', fontSize:'.78rem'}}>{fmtDate(pkg.created_at)}</td>
                    <td>
                      <div style={{display:'flex', gap:'.35rem', justifyContent:'flex-end'}}>
                        {/* Editar — REST PUT */}
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => setEditing(pkg)}
                          title="Editar (PUT /api/packages/:id)"
                        >✏️</button>

                        {/* Confirmar envío — SOAP + REST */}
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => handleConfirm(pkg.id)}
                          disabled={calcLoading === pkg.id}
                          title="Confirmar envío (SOAP + REST)"
                          style={{borderColor:'rgba(16,185,129,.4)', color:'var(--green)'}}
                        >
                          {calcLoading === pkg.id
                            ? <span className="loader" style={{width:12,height:12}}/>
                            : '🚀'}
                        </button>

                        {/* Eliminar — REST DELETE */}
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDelete(pkg.id)}
                          title="Eliminar (DELETE /api/packages/:id)"
                        >🗑</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Leyenda de acciones */}
        {packages.length > 0 && (
          <div style={{
            padding:'.8rem 1.4rem', borderTop:'1px solid var(--border)',
            display:'flex', gap:'1.2rem', flexWrap:'wrap',
            fontSize:'.72rem', color:'var(--text-dim)'
          }}>
            <span>✏️ Editar datos · PUT /api/packages/:id</span>
            <span>🚀 Confirmar envío · SOAP CalculateShippingCost → POST /api/packages/:id/confirm</span>
            <span>🗑 Eliminar · DELETE /api/packages/:id</span>
          </div>
        )}
      </div>
    </div>
  );
}
