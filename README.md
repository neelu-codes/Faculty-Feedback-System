# Faculty Feedback System (WT Mini Project)

Anonymous faculty feedback for colleges. **Frontend:** HTML, CSS, JavaScript (no frameworks).
**Backend:** Node.js + Express. **Database:** SQLite (single file, no setup).

## Run it (3 commands)
```bash
npm install
npm run seed      # creates sample data (admin + 8 students + 1 survey)
npm start         # open http://localhost:3000
```
Demo logins: `admin@college.edu / Admin@123` and `student7@college.edu / Student@123` (student1-5 have already submitted; 6-8 have not).
`npm run reset` wipes the database and re-seeds it.

## Make it your college's
Edit **`server/config.json`**: college name, short name, tagline, rating scale (`ratingMax`, `ratingLabels`), roll-number label and hint.
Departments, classes, faculty and questions are *data* the admin adds in the app, nothing is hard-coded.
Set a different admin login with `ADMIN_EMAIL` / `ADMIN_PASSWORD` environment variables before `npm run seed`.

## Project structure
```
server/            server.js (routes), db.js, auth.js, schema.sql, seed.js, config.json
public/css/        style.css (one shared stylesheet, responsive + accessible)
public/js/         api.js (ONLY file that calls the backend), app.js (shared layout, nav, a11y toolbar, helpers)
public/js/pages/   one script per page
public/*.html      10 pages
docs/              team split, backend decision, report outline
```

## Modules and pages (8 modules, 4 members x 2 each, see docs/TEAM_SPLIT.md)
| # | Module | Page(s) |
|---|--------|---------|
| 1 | Home & information | index.html |
| 2 | Authentication | login.html, register.html |
| 3 | Student dashboard | student-dashboard.html |
| 4 | Take survey | take-survey.html |
| 5 | Admin dashboard | admin-dashboard.html |
| 6 | Academic setup | admin-academics.html (Departments, Classes, Faculty, Students tabs) |
| 7 | Survey management | admin-questions.html, admin-surveys.html |
| 8 | Reports | admin-reports.html |

## Security and privacy design
- Passwords hashed with scrypt + random salt; sessions are random tokens that expire after 8 hours.
- Every admin route is checked on the **server** (students get 403), not just hidden in the UI.
- One submission per student per survey (database UNIQUE constraint).
- **Anonymity:** `submissions` (who submitted) and `responses` (what was answered) are separate tables with no link between them.
- All user text is HTML-escaped before display; all SQL uses prepared statements; CSV export neutralises formula injection.

## Accessibility features
Skip-to-content link, semantic landmarks, labelled form fields with `aria-invalid` + error text, visible focus rings, keyboard-operable tabs/dialogs/ratings, ARIA live regions for toasts and progress, text-size (A-/A/A+) and high-contrast toolbar (saved per browser), `prefers-reduced-motion` support, 44px touch targets, tables that turn into cards on phones.

## Deploying
Any Node host (Render, Railway, a college server). Set `PORT` if required. SQLite stores data in `data/feedback.db`; on hosts with a temporary disk, attach a persistent volume or switch to MySQL/Postgres (see docs/BACKEND_DECISION.md).
