// routes/packages.js — CRUD de paquetes pendientes
const router = require('express').Router();
const { db } = require('../db');
const { authMiddleware } = require('../middleware/auth');

// Generar código de seguimiento único
function generateTracking() {
  const now = new Date();
  const year = now.getFullYear();
  const rand = Math.floor(Math.random() * 900000) + 100000;
  return `MX-${year}-${rand}`;
}

// Todas las rutas requieren autenticación
router.use(authMiddleware);

/**
 * GET /api/packages
 * Lista todos los paquetes del usuario (solo pendientes/en proceso)
 */
router.get('/', (req, res) => {
  const packages = db.prepare(`
    SELECT * FROM packages
    WHERE user_id = ? AND status != 'shipped'
    ORDER BY created_at DESC
  `).all(req.user.id);
  res.json(packages);
});

/**
 * GET /api/packages/:id
 * Detalle de un paquete específico
 */
router.get('/:id', (req, res) => {
  const pkg = db.prepare('SELECT * FROM packages WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!pkg) return res.status(404).json({ error: 'Paquete no encontrado' });
  res.json(pkg);
});

/**
 * POST /api/packages
 * Crear nuevo paquete pendiente
 * Body: { sender_name, recipient_name, recipient_address, recipient_postal_code, weight, width, height, depth, cost?, barcode? }
 */
router.post('/', (req, res) => {
  const {
    sender_name, recipient_name, recipient_address,
    recipient_postal_code, weight, width, height, depth,
    cost, barcode
  } = req.body;

  if (!sender_name || !recipient_name || !recipient_address || !recipient_postal_code || !weight)
    return res.status(400).json({ error: 'Campos obligatorios incompletos' });

  const tracking_code = generateTracking();

  const result = db.prepare(`
    INSERT INTO packages
      (user_id, tracking_code, sender_name, recipient_name, recipient_address,
       recipient_postal_code, weight, width, height, depth, cost, barcode, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
  `).run(
    req.user.id, tracking_code, sender_name, recipient_name,
    recipient_address, recipient_postal_code,
    weight, width || 0, height || 0, depth || 0,
    cost || null, barcode || null
  );

  const created = db.prepare('SELECT * FROM packages WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(created);
});

/**
 * PUT /api/packages/:id
 * Editar un paquete pendiente
 */
router.put('/:id', (req, res) => {
  const pkg = db.prepare('SELECT * FROM packages WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!pkg) return res.status(404).json({ error: 'Paquete no encontrado' });
  if (pkg.status === 'shipped')
    return res.status(400).json({ error: 'No se puede editar un paquete ya enviado' });

  const {
    sender_name, recipient_name, recipient_address,
    recipient_postal_code, weight, width, height, depth, cost, barcode
  } = req.body;

  db.prepare(`
    UPDATE packages SET
      sender_name = ?, recipient_name = ?, recipient_address = ?,
      recipient_postal_code = ?, weight = ?, width = ?, height = ?,
      depth = ?, cost = ?, barcode = ?
    WHERE id = ? AND user_id = ?
  `).run(
    sender_name     ?? pkg.sender_name,
    recipient_name  ?? pkg.recipient_name,
    recipient_address ?? pkg.recipient_address,
    recipient_postal_code ?? pkg.recipient_postal_code,
    weight  ?? pkg.weight,
    width   ?? pkg.width,
    height  ?? pkg.height,
    depth   ?? pkg.depth,
    cost    ?? pkg.cost,
    barcode ?? pkg.barcode,
    req.params.id, req.user.id
  );

  const updated = db.prepare('SELECT * FROM packages WHERE id = ?').get(req.params.id);
  res.json(updated);
});

/**
 * DELETE /api/packages/:id
 * Eliminar un paquete pendiente
 */
router.delete('/:id', (req, res) => {
  const pkg = db.prepare('SELECT * FROM packages WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!pkg) return res.status(404).json({ error: 'Paquete no encontrado' });
  if (pkg.status === 'shipped')
    return res.status(400).json({ error: 'No se puede eliminar un paquete ya enviado' });

  db.prepare('DELETE FROM packages WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ message: 'Paquete eliminado', id: parseInt(req.params.id) });
});

/**
 * POST /api/packages/:id/confirm
 * Confirmar envío: mueve el paquete a la tabla shipments y marca como 'shipped'
 */
router.post('/:id/confirm', (req, res) => {
  const pkg = db.prepare('SELECT * FROM packages WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!pkg) return res.status(404).json({ error: 'Paquete no encontrado' });
  if (pkg.status === 'shipped')
    return res.status(400).json({ error: 'Ya fue enviado' });
  if (!pkg.cost)
    return res.status(400).json({ error: 'Calcule el costo antes de confirmar el envío' });

  const ins = db.prepare(`
    INSERT INTO shipments (package_id, user_id, tracking_code, recipient_name, recipient_address, postal_code, weight, cost, barcode)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(pkg.id, req.user.id, pkg.tracking_code, pkg.recipient_name, pkg.recipient_address, pkg.recipient_postal_code, pkg.weight, pkg.cost, pkg.barcode);

  db.prepare("UPDATE packages SET status = 'shipped' WHERE id = ?").run(pkg.id);

  res.json({
    message: 'Envío confirmado exitosamente',
    shipment_id: ins.lastInsertRowid,
    tracking_code: pkg.tracking_code
  });
});

module.exports = router;
