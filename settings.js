// settings.js – Multi-tenant settings routes
const express = require('express');
const router  = express.Router();
const db      = require('./database');
const auth    = require('./authMiddleware');

router.use(auth);

const ALLOWED_KEYS = [
  'library_name', 'monthly_fee', 'late_fee_percent',
  'enable_email', 'msg_template', 'reminder_days',
  'gmail_user', 'gmail_pass'
];

// GET /api/settings
router.get('/', (req, res) => {
  const libId = req.libraryId;
  const rows  = db.all('SELECT key, value FROM settings WHERE library_id = ?', [libId]);
  const out   = {};
  rows.forEach(r => { out[r.key] = r.value; });
  res.json(out);
});

// PUT /api/settings
router.put('/', (req, res) => {
  const libId = req.libraryId;
  Object.entries(req.body)
    .filter(([k]) => ALLOWED_KEYS.includes(k))
    .forEach(([k, v]) => {
      db.run(
        'INSERT OR REPLACE INTO settings (library_id, key, value) VALUES (?, ?, ?)',
        [libId, k, String(v)]
      );
    });

  const rows = db.all('SELECT key, value FROM settings WHERE library_id = ?', [libId]);
  const out  = {};
  rows.forEach(r => { out[r.key] = r.value; });
  res.json(out);
});

module.exports = router;
