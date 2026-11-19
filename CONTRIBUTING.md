# Contributing to SmartAttend

Thank you for your interest in SmartAttend! This guide is for hackathon judges, external reviewers, and developers who want to explore, test, or contribute to the project.

---

## 📋 Quick Setup for Judges & Reviewers

> [!IMPORTANT]
> SmartAttend requires a **Supabase** project and a **Gemini API key** to run locally. See [`README.md`](README.md) for full setup instructions.

### Minimum Requirements

| Tool | Version |
|------|---------|
| Node.js | 18+ |
| Python | 3.8+ |
| npm | 9+ |
| Modern Browser | Chrome / Edge (WebGL required for face recognition) |

### Fast Start (3 Steps)

```bash
# 1. Clone
git clone https://github.com/SmartAttend-official/SmartAttend.git
cd SmartAttend

# 2. Install dependencies
cd server && npm install && cd ..

# 3. Configure environment (copy and fill in your values)
cp server/.env.example server/.env
# Edit server/.env with your Supabase URL, keys, JWT secret, and Gemini API key

# 4. Start the backend
cd server && npm start
```

Then open `html/admin_dashboard.html` (or any other panel HTML) directly in your browser.

---

## 🗄️ Database Setup

1. Create a free [Supabase](https://supabase.com) project.
2. Run `database/schema.sql` in the Supabase SQL Editor.
3. *(Optional)* Run `database/seed_sample_data.sql` to load demo accounts.
4. See `database/README.md` for step-by-step details.

---

## 🧪 Testing the Core Features

| Feature | How to Test |
|---------|------------|
| **Login** | Open any `html/*.html` → Log in with seeded credentials |
| **Face Enrollment** | Admin panel → Register Student → Allow camera → Capture 3–5 poses |
| **Face Attendance** | Admin panel → Start Face Attendance → Allow camera |
| **OTP Lab Attendance** | Professor panel → Generate Lab Code → Student panel → Enter code |
| **AI Chat** | Student dashboard → Ask a question via the chat bubble |
| **Leave Request** | Student dashboard → Apply Leave → Upload document |

Seed credentials (after running `seed_sample_data.sql`):

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@smartattend.edu` | `Admin@123` |
| Professor | `prof.sharma@smartattend.edu` | `Professor@123` |
| Student | `stu001@smartattend.edu` | `Student@123` |

---

## 🏗️ Project Structure

```
SmartAttend/
├── server/            ← Node.js / Express backend (server.js ~5400 lines)
├── html/              ← Frontend HTML panels (served as static files)
├── backend/           ← Frontend API config (config.js)
├── python files/      ← Face encoding utilities (Python + face_recognition)
├── database/          ← Supabase SQL schema + seed data
├── images/            ← UI assets & sample student folder
├── Diagram/           ← Interactive architecture & system diagrams (HTML)
└── Student panel app/ ← Companion student mobile-web panel
```

---

## 🔐 Security Notes for Contributors

- **Never** commit a real `.env` file — it is excluded by `.gitignore`.
- **Never** place real student photographs in `images/students/` — real folders are excluded.
- Use `images/students/sample_student/` as the template for synthetic test data only.
- Run `git ls-files | grep ".env"` before any push to confirm no secrets are staged.

---

## 🐛 Reporting Issues

Please open a GitHub Issue with:
- Steps to reproduce the bug.
- Expected vs. actual behaviour.
- Browser and OS version (for frontend issues).
- Node.js and npm version (for backend issues).

---

## 📄 Licence

SmartAttend is released under the [MIT Licence](LICENSE). By contributing you agree that your contributions will be licensed under the same licence.
