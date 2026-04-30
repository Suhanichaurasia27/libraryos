// server.js – LibraryOS Multi-Tenant Backend
require('dotenv').config();

const path    = require('path');
const express = require('express');
const cors    = require('cors');
const cron    = require('node-cron');

const authRouter      = require('./auth');
const studentsRouter  = require('./students');
const remindersRouter = require('./reminders');
const paymentsRouter  = require('./payments');
const settingsRouter  = require('./settings');
const reportsRouter   = require('./reports');

const db              = require('./database');
const reminderService = require('./reminderService');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Static files ──────────────────────────────────────────
// Landing page is the default root
app.use(express.static(path.join(__dirname, 'public')));

app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ── Public routes (no auth needed) ───────────────────────
app.use('/api/auth', authRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), version: '2.0.0' });
});

// ── Protected API routes ──────────────────────────────────
app.use('/api/students',  studentsRouter);
app.use('/api/reminders', remindersRouter);
app.use('/api/payments',  paymentsRouter);
app.use('/api/settings',  settingsRouter);
app.use('/api/reports',   reportsRouter);

// ── Routes ────────────────────────────────────────────────────────────
// Root → landing page
app.get('/',    (_req, res) => res.sendFile(path.join(__dirname, 'public', 'landing.html')));
// /app → dashboard
app.get('/app', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// SPA fallback
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'public', 'landing.html'));
  } else {
    res.status(404).json({ error: 'Route not found' });
  }
});

// ── Error handler ─────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error', detail: err.message });
});

// ── Cron Jobs (run for every active library) ──────────────
cron.schedule('0 9 25 * *', async () => {
  console.log('[CRON] 25th — sending first reminder wave to all libraries...');
  const libraries = db.all('SELECT id FROM libraries');
  for (const lib of libraries) {
    await reminderService.sendToAllPending('first', lib.id);
  }
});

cron.schedule('0 9 28 * *', async () => {
  console.log('[CRON] 28th — sending second reminder wave to all libraries...');
  const libraries = db.all('SELECT id FROM libraries');
  for (const lib of libraries) {
    await reminderService.sendToAllPending('second', lib.id);
  }
});

// ── Boot ──────────────────────────────────────────────────
db.init().then(() => {
  app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════╗
║      📚  LibraryOS Backend v2.0  (SaaS)      ║
╠══════════════════════════════════════════════╣
║  Server   → http://localhost:${PORT}             ║
║  Landing  → http://localhost:${PORT}             ║
║  App      → http://localhost:${PORT}/app         ║
║  Health   → /api/health                      ║
╠══════════════════════════════════════════════╣
║  Demo  →  demo@libraryos.com / demo1234      ║
╚══════════════════════════════════════════════╝
    `);
  });
}).catch(err => {
  console.error('❌  Database init failed:', err);
  process.exit(1);
});
