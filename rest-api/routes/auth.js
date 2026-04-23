// routes/auth.js — Login y perfil de usuario
const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { db }  = require('../db');
const { authMiddleware, SECRET } = require('../middleware/auth');

/**
 * POST /api/auth/login
 * Body: { email, password }
 * Returns: { token, user }
 */
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email y contraseña requeridos' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) return res.status(401).json({ error: 'Credenciales incorrectas' });

  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) return res.status(401).json({ error: 'Credenciales incorrectas' });

  const token = jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    SECRET,
    { expiresIn: '24h' }
  );

  res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, created_at: user.created_at }
  });
});

/**
 * POST /api/auth/register
 * Body: { email, password, name }
 */
router.post('/register', (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name)
    return res.status(400).json({ error: 'Todos los campos son requeridos' });

  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (exists) return res.status(409).json({ error: 'El email ya está registrado' });

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare('INSERT INTO users (email, password, name) VALUES (?, ?, ?)').run(email, hash, name);

  const token = jwt.sign({ id: result.lastInsertRowid, email, name }, SECRET, { expiresIn: '24h' });
  res.status(201).json({ token, user: { id: result.lastInsertRowid, email, name } });
});

/**
 * GET /api/auth/profile
 * Returns current user profile
 */
router.get('/profile', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT id, email, name, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json(user);
});

module.exports = router;
