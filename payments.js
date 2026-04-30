// payments.js – Multi-tenant payment routes
const express = require('express');
const router  = express.Router();
const db      = require('./database');
const auth    = require('./authMiddleware');

router.use(auth);

// GET /api/payments
router.get('/', (req, res) => {
  const libId = req.libraryId;
  const { student_id, month } = req.query;

  let sql = `
    SELECT p.*, s.name AS student_name, s.seat, f.month
    FROM payments p
    JOIN students s ON p.student_id = s.id
    JOIN fees f ON p.fee_id = f.id
    WHERE p.library_id = ?
  `;
  const params = [libId];

  if (student_id) { sql += ' AND p.student_id = ?'; params.push(student_id); }
  if (month)      { sql += ' AND f.month = ?';      params.push(month); }

  sql += ' ORDER BY p.recorded_at DESC LIMIT 100';
  res.json(db.all(sql, params));
});

// POST /api/payments
router.post('/', (req, res) => {
  const libId = req.libraryId;
  const { student_id, fee_id, amount, mode, note } = req.body;

  if (!student_id || !fee_id || !amount) {
    return res.status(400).json({ error: 'student_id, fee_id and amount are required' });
  }

  const fee = db.get('SELECT * FROM fees WHERE id = ? AND library_id = ?', [fee_id, libId]);
  if (!fee) return res.status(404).json({ error: 'Fee record not found' });

  db.run(
    'INSERT INTO payments (library_id, student_id, fee_id, amount, mode, note) VALUES (?, ?, ?, ?, ?, ?)',
    [libId, student_id, fee_id, amount, mode || 'cash', note || null]
  );

  const newPaid   = (fee.amount_paid || 0) + Number(amount);
  const newStatus = newPaid >= fee.amount_due ? 'paid' : newPaid > 0 ? 'partial' : 'pending';
  const paidDate  = newStatus === 'paid' ? new Date().toISOString().slice(0, 10) : null;

  db.run(
    'UPDATE fees SET amount_paid = ?, status = ?, paid_date = ? WHERE id = ?',
    [newPaid, newStatus, paidDate, fee_id]
  );

  res.status(201).json({ message: 'Payment recorded successfully' });
});

module.exports = router;
