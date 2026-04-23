// server.js — REST API principal (puerto 3001)
const express = require('express');
const cors    = require('cors');
const { initDb } = require('./db');

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Middlewares ────────────────────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json());

// ── Inicializar base de datos ──────────────────────────────────────────────
initDb();

// ── Rutas ──────────────────────────────────────────────────────────────────
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/packages',  require('./routes/packages'));
app.use('/api/dashboard', require('./routes/dashboard'));

// ── Health check ───────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'Shipping REST API', version: '1.0.0' });
});

// ── 404 handler ───────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

// ── Error handler ─────────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(PORT, () => {
  console.log(`\n🚀 REST API corriendo en http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/api/health`);
  console.log(`   Docs  : POST /api/auth/login | GET /api/packages | GET /api/dashboard/shipments\n`);
});
