// server.js — SOAP API: Servicio Nacional de Correos MX (puerto 3002)
// Implementación manual de SOAP con Express + xml2js
// Soporta: CalculateShippingCost | ValidatePostalCode

const express  = require('express');
const cors     = require('cors');
const xml2js   = require('xml2js');
const fs       = require('fs');
const path     = require('path');

const app  = express();
const PORT = process.env.PORT || 3002;

app.use(cors({ origin: '*' }));
app.use(express.text({ type: ['text/xml', 'application/xml', 'application/soap+xml'], limit: '1mb' }));
app.use(express.json()); // para pruebas REST-like del SOAP

// ── WSDL ──────────────────────────────────────────────────────────────────
const WSDL_PATH = path.join(__dirname, 'shipping.wsdl');

// GET /soap        → muestra el WSDL (acceso directo)
// GET /soap?wsdl   → igual, compatibilidad con clientes SOAP estándar
// GET /soap?WSDL   → variante mayúscula que usan algunos clientes (SoapUI, etc.)
app.get('/soap', (req, res) => {
  const wantsWsdl = 'wsdl' in req.query || 'WSDL' in req.query;
  // Si piden ?wsdl explícitamente O es un GET sin body → devolver WSDL
  // (Los clientes SOAP siempre hacen POST para operaciones)
  res.setHeader('Content-Type', 'text/xml; charset=utf-8');
  res.send(fs.readFileSync(WSDL_PATH, 'utf8'));
});

// Ruta explícita /wsdl por si el profesor la prueba en el navegador
app.get('/wsdl', (_req, res) => {
  res.setHeader('Content-Type', 'text/xml; charset=utf-8');
  res.send(fs.readFileSync(WSDL_PATH, 'utf8'));
});

// ══════════════════════════════════════════════════════════════════════════
// LÓGICA DE NEGOCIO
// ══════════════════════════════════════════════════════════════════════════

// Tabla de códigos postales de México (muestra representativa)
const POSTAL_CODES = {
  '06600': { city: 'Ciudad de México',     state: 'Ciudad de México', zone: 1 },
  '06000': { city: 'Centro Histórico',     state: 'Ciudad de México', zone: 1 },
  '11000': { city: 'Miguel Hidalgo',       state: 'Ciudad de México', zone: 1 },
  '44100': { city: 'Guadalajara',          state: 'Jalisco',          zone: 2 },
  '64000': { city: 'Monterrey',            state: 'Nuevo León',       zone: 2 },
  '72000': { city: 'Puebla',               state: 'Puebla',           zone: 2 },
  '77500': { city: 'Cancún',               state: 'Quintana Roo',     zone: 4 },
  '97100': { city: 'Mérida',               state: 'Yucatán',          zone: 3 },
  '21000': { city: 'Mexicali',             state: 'Baja California',  zone: 4 },
  '80000': { city: 'Culiacán',             state: 'Sinaloa',          zone: 3 },
  '20000': { city: 'Aguascalientes',       state: 'Aguascalientes',   zone: 2 },
  '76000': { city: 'Querétaro',            state: 'Querétaro',        zone: 2 },
  '58000': { city: 'Morelia',              state: 'Michoacán',        zone: 2 },
  '36000': { city: 'Guanajuato',           state: 'Guanajuato',       zone: 2 },
  '50000': { city: 'Toluca',               state: 'Estado de México', zone: 1 },
  '91000': { city: 'Xalapa',               state: 'Veracruz',         zone: 3 },
  '29000': { city: 'Tuxtla Gutiérrez',     state: 'Chiapas',          zone: 4 },
  '34000': { city: 'Durango',              state: 'Durango',          zone: 3 },
  '31000': { city: 'Chihuahua',            state: 'Chihuahua',        zone: 4 },
  '83000': { city: 'Hermosillo',           state: 'Sonora',           zone: 4 },
};

// Tarifas base por kg y zona
const RATE_TABLE = {
  STANDARD: { base: 45, perKg: 18, zoneFactor: [0, 1.0, 1.2, 1.5, 1.8, 2.2], days: [0,5,7,9,12,15] },
  EXPRESS:  { base: 90, perKg: 32, zoneFactor: [0, 1.0, 1.1, 1.3, 1.5, 1.8], days: [0,2,3,4,5,7]  },
  OVERNIGHT:{ base:180, perKg: 55, zoneFactor: [0, 1.0, 1.0, 1.2, 1.4, 1.6], days: [0,1,1,2,2,3]  },
};

const IVA = 0.16;

function calculateCost(weight, width, height, depth, serviceType = 'STANDARD', zone = 2) {
  const type   = RATE_TABLE[serviceType] || RATE_TABLE.STANDARD;
  const volume = (width * height * depth) / 5000; // peso volumétrico
  const billableWeight = Math.max(parseFloat(weight), volume);
  const factor = type.zoneFactor[zone] || 1.0;
  const cost   = (type.base + (billableWeight * type.perKg)) * factor;
  return parseFloat(cost.toFixed(2));
}

function generateBarcode(weight, serviceType) {
  const prefix = { STANDARD: 'STD', EXPRESS: 'EXP', OVERNIGHT: 'OVN' }[serviceType] || 'STD';
  const ts     = Date.now().toString().slice(-8);
  const wCode  = Math.round(parseFloat(weight) * 100).toString().padStart(4, '0');
  return `MX-${prefix}-${ts}-${wCode}`;
}

// ══════════════════════════════════════════════════════════════════════════
// ENVELOPE SOAP
// ══════════════════════════════════════════════════════════════════════════
function soapEnvelope(bodyContent) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope
  xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:tns="http://correosnacional.mx/soap">
  <soap:Header/>
  <soap:Body>
    ${bodyContent}
  </soap:Body>
</soap:Envelope>`;
}

function soapFault(code, message) {
  return soapEnvelope(`
    <soap:Fault>
      <faultcode>${code}</faultcode>
      <faultstring>${message}</faultstring>
    </soap:Fault>`);
}

// ══════════════════════════════════════════════════════════════════════════
// HANDLERS
// ══════════════════════════════════════════════════════════════════════════

async function handleCalculateShippingCost(parsed) {
  try {
    const req    = parsed?.['soap:Envelope']?.['soap:Body']?.[0]?.['CalculateShippingCostRequest']?.[0]
                || parsed?.['Envelope']?.['Body']?.[0]?.['CalculateShippingCostRequest']?.[0]
                || parsed?.['s:Envelope']?.['s:Body']?.[0]?.['CalculateShippingCostRequest']?.[0];

    if (!req) throw new Error('Request body inválido');

    const weight      = parseFloat(req.weight?.[0] || 1);
    const width       = parseFloat(req.width?.[0]  || 0);
    const height      = parseFloat(req.height?.[0] || 0);
    const depth       = parseFloat(req.depth?.[0]  || 0);
    const serviceType = (req.serviceType?.[0] || 'STANDARD').toUpperCase();
    const destPC      = req.destinationPostalCode?.[0] || '';
    const pcInfo      = POSTAL_CODES[destPC];
    const zone        = pcInfo ? pcInfo.zone : 2;

    const cost        = calculateCost(weight, width, height, depth, serviceType, zone);
    const tax         = parseFloat((cost * IVA).toFixed(2));
    const total       = parseFloat((cost + tax).toFixed(2));
    const barcode     = generateBarcode(weight, serviceType);
    const days        = RATE_TABLE[serviceType]?.days[zone] || 5;

    return soapEnvelope(`
    <tns:CalculateShippingCostResponse>
      <tns:cost>${cost}</tns:cost>
      <tns:currency>MXN</tns:currency>
      <tns:barcode>${barcode}</tns:barcode>
      <tns:estimatedDays>${days}</tns:estimatedDays>
      <tns:serviceType>${serviceType}</tns:serviceType>
      <tns:taxAmount>${tax}</tns:taxAmount>
      <tns:totalWithTax>${total}</tns:totalWithTax>
    </tns:CalculateShippingCostResponse>`);
  } catch (e) {
    return soapFault('soap:Client', `Error al calcular costo: ${e.message}`);
  }
}

async function handleValidatePostalCode(parsed) {
  try {
    const req  = parsed?.['soap:Envelope']?.['soap:Body']?.[0]?.['ValidatePostalCodeRequest']?.[0]
              || parsed?.['Envelope']?.['Body']?.[0]?.['ValidatePostalCodeRequest']?.[0]
              || parsed?.['s:Envelope']?.['s:Body']?.[0]?.['ValidatePostalCodeRequest']?.[0];

    if (!req) throw new Error('Request body inválido');

    const postalCode = req.postalCode?.[0]?.toString().trim() || '';
    const country    = req.country?.[0] || 'MX';

    const info    = POSTAL_CODES[postalCode];
    const isValid = !!info && /^\d{5}$/.test(postalCode);
    const message = isValid
      ? `Código postal ${postalCode} válido — ${info.city}, ${info.state}`
      : `Código postal ${postalCode} no reconocido en el padrón oficial`;

    return soapEnvelope(`
    <tns:ValidatePostalCodeResponse>
      <tns:isValid>${isValid}</tns:isValid>
      <tns:postalCode>${postalCode}</tns:postalCode>
      <tns:city>${info?.city || ''}</tns:city>
      <tns:state>${info?.state || ''}</tns:state>
      <tns:country>${country}</tns:country>
      <tns:zone>${info?.zone || 0}</tns:zone>
      <tns:message>${message}</tns:message>
    </tns:ValidatePostalCodeResponse>`);
  } catch (e) {
    return soapFault('soap:Client', `Error al validar código postal: ${e.message}`);
  }
}

// ══════════════════════════════════════════════════════════════════════════
// ENDPOINT SOAP principal
// ══════════════════════════════════════════════════════════════════════════
app.post('/soap', async (req, res) => {
  res.setHeader('Content-Type', 'text/xml; charset=utf-8');

  const soapAction = req.headers['soapaction'] || '';
  const body       = req.body;

  if (!body || typeof body !== 'string') {
    return res.status(400).send(soapFault('soap:Client', 'Se requiere un cuerpo XML'));
  }

  let parsed;
  try {
    parsed = await xml2js.parseStringPromise(body, { explicitArray: true });
  } catch {
    return res.status(400).send(soapFault('soap:Client', 'XML malformado'));
  }

  // Determinar operación por SOAPAction header o por contenido del body
  let response;
  const bodyKeys = JSON.stringify(parsed).toLowerCase();

  if (soapAction.includes('CalculateShippingCost') || bodyKeys.includes('calculateshippingcost')) {
    response = await handleCalculateShippingCost(parsed);
  } else if (soapAction.includes('ValidatePostalCode') || bodyKeys.includes('validatepostalcode')) {
    response = await handleValidatePostalCode(parsed);
  } else {
    response = soapFault('soap:Server', 'Operación no reconocida. Use CalculateShippingCost o ValidatePostalCode');
  }

  res.send(response);
});

// ── Endpoint REST amigable para pruebas rápidas ────────────────────────────
app.post('/soap/calculate', express.json(), async (req, res) => {
  const { weight = 1, width = 20, height = 15, depth = 10, serviceType = 'STANDARD', destinationPostalCode = '' } = req.body;
  const pcInfo = POSTAL_CODES[destinationPostalCode];
  const zone   = pcInfo ? pcInfo.zone : 2;
  const cost   = calculateCost(weight, width, height, depth, serviceType, zone);
  const tax    = parseFloat((cost * IVA).toFixed(2));
  res.json({ cost, currency: 'MXN', barcode: generateBarcode(weight, serviceType), tax, total: parseFloat((cost + tax).toFixed(2)) });
});

app.post('/soap/validate-postal', express.json(), async (req, res) => {
  const { postalCode = '' } = req.body;
  const info = POSTAL_CODES[postalCode];
  res.json({ isValid: !!info, postalCode, ...info, message: info ? `Válido: ${info.city}` : 'No encontrado' });
});

// ── Health & WSDL info ────────────────────────────────────────────────────
app.get('/soap/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'SOAP - Servicio Nacional de Correos MX',
    wsdl_urls: [
      `http://localhost:${PORT}/soap`,
      `http://localhost:${PORT}/soap?wsdl`,
      `http://localhost:${PORT}/wsdl`,
    ],
    operations: ['CalculateShippingCost', 'ValidatePostalCode'],
  });
});

app.listen(PORT, () => {
  console.log(`\n📬 SOAP API corriendo en http://localhost:${PORT}`);
  console.log(`   WSDL    : http://localhost:${PORT}/soap?wsdl`);
  console.log(`   Endpoint: http://localhost:${PORT}/soap`);
  console.log(`   REST alt: POST /soap/calculate | POST /soap/validate-postal\n`);
});
