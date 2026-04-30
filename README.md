# 📚 LibraryOS — Multi-Tenant Library Fee Management SaaS

> A full-stack SaaS application for library owners to manage students, track fees, and send automated email reminders.

[![Node.js](https://img.shields.io/badge/Node.js-22-green)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-4-blue)](https://expressjs.com)
[![SQLite](https://img.shields.io/badge/SQLite-better--sqlite3-orange)](https://github.com/WiseLibs/better-sqlite3)
[![License](https://img.shields.io/badge/License-MIT-purple)](LICENSE)

---

## 🌐 Live Demo

**URL:** [https://libraryos.onrender.com](https://libraryos.onrender.com) *(coming soon)*

| Credential | Value |
|---|---|
| Email | `demo@libraryos.com` |
| Password | `demo1234` |

---

## ✨ Features

- 🔐 **Multi-tenant Auth** — Each library owner registers and gets their own isolated account (JWT + bcrypt)
- 👨‍🎓 **Student Management** — Add, edit, soft-delete students with seat numbers and contact info
- 💰 **Fee Tracking** — Monthly fee records auto-generated per student; track paid / partial / pending
- 📧 **Email Reminders** — Send automated reminders via Gmail; auto-scheduled on 25th & 28th
- 📊 **Reports & CSV Export** — Monthly summary, defaulter list, one-click CSV download
- ⚙️ **Per-Library Settings** — Each library configures their own name, fee amount, and email template
- 🌐 **Landing Page** — Public marketing page with live demo button

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js v22 |
| Framework | Express.js |
| Database | SQLite via `better-sqlite3` |
| Auth | JWT (`jsonwebtoken`) + `bcrypt` |
| Email | Nodemailer (Gmail SMTP) |
| Scheduler | `node-cron` |
| Frontend | Vanilla HTML / CSS / JavaScript |

---

## 🚀 Getting Started (Local)

### Prerequisites
- Node.js v18 or higher
- npm

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/YOUR_USERNAME/libraryos.git
cd libraryos

# 2. Install dependencies
npm install

# 3. Create your environment file
copy .env.example .env    # Windows
# OR
cp .env.example .env      # Mac/Linux

# 4. Edit .env with your values (see Configuration below)

# 5. Start the server
node server.js
```

Open **http://localhost:3000** in your browser.

---

## ⚙️ Configuration

Copy `.env.example` to `.env` and fill in:

```env
PORT=3000

# JWT — change this to a long random string!
JWT_SECRET=your-very-long-random-secret-here

# Gmail App Password (not your real Gmail password)
# Get one at: https://myaccount.google.com/apppasswords
GMAIL_USER=yourlibrary@gmail.com
GMAIL_PASS=your_16_char_app_password
```

> **⚠️ Important:** Never commit your `.env` file — it's already in `.gitignore`.

---

## 📁 Project Structure

```
libraryos/
├── server.js           # Main entry point, routes, cron jobs
├── auth.js             # Register / login / JWT endpoints
├── authMiddleware.js   # JWT verification middleware
├── database.js         # SQLite setup, schema, seed data
├── students.js         # Student CRUD API
├── payments.js         # Payment recording API
├── reports.js          # Monthly reports + CSV export API
├── reminders.js        # Email reminder trigger API
├── settings.js         # Per-library settings API
├── reminderService.js  # Core email sending logic
├── messagingService.js # Nodemailer email transport
├── public/
│   ├── landing.html    # Marketing landing page
│   ├── auth.html       # Login / Register UI
│   ├── index.html      # Dashboard (requires auth)
│   ├── app.js          # Frontend JavaScript
│   └── style.css       # Styles
├── .env.example        # Environment variable template
├── .gitignore          # Git ignore rules
└── package.json
```

---

## 🔒 Security

- Passwords hashed with **bcrypt** (10 salt rounds)
- All API routes protected with **JWT Bearer tokens**
- Each library's data is **completely isolated** — Library A cannot access Library B's data
- `.env` file excluded from version control via `.gitignore`
- Database file excluded from version control

---

## 📡 API Endpoints

### Auth (Public)
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register new library |
| POST | `/api/auth/login` | Login, receive JWT |
| GET | `/api/auth/me` | Get current library info |

### Protected (require `Authorization: Bearer <token>`)
| Method | Endpoint | Description |
|---|---|---|
| GET/POST | `/api/students` | List / add students |
| GET/PUT/DELETE | `/api/students/:id` | Get / update / remove student |
| GET/POST | `/api/payments` | List / record payments |
| POST | `/api/reminders/send` | Send email reminders |
| GET | `/api/reminders/log` | Reminder history |
| GET | `/api/reports/summary` | Monthly summary |
| GET | `/api/reports/defaulters` | Pending fee list |
| GET | `/api/reports/csv` | Download CSV report |
| GET/PUT | `/api/settings` | Get / update library settings |

---

## 🤝 Contributing

Pull requests are welcome. For major changes, please open an issue first.

---

## 📄 License

MIT © 2026 — Built as a portfolio project.
