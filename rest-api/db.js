// db.js — Inicialización y configuración de la base de datos SQLite
const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const db = new Database(path.join(__dirname, 'shipping.db'));

function initDb() {
  db.exec(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS users (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      email       TEXT    UNIQUE NOT NULL,
      password    TEXT    NOT NULL,
      name        TEXT    NOT NULL,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS packages (
      id                    INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id               INTEGER NOT NULL,
      tracking_code         TEXT    UNIQUE NOT NULL,
      sender_name           TEXT    NOT NULL,
      recipient_name        TEXT    NOT NULL,
      recipient_address     TEXT    NOT NULL,
      recipient_postal_code TEXT    NOT NULL,
      weight                REAL    NOT NULL,
      width                 REAL    NOT NULL,
      height                REAL    NOT NULL,
      depth                 REAL    NOT NULL,
      cost                  REAL,
      barcode               TEXT,
      status                TEXT    DEFAULT 'pending',
      created_at            DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS shipments (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      package_id       INTEGER NOT NULL,
      user_id          INTEGER NOT NULL,
      tracking_code    TEXT    NOT NULL,
      recipient_name   TEXT    NOT NULL,
      recipient_address TEXT   NOT NULL,
      postal_code      TEXT    NOT NULL,
      weight           REAL    NOT NULL,
      cost             REAL    NOT NULL,
      barcode          TEXT,
      shipped_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (package_id) REFERENCES packages(id)
    );
  `);

  // Seed: usuario de demostración
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get('demo@correos.mx');
  if (!exists) {
    const hash = bcrypt.hashSync('demo123', 10);
    db.prepare('INSERT INTO users (email, password, name) VALUES (?, ?, ?)').run(
      'demo@correos.mx', hash, 'Usuario Demo'
    );
    console.log('✔ Usuario demo creado: demo@correos.mx / demo123');
  }

  // Seed: envíos de muestra en el dashboard
  const shipmentsCount = db.prepare('SELECT COUNT(*) as c FROM shipments').get();
  if (shipmentsCount.c === 0) {
    const userId = db.prepare('SELECT id FROM users WHERE email = ?').get('demo@correos.mx').id;
    const samplePkgs = [
      { tc: 'MX-2024-001', rn: 'Ana García',    ra: 'Av. Insurgentes 123, CDMX',      pc: '06600', w: 1.5, cost: 145.00 },
      { tc: 'MX-2024-002', rn: 'Carlos López',  ra: 'Blvd. Kukulcán 45, Cancún',      pc: '77500', w: 3.2, cost: 280.50 },
      { tc: 'MX-2024-003', rn: 'María Ruiz',    ra: 'Calle Morelos 7, Guadalajara',   pc: '44100', w: 0.8, cost: 98.75 },
      { tc: 'MX-2024-004', rn: 'Pedro Martínez','ra': 'Paseo Montejo 201, Mérida',    pc: '97100', w: 5.0, cost: 390.00 },
      { tc: 'MX-2024-005', rn: 'Lucía Torres',  ra: 'Av. Tecnológico 55, Monterrey',  pc: '64000', w: 2.1, cost: 195.20 },
    ];
    const ins = db.prepare(`
      INSERT INTO shipments (package_id, user_id, tracking_code, recipient_name, recipient_address, postal_code, weight, cost, barcode)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    samplePkgs.forEach((p, i) => {
      // insert dummy package first
      db.prepare(`
        INSERT INTO packages (user_id, tracking_code, sender_name, recipient_name, recipient_address, recipient_postal_code, weight, width, height, depth, cost, barcode, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(userId, p.tc, 'Usuario Demo', p.rn, p.ra, p.pc, p.w, 20, 15, 10, p.cost, `BC-${p.tc}`, 'shipped');
      const pkgId = db.prepare('SELECT id FROM packages WHERE tracking_code = ?').get(p.tc).id;
      ins.run(pkgId, userId, p.tc, p.rn, p.ra, p.pc, p.w, p.cost, `BC-${p.tc}`);
    });
    console.log('✔ Envíos de muestra insertados');
  }
}

module.exports = { db, initDb };
