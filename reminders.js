// reminders.js – Multi-tenant reminder routes
const express         = require('express');
const router          = express.Router();
const db              = require('./database');
const auth            = require('./authMiddleware');
const reminderService = require('./reminderService');

router.use(auth);

// POST /api/reminders/send
router.post('/send', async (req, res) => {
  try {
    const result = await reminderService.sendToAllPending('manual', req.libraryId);
    res.json({ message: 'Reminders sent', ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reminders/log
router.get('/log', (req, res) => {
  const libId = req.libraryId;
  const rows = db.all(`
    SELECT r.*, s.name AS student_name
    FROM reminder_log r
    LEFT JOIN students s ON r.student_id = s.id
    WHERE r.library_id = ?
    ORDER BY r.sent_at DESC LIMIT 50
  `, [libId]);
  res.json(rows);
});

module.exports = router;
