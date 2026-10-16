# Suggested split of work (4 members x 2 modules)

Rubric Part B: each student is marked on **their own 2 modules/pages** and **their own report section**.
Each member owns the HTML + `js/pages/*.js` for their modules, and the matching API routes in `server/server.js`.

| Member | Module A | Module B | Backend routes they own |
|--------|----------|----------|--------------------------|
| **Member 1** | 1. Home (`index.html`) | 2. Authentication (`login.html`, `register.html`) | `/auth/*`, `/public/*` |
| **Member 2** | 3. Student dashboard (`student-dashboard.html`) | 4. Take survey (`take-survey.html`) | `/my/surveys`, `/surveys/:id/submit` |
| **Member 3** | 5. Admin dashboard (`admin-dashboard.html`) | 6. Academic setup (`admin-academics.html`) | `/admin/stats`, `/departments`, `/classes`, `/faculties`, `/students` |
| **Member 4** | 7. Survey management (`admin-questions.html`, `admin-surveys.html`) | 8. Reports (`admin-reports.html`) | `/questions`, `/surveys`, `/reports/*` |

## Part A (team) checklist
- **A1 Integration:** all pages share `css/style.css`, `js/app.js` (header/nav/footer) and `js/api.js`; logging in redirects by role; every page is reachable from navigation. Test the whole flow together: register -> admin creates survey -> student submits -> admin sees report.
- **A2 Responsiveness:** test at 360px, 768px, 1200px (browser DevTools device toolbar). Screenshots go in the report.
- **A3 Accessibility:** run Lighthouse (Accessibility score) and a keyboard-only walkthrough; list the features from README.
- **A4 Report:** see REPORT_OUTLINE.md.
- **A5 Team coordination:** use a shared Git repo, one branch per member, and keep a log of meetings/commits as evidence.

## Part B tips for the viva (3 marks each, be ready to explain)
- Open your own page's HTML, CSS rules you used and JS file line by line.
- Know which API routes your page calls and what each SQL query does.
- Be able to demonstrate validation, an error case, and the mobile layout of your pages.
