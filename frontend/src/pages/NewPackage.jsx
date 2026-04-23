// pages/NewPackage.jsx — Formulario de nuevo envío (integra REST + SOAP)
import React, { useState } from 'react';
import { packagesAPI, soapAPI } from '../services/api.js';

const INITIAL = {
  sender_name: '',
  recipient_name: '',
  recipient_address: '',
  recipient_postal_code: '',
  weight: '',
  width: '',
  height: '',
  depth: '',
  serviceType: 'STANDARD',
};

// Mini componente de estado de endpoint
function EndpointBadge({ method, path, color = '#10b981' }) {
  return (
    <div style={{
      display:'inline-flex', alignItems:'center', gap:'.4rem',
      background:`rgba(${color === '#10b981' ? '16,185,129' : '245,158,11'},.08)`,
      border:`1px solid rgba(${color === '#10b981' ? '16,185,129' : '245,158,11'},.2)`,
      borderRadius:20, padding:'.25rem .8rem', fontSize:'.68rem',
      color: color, fontFamily:'var(--font-mono)'
    }}>
      <span style={{fontWeight:700}}>{method}</span> {path}
    </div>
  );
}

export default function NewPackage() {
  const [form,     setForm]     = useState(INITIAL);
  const [pcStatus, setPcStatus] = useState(null);   // resultado validación CP
  const [pcLoading,setPcLoading]= useState(false);
  const [soapResult,setSoapResult] = useState(null); // resultado cálculo SOAP
  const [calcLoading,setCalcLoading] = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [success,  setSuccess]  = useState('');
  const [error,    setError]    = useState('');

  const handle = e => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
    if (e.target.name === 'recipient_postal_code') { setPcStatus(null); setSoapResult(null); }
  };

  // ── 1. Validar código postal (SOAP) ──────────────────────────────────────
  const validatePC = async () => {
    if (!form.recipient_postal_code) return;
    setPcLoading(true); setPcStatus(null); setSoapResult(null);
    try {
      const r = await soapAPI.validatePostalCode(form.recipient_postal_code);
      setPcStatus(r);
    } catch {
      setPcStatus({ isValid: false, message: 'Error al conectar con el servicio SOAP (puerto 3002)' });
    } finally {
      setPcLoading(false);
    }
  };

  // ── 2. Calcular costo (SOAP) ──────────────────────────────────────────────
  const calcCost = async () => {
    if (!form.weight) return;
    setCalcLoading(true); setSoapResult(null);
    try {
      const r = await soapAPI.calculateCost({
        weight: parseFloat(form.weight),
        width:  parseFloat(form.width)  || 20,
        height: parseFloat(form.height) || 15,
        depth:  parseFloat(form.depth)  || 10,
        serviceType: form.serviceType,
        destinationPostalCode: form.recipient_postal_code,
      });
      setSoapResult(r);
    } catch {
      setError('Error al conectar con la API SOAP. Asegúrate de que corre en puerto 3002.');
    } finally {
      setCalcLoading(false);
    }
  };

  // ── 3. Guardar paquete (REST) ─────────────────────────────────────────────
  const submit = async e => {
    e.preventDefault();
    if (!soapResult) {
      setError('Calcula el costo del envío antes de guardar.');
      return;
    }
    setSaving(true); setError(''); setSuccess('');
    try {
      await packagesAPI.create({
        ...form,
        weight: parseFloat(form.weight),
        width:  parseFloat(form.width)  || 20,
        height: parseFloat(form.height) || 15,
        depth:  parseFloat(form.depth)  || 10,
        cost:    soapResult.cost,
        barcode: soapResult.barcode,
      });
      setSuccess(`✔ Paquete creado correctamente. Código de barras: ${soapResult.barcode}`);
      setForm(INITIAL); setPcStatus(null); setSoapResult(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar el paquete');
    } finally {
      setSaving(false);
    }
  };

  const fmtMXN = n => `$${Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN`;

  return (
    <div className="page">
      {/* ── Header ── */}
      <div className="page-header">
        <h1 className="page-title">Nuevo <span>Envío</span></h1>
        <p className="page-sub">Llena el formulario · Valida el CP · Calcula el costo · Guarda</p>
      </div>

      {/* ── Flujo de APIs ── */}
      <div style={{
        display:'flex', gap:'.5rem', alignItems:'center', marginBottom:'1.5rem', flexWrap:'wrap'
      }}>
        <EndpointBadge method="SOAP" path="ValidatePostalCode"    color="#f59e0b"/>
        <span style={{color:'var(--text-dim)'}}>→</span>
        <EndpointBadge method="SOAP" path="CalculateShippingCost" color="#f59e0b"/>
        <span style={{color:'var(--text-dim)'}}>→</span>
        <EndpointBadge method="POST" path="/api/packages"          color="#10b981"/>
      </div>

      {success && <div className="alert alert-success">{success}</div>}
      {error   && <div className="alert alert-error">{error}</div>}

      <form onSubmit={submit}>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.5rem'}}>

          {/* ── Col izquierda: datos del envío ────────────────────────── */}
          <div style={{display:'flex', flexDirection:'column', gap:'1.2rem'}}>

            {/* Remitente */}
            <div className="card">
              <div className="section-title">① Remitente</div>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Nombre Completo</label>
                  <input className="form-input" name="sender_name" value={form.sender_name}
                    onChange={handle} placeholder="Tu nombre completo" required />
                </div>
              </div>
            </div>

            {/* Destinatario */}
            <div className="card">
              <div className="section-title">② Destinatario</div>
              <div className="form-grid" style={{gap:'.85rem'}}>
                <div className="form-group">
                  <label className="form-label">Nombre Completo</label>
                  <input className="form-input" name="recipient_name" value={form.recipient_name}
                    onChange={handle} placeholder="Nombre del destinatario" required />
                </div>
                <div className="form-group">
                  <label className="form-label">Dirección Completa</label>
                  <input className="form-input" name="recipient_address" value={form.recipient_address}
                    onChange={handle} placeholder="Calle, número, colonia, ciudad" required />
                </div>

                {/* CP + validación SOAP */}
                <div className="form-group">
                  <label className="form-label">Código Postal <span style={{color:'var(--amber)',fontSize:'.65rem'}}>· SOAP ValidatePostalCode</span></label>
                  <div style={{display:'flex', gap:'.5rem'}}>
                    <input className="form-input" name="recipient_postal_code"
                      value={form.recipient_postal_code} onChange={handle}
                      placeholder="ej. 06600" maxLength={5} style={{fontFamily:'var(--font-mono)'}}
                      required />
                    <button type="button" className="btn btn-outline btn-sm"
                      onClick={validatePC} disabled={pcLoading || !form.recipient_postal_code}
                      style={{flexShrink:0}}>
                      {pcLoading ? <span className="loader" style={{width:14,height:14}}/> : 'Validar'}
                    </button>
                  </div>
                </div>

                {/* Resultado validación CP */}
                {pcStatus && (
                  <div className={`alert ${pcStatus.isValid ? 'alert-success' : 'alert-error'}`}
                       style={{fontSize:'.8rem', padding:'.6rem .9rem'}}>
                    {pcStatus.isValid
                      ? <>✔ <strong>{pcStatus.city}</strong>, {pcStatus.state} · Zona tarifaria {pcStatus.zone}</>
                      : <>✗ {pcStatus.message}</>
                    }
                  </div>
                )}
              </div>
            </div>

            {/* Paquete */}
            <div className="card">
              <div className="section-title">③ Dimensiones del Paquete</div>
              <div className="form-grid" style={{gap:'.85rem'}}>
                <div className="form-group">
                  <label className="form-label">Peso (kg) *</label>
                  <input className="form-input" type="number" name="weight" min="0.1" step="0.1"
                    value={form.weight} onChange={handle} placeholder="ej. 2.5" required />
                </div>
                <div className="form-grid form-row-3" style={{gap:'.6rem'}}>
                  <div className="form-group">
                    <label className="form-label">Ancho cm</label>
                    <input className="form-input" type="number" name="width" min="1" step="0.5"
                      value={form.width} onChange={handle} placeholder="20" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Alto cm</label>
                    <input className="form-input" type="number" name="height" min="1" step="0.5"
                      value={form.height} onChange={handle} placeholder="15" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Largo cm</label>
                    <input className="form-input" type="number" name="depth" min="1" step="0.5"
                      value={form.depth} onChange={handle} placeholder="10" />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Tipo de Servicio</label>
                  <select className="form-select" name="serviceType" value={form.serviceType} onChange={handle}>
                    <option value="STANDARD">Estándar (5-15 días)</option>
                    <option value="EXPRESS">Express (2-7 días)</option>
                    <option value="OVERNIGHT">Día Siguiente (1-3 días)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* ── Col derecha: resultado SOAP + confirmación ─────────────── */}
          <div style={{display:'flex', flexDirection:'column', gap:'1.2rem'}}>

            {/* Calcular costo */}
            <div className="card">
              <div className="section-title">④ Cálculo de Costo · SOAP</div>
              <p style={{fontSize:'.82rem', color:'var(--text-muted)', marginBottom:'1rem', lineHeight:1.5}}>
                El cálculo se realiza llamando a la <strong style={{color:'var(--text)'}}>API SOAP</strong> del
                Servicio Nacional de Correos (puerto 3002), que recibe peso y dimensiones
                en XML y devuelve el costo exacto con código de barras.
              </p>

              <button type="button" className="btn btn-outline" onClick={calcCost}
                disabled={calcLoading || !form.weight}
                style={{width:'100%', justifyContent:'center', marginBottom:'.5rem'}}>
                {calcLoading
                  ? <><span className="loader" style={{width:16,height:16}}/> Consultando SOAP…</>
                  : '🔢 Calcular Costo de Envío'}
              </button>

              {soapResult && (
                <div className="soap-result">
                  <div className="soap-result-title">📡 Respuesta SOAP — CalculateShippingCost</div>

                  <div className="soap-kv">
                    <span className="soap-key">cost</span>
                    <span className="soap-val big">{fmtMXN(soapResult.cost)}</span>
                  </div>
                  <div className="soap-kv">
                    <span className="soap-key">taxAmount (IVA)</span>
                    <span className="soap-val">{fmtMXN(soapResult.tax)}</span>
                  </div>
                  <div className="soap-kv">
                    <span className="soap-key">totalWithTax</span>
                    <span className="soap-val" style={{color:'var(--amber-lt)', fontWeight:600}}>{fmtMXN(soapResult.total)}</span>
                  </div>
                  <div className="soap-kv" style={{marginTop:'.6rem'}}>
                    <span className="soap-key">barcode</span>
                    <span className="soap-val barcode">{soapResult.barcode}</span>
                  </div>
                  <div className="soap-kv">
                    <span className="soap-key">currency</span>
                    <span className="soap-val">MXN</span>
                  </div>

                  {/* visualización del XML que se envía */}
                  <details style={{marginTop:'1rem'}}>
                    <summary style={{fontSize:'.7rem', color:'var(--text-dim)', cursor:'pointer', userSelect:'none'}}>
                      Ver XML SOAP enviado
                    </summary>
                    <pre style={{
                      marginTop:'.6rem', padding:'.8rem',
                      background:'#050c18', borderRadius:4,
                      fontSize:'.65rem', color:'#64748b',
                      overflowX:'auto', lineHeight:1.7
                    }}>{`<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <CalculateShippingCostRequest>
      <weight>${form.weight}</weight>
      <width>${form.width || 20}</width>
      <height>${form.height || 15}</height>
      <depth>${form.depth || 10}</depth>
      <serviceType>${form.serviceType}</serviceType>
      <destinationPostalCode>${form.recipient_postal_code}</destinationPostalCode>
    </CalculateShippingCostRequest>
  </soap:Body>
</soap:Envelope>`}</pre>
                  </details>
                </div>
              )}
            </div>

            {/* Guardar */}
            <div className="card">
              <div className="section-title">⑤ Confirmar y Guardar · REST</div>
              <p style={{fontSize:'.82rem', color:'var(--text-muted)', marginBottom:'1rem', lineHeight:1.5}}>
                Al guardar, el paquete se crea via <strong style={{color:'var(--text)'}}>POST /api/packages</strong> en la
                API REST con el costo y código de barras obtenidos del servicio SOAP.
              </p>

              {!soapResult && (
                <div className="alert alert-warn" style={{fontSize:'.8rem', marginBottom:'1rem'}}>
                  ⚠ Calcula primero el costo antes de guardar.
                </div>
              )}

              <button type="submit" className="btn btn-primary"
                disabled={saving || !soapResult}
                style={{width:'100%', justifyContent:'center', fontSize:'1.1rem', padding:'.8rem'}}>
                {saving
                  ? <><span className="loader" style={{width:16,height:16}}/> Guardando…</>
                  : '📦 Guardar Paquete'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
