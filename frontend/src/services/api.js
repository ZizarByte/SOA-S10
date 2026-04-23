// services/api.js — Capa de servicios (REST + SOAP)
import axios from 'axios';

const REST_BASE = 'http://localhost:3001/api';
const SOAP_BASE = 'http://localhost:3002/soap';

// ── Axios instance con JWT ────────────────────────────────────────────────
const http = axios.create({ baseURL: REST_BASE });

http.interceptors.request.use(cfg => {
  const token = localStorage.getItem('token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// ══════════════════════════════════════════════════════════════════════════
// REST API
// ══════════════════════════════════════════════════════════════════════════

export const authAPI = {
  login:    (email, password) => http.post('/auth/login', { email, password }),
  register: (email, password, name) => http.post('/auth/register', { email, password, name }),
  profile:  () => http.get('/auth/profile'),
};

export const packagesAPI = {
  list:    ()       => http.get('/packages'),
  get:     (id)     => http.get(`/packages/${id}`),
  create:  (data)   => http.post('/packages', data),
  update:  (id, d)  => http.put(`/packages/${id}`, d),
  delete:  (id)     => http.delete(`/packages/${id}`),
  confirm: (id)     => http.post(`/packages/${id}/confirm`),
};

export const dashboardAPI = {
  shipments: (params) => http.get('/dashboard/shipments', { params }),
  stats:     ()       => http.get('/dashboard/stats'),
};

// ══════════════════════════════════════════════════════════════════════════
// SOAP API (vía cliente JSON simplificado para evitar CORS en XML puro)
// Para ver XML puro, el servidor también expone /soap con texto XML completo
// ══════════════════════════════════════════════════════════════════════════

export const soapAPI = {
  /**
   * Calcula costo de envío
   * Llama al endpoint REST-compatible del servidor SOAP
   */
  calculateCost: async ({ weight, width, height, depth, serviceType, destinationPostalCode }) => {
    const res = await axios.post(`${SOAP_BASE}/calculate`, {
      weight, width, height, depth, serviceType, destinationPostalCode
    });
    return res.data;
  },

  /**
   * Valida código postal
   */
  validatePostalCode: async (postalCode) => {
    const res = await axios.post(`${SOAP_BASE}/validate-postal`, { postalCode });
    return res.data;
  },

  /**
   * Envía petición XML SOAP nativa (para mostrar el XML real al usuario)
   */
  calculateCostXML: async (params) => {
    const { weight, width, height, depth, serviceType = 'STANDARD', destinationPostalCode = '' } = params;
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://correosnacional.mx/soap">
  <soap:Header/>
  <soap:Body>
    <CalculateShippingCostRequest>
      <weight>${weight}</weight>
      <width>${width}</width>
      <height>${height}</height>
      <depth>${depth}</depth>
      <serviceType>${serviceType}</serviceType>
      <destinationPostalCode>${destinationPostalCode}</destinationPostalCode>
    </CalculateShippingCostRequest>
  </soap:Body>
</soap:Envelope>`;

    const res = await axios.post(`${SOAP_BASE}`, xml, {
      headers: {
        'Content-Type': 'text/xml',
        'SOAPAction': 'http://correosnacional.mx/soap/CalculateShippingCost'
      }
    });
    return res.data; // XML string
  },
};
