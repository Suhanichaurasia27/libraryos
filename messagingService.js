// services/messagingService.js
// Email-only reminder service (via Nodemailer / Gmail)
require('dotenv').config();

const nodemailer = require('nodemailer');
const db         = require('./database');

// ── Email transporter ─────────────────────────────────────
let emailTransporter = null;
try {
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS &&
      !process.env.EMAIL_PASS.includes('your_')) {
    emailTransporter = nodemailer.createTransport({
      host:   process.env.EMAIL_HOST || 'smtp.gmail.com',
      port:   parseInt(process.env.EMAIL_PORT) || 587,
      secure: false,
      auth:   { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });
    console.log('✅  Email transporter initialised');
  } else {
    console.warn('⚠️   Email credentials not set – emails will be simulated (logged to console)');
  }
} catch (e) {
  console.warn('⚠️   Email init failed:', e.message);
}

// ── Template builder ──────────────────────────────────────
function buildMessage(template, student, dueAmount, month) {
  return template
    .replace(/{name}/g,    student.name)
    .replace(/{due}/g,     dueAmount)
    .replace(/{month}/g,   month)
    .replace(/{library}/g, process.env.LIBRARY_NAME || 'City Library')
    .replace(/{seat}/g,    student.seat || '');
}

// ── Send Email ────────────────────────────────────────────
async function sendEmail(student, message, subject) {
  if (!student.email) return { success: false, error: 'No email on record' };

  const libraryName = process.env.LIBRARY_NAME || 'City Library';

  if (!emailTransporter) {
    console.log(`[SIMULATE Email] To: ${student.email}\n  Subject: ${subject}\n  Body: ${message}`);
    return { success: true, simulated: true };
  }

  const info = await emailTransporter.sendMail({
    from:    process.env.EMAIL_FROM || `"${libraryName}" <${process.env.EMAIL_USER}>`,
    to:      student.email,
    subject: subject || `Library Fee Reminder – ${new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}`,
    text:    message,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:520px;margin:auto;background:#0f172a;color:#e2e8f0;border-radius:12px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#10b981,#059669);padding:28px 32px;">
          <h2 style="margin:0;color:#fff;font-size:20px;">📚 ${libraryName}</h2>
          <p style="margin:4px 0 0;color:#d1fae5;font-size:13px;">Fee Reminder</p>
        </div>
        <div style="padding:28px 32px;">
          <p style="font-size:15px;line-height:1.7;color:#cbd5e1;">${message.replace(/\n/g, '<br/>')}</p>
        </div>
        <div style="padding:16px 32px;background:#1e293b;text-align:center;">
          <p style="margin:0;font-size:12px;color:#64748b;">This is an automated reminder. Please ignore if already paid.</p>
        </div>
      </div>`,
  });
  return { success: true, messageId: info.messageId };
}

// ── Log result to DB ──────────────────────────────────────
function logResult(studentId, channel, status, message, error = null) {
  db.run(
    `INSERT INTO reminder_log (student_id, channel, status, message, error) VALUES (?, ?, ?, ?, ?)`,
    [studentId, channel, status, message, error]
  );
}

// ── Main dispatcher (email only) ──────────────────────────
async function sendReminder(student, dueAmount, month) {
  const template = db.get(`SELECT value FROM settings WHERE key = 'msg_template'`)?.value
    || 'Dear {name}, your library fee of Rs.{due} is pending for {month}. Seat: {seat}. Please pay before the 31st. — {library}';

  const message = buildMessage(template, student, dueAmount, month);
  const subject = `Fee Reminder – ${month} | ${process.env.LIBRARY_NAME || 'City Library'}`;

  try {
    const r = await sendEmail(student, message, subject);
    logResult(student.id, 'email', r.success ? 'sent' : 'failed', message, r.error || null);
    return { student: student.name, dueAmount, results: [{ channel: 'email', ...r }] };
  } catch (err) {
    logResult(student.id, 'email', 'failed', message, err.message);
    return { student: student.name, dueAmount, results: [{ channel: 'email', success: false, error: err.message }] };
  }
}

module.exports = { sendReminder, buildMessage };
