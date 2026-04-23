// routes/dashboard.js — Consulta de envíos realizados
const router = require('express').Router();
const { db } = require('../db');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

/**
 * GET /api/dashboard/shipments
 * Lista todos los envíos completados del usuario
 * Query params: ?page=1&limit=10&search=texto
 */
router.get('/shipments', (req, res) => {
  const page   = Math.max(1, parseInt(req.query.page)  || 1);
  const limit  = Math.min(50, parseInt(req.query.limit) || 10);
  const search = req.query.search ? `%${req.query.search}%` : null;
  const offset = (page - 1) * limit;

  let query = `SELECT * FROM shipments WHERE user_id = ?`;
  let countQuery = `SELECT COUNT(*) as total FROM shipments WHERE user_id = ?`;
  const params = [req.user.id];

  if (search) {
    query      += ` AND (tracking_code LIKE ? OR recipient_name LIKE ? OR recipient_address LIKE ?)`;
    countQuery += ` AND (tracking_code LIKE ? OR recipient_name LIKE ? OR recipient_address LIKE ?)`;
    params.push(search, search, search);
  }

  query += ` ORDER BY shipped_at DESC LIMIT ? OFFSET ?`;

  const total    = db.prepare(countQuery).get(...params).total;
  const shipments = db.prepare(query).all(...params, limit, offset);

  res.json({
    data: shipments,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  });
});

/**
 * GET /api/dashboard/stats
 * Estadísticas resumidas del usuario
 */
router.get('/stats', (req, res) => {
  const uid = req.user.id;

  const totalShipments = db.prepare('SELECT COUNT(*) as c FROM shipments WHERE user_id = ?').get(uid).c;
  const totalSpent     = db.prepare('SELECT COALESCE(SUM(cost), 0) as s FROM shipments WHERE user_id = ?').get(uid).s;
  const pending        = db.prepare("SELECT COUNT(*) as c FROM packages WHERE user_id = ? AND status = 'pending'").get(uid).c;
  const avgCost        = db.prepare('SELECT COALESCE(AVG(cost), 0) as a FROM shipments WHERE user_id = ?').get(uid).a;

  const lastMonth = db.prepare(`
    SELECT COUNT(*) as c FROM shipments
    WHERE user_id = ? AND shipped_at >= date('now', '-30 days')
  `).get(uid).c;

  res.json({
    total_shipments: totalShipments,
    total_spent:     parseFloat(totalSpent.toFixed(2)),
    pending_packages: pending,
    avg_cost:        parseFloat(avgCost.toFixed(2)),
    shipments_last_30_days: lastMonth
  });
});

module.exports = router;
