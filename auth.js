// auth.js – Register & Login routes
const express    = require('express');
const router     = express.Router();
const bcrypt     = require('bcrypt');
const jwt        = require('jsonwebtoken');
const db         = require('./database');
const authMiddleware = require('./authMiddleware');

const JWT_SECRET  = process.env.JWT_SECRET || 'libraryos-secret-change-in-prod';
const JWT_EXPIRES = '30d';

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { library_name, owner_name, email, password } = req.body;
    if (!library_name || !owner_name || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existing = db.get('SELECT id FROM libraries WHERE email = ?', [email.toLowerCase()]);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const hash   = await bcrypt.hash(password, 10);
    const result = db.run(
      'INSERT INTO libraries (name, owner_name, email, password_hash) VALUES (?, ?, ?, ?)',
      [library_name.trim(), owner_name.trim(), email.toLowerCase().trim(), hash]
    );
    const libId = result.lastInsertRowid;

    // Default settings for new library
    const set = (k, v) => db.run('INSERT OR IGNORE INTO settings (library_id, key, value) VALUES (?, ?, ?)', [libId, k, v]);
    set('library_name',     library_name.trim());
    set('monthly_fee',      '400');
    set('late_fee_percent', '10');
    set('enable_email',     'true');
    set('msg_template',     'Dear {name}, your library fee of Rs.{due} is pending for {month}. Seat: {seat}. Please pay before the 31st. — {library}');
    set('reminder_days',    '25,28,31');

    const token = jwt.sign(
      { libraryId: libId, libraryName: library_name.trim(), email: email.toLowerCase() },
      JWT_SECRET, { expiresIn: JWT_EXPIRES }
    );
    res.status(201).json({ token, libraryName: library_name.trim(), ownerName: owner_name.trim() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const library = db.get('SELECT * FROM libraries WHERE email = ?', [email.toLowerCase()]);
    if (!library) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const match = await bcrypt.compare(password, library.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { libraryId: library.id, libraryName: library.name, email: library.email },
      JWT_SECRET, { expiresIn: JWT_EXPIRES }
    );
    res.json({ token, libraryName: library.name, ownerName: library.owner_name });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
  const library = db.get(
    'SELECT id, name, owner_name, email, created_at FROM libraries WHERE id = ?',
    [req.libraryId]
  );
  res.json(library);
});

module.exports = router;
