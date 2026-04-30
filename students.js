// students.js – Multi-tenant student routes
const express = require('express');
const router  = express.Router();
const db      = require('./database');
const auth    = require('./authMiddleware');
const { ensureFeesForMonth } = require('./reminderService');

router.use(auth);

// GET /api/students
router.get('/', (req, res) => {
  const libId     = req.libraryId;
  const thisMonth = new Date().toISOString().slice(0, 7);
  ensureFeesForMonth(thisMonth, libId);

  const { status, search } = req.query;
  let sql = `
    SELECT s.*,
           f.amount_due, f.amount_paid,
           (f.amount_due - f.amount_paid) AS due,
           f.status AS fee_status, f.month, f.id AS fee_id
    FROM students s
    LEFT JOIN fees f ON f.student_id = s.id AND f.month = ?
    WHERE s.is_active = 1 AND s.library_id = ?
  `;
  const params = [thisMonth, libId];

  if (status && status !== 'all') { sql += ' AND f.status = ?'; params.push(status); }
  if (search) {
    sql += ' AND (s.name LIKE ? OR s.phone LIKE ? OR s.seat LIKE ?)';
    const q = `%${search}%`;
    params.push(q, q, q);
  }
  sql += ' ORDER BY s.name ASC';
  res.json(db.all(sql, params));
});

// GET /api/students/:id
router.get('/:id', (req, res) => {
  const libId     = req.libraryId;
  const thisMonth = new Date().toISOString().slice(0, 7);
  const student   = db.get(`
    SELECT s.*, f.amount_due, f.amount_paid,
           (f.amount_due - f.amount_paid) AS due,
           f.status AS fee_status, f.month
    FROM students s
    LEFT JOIN fees f ON f.student_id = s.id AND f.month = ?
    WHERE s.id = ? AND s.library_id = ?
  `, [thisMonth, req.params.id, libId]);

  if (!student) return res.status(404).json({ error: 'Student not found' });

  const payments = db.all(
    `SELECT p.*, f.month FROM payments p JOIN fees f ON p.fee_id = f.id
     WHERE p.student_id = ? AND p.library_id = ? ORDER BY p.recorded_at DESC LIMIT 20`,
    [req.params.id, libId]
  );
  res.json({ ...student, payments });
});

// POST /api/students
router.post('/', (req, res) => {
  const libId = req.libraryId;
  const { name, phone, email, seat, monthly_fee } = req.body;
  if (!name || !phone || !seat) {
    return res.status(400).json({ error: 'name, phone and seat are required' });
  }

  const result = db.run(
    'INSERT INTO students (library_id, name, phone, email, seat, monthly_fee) VALUES (?, ?, ?, ?, ?, ?)',
    [libId, name.trim(), phone.trim(), email?.trim() || null, seat.trim(), monthly_fee || 400]
  );

  const thisMonth = new Date().toISOString().slice(0, 7);
  db.run(
    'INSERT OR IGNORE INTO fees (library_id, student_id, month, amount_due, due_date) VALUES (?, ?, ?, ?, ?)',
    [libId, result.lastInsertRowid, thisMonth, monthly_fee || 400, `${thisMonth}-31`]
  );

  res.status(201).json(db.get('SELECT * FROM students WHERE id = ?', [result.lastInsertRowid]));
});

// PUT /api/students/:id
router.put('/:id', (req, res) => {
  const libId    = req.libraryId;
  const { name, phone, email, seat, monthly_fee } = req.body;
  const existing = db.get('SELECT * FROM students WHERE id = ? AND library_id = ?', [req.params.id, libId]);
  if (!existing) return res.status(404).json({ error: 'Student not found' });

  db.run(
    'UPDATE students SET name=?, phone=?, email=?, seat=?, monthly_fee=? WHERE id=? AND library_id=?',
    [
      name?.trim()        || existing.name,
      phone?.trim()       || existing.phone,
      email?.trim()       || existing.email,
      seat?.trim()        || existing.seat,
      monthly_fee         || existing.monthly_fee,
      req.params.id, libId
    ]
  );
  res.json(db.get('SELECT * FROM students WHERE id = ?', [req.params.id]));
});

// DELETE /api/students/:id  (soft delete)
router.delete('/:id', (req, res) => {
  const libId   = req.libraryId;
  const student = db.get('SELECT * FROM students WHERE id = ? AND library_id = ?', [req.params.id, libId]);
  if (!student) return res.status(404).json({ error: 'Student not found' });

  db.run('UPDATE students SET is_active = 0 WHERE id = ? AND library_id = ?', [req.params.id, libId]);
  res.json({ message: `${student.name} removed successfully` });
});

module.exports = router;
