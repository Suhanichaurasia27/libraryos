// reports.js – Multi-tenant report routes
const express = require('express');
const router  = express.Router();
const db      = require('./database');
const auth    = require('./authMiddleware');
const { stringify } = require('csv-stringify/sync');

router.use(auth);

// GET /api/reports/summary?month=YYYY-MM
router.get('/summary', (req, res) => {
  const libId = req.libraryId;
  const month = req.query.month || new Date().toISOString().slice(0, 7);

  const summary = db.get(`
    SELECT
      COUNT(DISTINCT s.id)                              AS total_students,
      COALESCE(SUM(f.amount_due),  0)                   AS total_due,
      COALESCE(SUM(f.amount_paid), 0)                   AS total_collected,
      COALESCE(SUM(f.amount_due - f.amount_paid), 0)    AS total_outstanding,
      COUNT(CASE WHEN f.status = 'paid'    THEN 1 END)  AS paid_count,
      COUNT(CASE WHEN f.status = 'partial' THEN 1 END)  AS partial_count,
      COUNT(CASE WHEN f.status = 'pending' THEN 1 END)  AS pending_count
    FROM students s
    LEFT JOIN fees f ON f.student_id = s.id AND f.month = ?
    WHERE s.is_active = 1 AND s.library_id = ?
  `, [month, libId]);

  res.json({ month, ...summary });
});

// GET /api/reports/defaulters?month=YYYY-MM
router.get('/defaulters', (req, res) => {
  const libId = req.libraryId;
  const month = req.query.month || new Date().toISOString().slice(0, 7);

  const rows = db.all(`
    SELECT s.name, s.phone, s.email, s.seat,
           f.amount_due, f.amount_paid,
           (f.amount_due - f.amount_paid) AS due,
           f.status
    FROM students s
    JOIN fees f ON f.student_id = s.id AND f.month = ?
    WHERE s.is_active = 1 AND s.library_id = ? AND f.status != 'paid'
    ORDER BY due DESC
  `, [month, libId]);

  res.json(rows);
});

// GET /api/reports/csv?month=YYYY-MM
router.get('/csv', (req, res) => {
  const libId = req.libraryId;
  const month = req.query.month || new Date().toISOString().slice(0, 7);

  const rows = db.all(`
    SELECT s.name, s.phone, s.email, s.seat,
           f.amount_due, f.amount_paid,
           (f.amount_due - f.amount_paid) AS due,
           f.status, f.paid_date
    FROM students s
    LEFT JOIN fees f ON f.student_id = s.id AND f.month = ?
    WHERE s.is_active = 1 AND s.library_id = ?
    ORDER BY s.name ASC
  `, [month, libId]);

  const csv = stringify(rows, {
    header: true,
    columns: {
      name: 'Name', phone: 'Phone', email: 'Email', seat: 'Seat',
      amount_due: 'Fee Due', amount_paid: 'Paid', due: 'Outstanding',
      status: 'Status', paid_date: 'Paid Date'
    }
  });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="fees-${month}.csv"`);
  res.send(csv);
});

module.exports = router;
