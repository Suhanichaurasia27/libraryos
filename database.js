// database.js – LibraryOS Multi-Tenant SQLite
const Database = require('better-sqlite3');
const bcrypt   = require('bcrypt');
const path     = require('path');

const DB_PATH = path.join(__dirname, 'library.db');
let db;

function init() {
  return new Promise(async (resolve, reject) => {
    try {
      db = new Database(DB_PATH);
      db.pragma('journal_mode = WAL');
      db.pragma('foreign_keys = ON');
      createTables();
      await seedIfEmpty();
      console.log('✅  SQLite database ready:', DB_PATH);
      resolve();
    } catch (err) {
      reject(err);
    }
  });
}

function createTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS libraries (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT    NOT NULL,
      owner_name    TEXT    NOT NULL,
      email         TEXT    NOT NULL UNIQUE,
      password_hash TEXT    NOT NULL,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS students (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      library_id  INTEGER NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
      name        TEXT    NOT NULL,
      phone       TEXT    NOT NULL,
      email       TEXT,
      seat        TEXT    NOT NULL,
      monthly_fee INTEGER NOT NULL DEFAULT 400,
      joined_date TEXT    NOT NULL DEFAULT (date('now')),
      is_active   INTEGER NOT NULL DEFAULT 1,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS fees (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      library_id  INTEGER NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
      student_id  INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      month       TEXT    NOT NULL,
      amount_due  INTEGER NOT NULL,
      amount_paid INTEGER NOT NULL DEFAULT 0,
      due_date    TEXT    NOT NULL,
      paid_date   TEXT,
      status      TEXT    NOT NULL DEFAULT 'pending',
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE(student_id, month)
    );

    CREATE TABLE IF NOT EXISTS payments (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      library_id  INTEGER NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
      student_id  INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      fee_id      INTEGER NOT NULL REFERENCES fees(id)     ON DELETE CASCADE,
      amount      INTEGER NOT NULL,
      mode        TEXT    NOT NULL DEFAULT 'cash',
      note        TEXT,
      recorded_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS reminder_log (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      library_id  INTEGER REFERENCES libraries(id) ON DELETE SET NULL,
      student_id  INTEGER REFERENCES students(id)  ON DELETE SET NULL,
      channel     TEXT    NOT NULL,
      status      TEXT    NOT NULL,
      message     TEXT,
      error       TEXT,
      sent_at     TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      library_id  INTEGER NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
      key         TEXT    NOT NULL,
      value       TEXT    NOT NULL,
      PRIMARY KEY (library_id, key)
    );
  `);
}

async function seedIfEmpty() {
  const count = db.prepare('SELECT COUNT(*) as c FROM libraries').get();
  if (count.c > 0) return;

  console.log('🌱  Seeding demo library account...');

  const hash = await bcrypt.hash('demo1234', 10);
  const libResult = db.prepare(
    'INSERT INTO libraries (name, owner_name, email, password_hash) VALUES (?, ?, ?, ?)'
  ).run('Demo City Library', 'Demo Owner', 'demo@libraryos.com', hash);

  const libId = libResult.lastInsertRowid;

  // Default settings
  const setSetting = db.prepare('INSERT OR IGNORE INTO settings (library_id, key, value) VALUES (?, ?, ?)');
  [
    ['library_name',     'Demo City Library'],
    ['monthly_fee',      '400'],
    ['late_fee_percent', '10'],
    ['enable_email',     'true'],
    ['msg_template',     'Dear {name}, your library fee of Rs.{due} is pending for {month}. Seat: {seat}. Please pay before the 31st. — {library}'],
    ['reminder_days',    '25,28,31'],
  ].forEach(([k, v]) => setSetting.run(libId, k, v));

  // Sample students
  const insertStudent = db.prepare(
    'INSERT INTO students (library_id, name, phone, email, seat, monthly_fee, joined_date) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  const insertFee = db.prepare(
    'INSERT OR IGNORE INTO fees (library_id, student_id, month, amount_due, amount_paid, due_date, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );

  const sampleStudents = [
    ['Arjun Sharma',  '9876543210', 'arjun@email.com',  'A-01', 400, '2024-01-15'],
    ['Priya Singh',   '8765432109', 'priya@email.com',  'A-02', 400, '2024-02-01'],
    ['Rahul Verma',   '7654321098', 'rahul@email.com',  'B-01', 350, '2024-01-10'],
    ['Sneha Gupta',   '6543210987', 'sneha@email.com',  'B-02', 400, '2024-03-05'],
    ['Amit Yadav',    '9988112233', 'amit@email.com',   'C-01', 500, '2023-11-20'],
    ['Kavya Patel',   '9977221144', 'kavya@email.com',  'C-02', 400, '2024-02-14'],
    ['Rohit Tiwari',  '9966330055', 'rohit@email.com',  'D-01', 350, '2024-01-08'],
    ['Anjali Mishra', '9955440066', 'anjali@email.com', 'D-02', 400, '2024-04-01'],
    ['Vikram Joshi',  '9944550077', 'vikram@email.com', 'E-01', 450, '2024-03-12'],
    ['Meera Dubey',   '9933660088', 'meera@email.com',  'E-02', 400, '2024-02-28'],
  ];

  const thisMonth = new Date().toISOString().slice(0, 7);
  const dueDate   = `${thisMonth}-31`;

  const seedAll = db.transaction(() => {
    sampleStudents.forEach(([name, phone, email, seat, fee, joined], idx) => {
      const res    = insertStudent.run(libId, name, phone, email, seat, fee, joined);
      const sid    = res.lastInsertRowid;
      const paid   = idx % 3 === 1 ? fee : idx % 3 === 2 ? Math.floor(fee / 2) : 0;
      const status = paid >= fee ? 'paid' : paid > 0 ? 'partial' : 'pending';
      insertFee.run(libId, sid, thisMonth, fee, paid, dueDate, status);
    });
  });
  seedAll();

  console.log('✅  Demo account ready — email: demo@libraryos.com / pass: demo1234');
}

const get = (sql, params = []) => db.prepare(sql).get(...params);
const all = (sql, params = []) => db.prepare(sql).all(...params);
const run = (sql, params = []) => db.prepare(sql).run(...params);
const tx  = (fn)               => db.transaction(fn)();

module.exports = { init, get, all, run, tx };
