// reminderService.js – Multi-tenant email reminder logic
const db              = require('./database');
const messagingService = require('./messagingService');

/**
 * Ensure every active student in a library has a fee row for the given month.
 */
function ensureFeesForMonth(month, libraryId) {
  const students = db.all(
    'SELECT id, monthly_fee FROM students WHERE is_active = 1 AND library_id = ?',
    [libraryId]
  );
  const dueDate = `${month}-31`;
  students.forEach(s => {
    db.run(
      'INSERT OR IGNORE INTO fees (library_id, student_id, month, amount_due, due_date) VALUES (?, ?, ?, ?, ?)',
      [libraryId, s.id, month, s.monthly_fee, dueDate]
    );
  });
}

/**
 * Send email reminders to all students with pending/partial fees for this month.
 */
async function sendToAllPending(wave = 'manual', libraryId) {
  const month = new Date().toISOString().slice(0, 7);
  ensureFeesForMonth(month, libraryId);

  // Get library settings
  const settingRows = db.all(
    'SELECT key, value FROM settings WHERE library_id = ?',
    [libraryId]
  );
  const settings = {};
  settingRows.forEach(r => { settings[r.key] = r.value; });

  const template    = settings.msg_template || 'Dear {name}, your fee of Rs.{due} for {month} is pending. Seat: {seat}.';
  const libraryName = settings.library_name || 'Your Library';

  const pending = db.all(`
    SELECT s.name, s.email, s.phone, s.seat,
           f.id AS fee_id, f.amount_due, f.amount_paid,
           (f.amount_due - f.amount_paid) AS due
    FROM students s
    JOIN fees f ON f.student_id = s.id AND f.month = ?
    WHERE s.is_active = 1 AND s.library_id = ? AND f.status != 'paid' AND s.email IS NOT NULL
  `, [month, libraryId]);

  let sent = 0, failed = 0;

  for (const student of pending) {
    const message = template
      .replace('{name}',    student.name)
      .replace('{due}',     student.due)
      .replace('{month}',   month)
      .replace('{seat}',    student.seat)
      .replace('{library}', libraryName);

    try {
      await messagingService.sendEmail({
        to:      student.email,
        subject: `📚 Fee Reminder – ${libraryName} (${month})`,
        text:    message,
        gmailUser: settings.gmail_user,
        gmailPass: settings.gmail_pass,
      });

      db.run(
        'INSERT INTO reminder_log (library_id, student_id, channel, status, message) VALUES (?, ?, ?, ?, ?)',
        [libraryId, student.fee_id, 'email', 'sent', message]
      );
      sent++;
    } catch (err) {
      db.run(
        'INSERT INTO reminder_log (library_id, student_id, channel, status, error) VALUES (?, ?, ?, ?, ?)',
        [libraryId, student.fee_id, 'email', 'failed', err.message]
      );
      failed++;
    }
  }

  console.log(`[Reminders] wave=${wave} lib=${libraryId} sent=${sent} failed=${failed}`);
  return { sent, failed, total: pending.length };
}

module.exports = { sendToAllPending, ensureFeesForMonth };
