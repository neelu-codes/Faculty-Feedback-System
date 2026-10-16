const express = require('express');
const path = require('path');
const crypto = require('crypto');
const db = require('./db');
const A = require('./auth');
const CONFIG = require('./config.json');
const RATING_MAX = Number(process.env.RATING_MAX) || CONFIG.ratingMax || 5;

const app = express();
app.use(express.json({ limit: '100kb' }));
app.use(A.attachUser);

const wrap = fn => (req, res) => {
  try { fn(req, res); }
  catch (e) {
    if (String(e.message).includes('UNIQUE')) return res.status(409).json({ error: 'That entry already exists.' });
    if (String(e.message).includes('FOREIGN KEY')) return res.status(400).json({ error: 'Related record is missing or still in use.' });
    console.error(e); res.status(500).json({ error: 'Server error.' });
  }
};
const str = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const bad = (res, msg) => res.status(400).json({ error: msg });

/* ---------- AUTH ---------- */
const api = express.Router();

api.get('/public/config', (_req, res) => res.json({ ...CONFIG, ratingMax: RATING_MAX }));

api.get('/public/classes', wrap((_req, res) => {
  res.json(db.prepare(`SELECT c.id, c.name, d.name AS department FROM classes c
    JOIN departments d ON d.id = c.department_id ORDER BY d.name, c.name`).all());
}));

api.post('/auth/register', wrap((req, res) => {
  const name = str(req.body.name, 80), email = str(req.body.email, 120).toLowerCase();
  const password = str(req.body.password, 100), roll = str(req.body.rollNo, 30);
  const classId = Number(req.body.classId);
  if (name.length < 2) return bad(res, 'Please enter your full name.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return bad(res, 'Enter a valid email address.');
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password))
    return bad(res, 'Password must be 8+ characters with a letter and a number.');
  if (!roll) return bad(res, 'Roll / register number is required.');
  if (!db.prepare('SELECT 1 FROM classes WHERE id=?').get(classId)) return bad(res, 'Please select your class.');
  const info = db.prepare(`INSERT INTO users (name,email,password_hash,role,roll_no,class_id)
    VALUES (?,?,?,'student',?,?)`).run(name, email, A.hashPassword(password), roll, classId);
  res.status(201).json({ id: info.lastInsertRowid });
}));

api.post('/auth/login', wrap((req, res) => {
  const email = str(req.body.email, 120).toLowerCase(), password = str(req.body.password, 100);
  const u = db.prepare('SELECT * FROM users WHERE email=?').get(email);
  if (!u || !A.verifyPassword(password, u.password_hash)) return res.status(401).json({ error: 'Incorrect email or password.' });
  const token = A.createSession(u.id);
  res.json({ token, user: { id: u.id, name: u.name, email: u.email, role: u.role, rollNo: u.roll_no, classId: u.class_id } });
}));

api.post('/auth/logout', A.requireLogin, wrap((req, res) => {
  db.prepare('DELETE FROM sessions WHERE token=?').run(req.token);
  res.json({ ok: true });
}));

api.get('/auth/me', A.requireLogin, wrap((req, res) => {
  const u = req.user;
  res.json({ id: u.id, name: u.name, email: u.email, role: u.role, rollNo: u.roll_no, classId: u.class_id });
}));

/* ---------- DEPARTMENTS / CLASSES / FACULTIES (admin) ---------- */
api.get('/departments', A.requireLogin, wrap((_req, res) =>
  res.json(db.prepare('SELECT * FROM departments ORDER BY name').all())));
api.post('/departments', A.requireAdmin, wrap((req, res) => {
  const name = str(req.body.name, 80); if (!name) return bad(res, 'Department name is required.');
  res.status(201).json({ id: db.prepare('INSERT INTO departments (name) VALUES (?)').run(name).lastInsertRowid });
}));
api.put('/departments/:id', A.requireAdmin, wrap((req, res) => {
  const name = str(req.body.name, 80); if (!name) return bad(res, 'Department name is required.');
  db.prepare('UPDATE departments SET name=? WHERE id=?').run(name, req.params.id); res.json({ ok: true });
}));
api.delete('/departments/:id', A.requireAdmin, wrap((req, res) => {
  db.prepare('DELETE FROM departments WHERE id=?').run(req.params.id); res.json({ ok: true });
}));

api.get('/classes', A.requireLogin, wrap((_req, res) => {
  res.json(db.prepare(`SELECT c.id, c.name, c.department_id AS departmentId, d.name AS department,
    (SELECT COUNT(*) FROM users u WHERE u.class_id=c.id) AS students
    FROM classes c JOIN departments d ON d.id=c.department_id ORDER BY d.name, c.name`).all());
}));
api.post('/classes', A.requireAdmin, wrap((req, res) => {
  const name = str(req.body.name, 80), dep = Number(req.body.departmentId);
  if (!name || !dep) return bad(res, 'Class name and department are required.');
  res.status(201).json({ id: db.prepare('INSERT INTO classes (department_id,name) VALUES (?,?)').run(dep, name).lastInsertRowid });
}));
api.put('/classes/:id', A.requireAdmin, wrap((req, res) => {
  const name = str(req.body.name, 80), dep = Number(req.body.departmentId);
  if (!name || !dep) return bad(res, 'Class name and department are required.');
  db.prepare('UPDATE classes SET name=?, department_id=? WHERE id=?').run(name, dep, req.params.id); res.json({ ok: true });
}));
api.delete('/classes/:id', A.requireAdmin, wrap((req, res) => {
  db.prepare('DELETE FROM classes WHERE id=?').run(req.params.id); res.json({ ok: true });
}));

api.get('/faculties', A.requireLogin, wrap((_req, res) => {
  res.json(db.prepare(`SELECT f.id, f.name, f.subject, f.department_id AS departmentId, d.name AS department
    FROM faculties f JOIN departments d ON d.id=f.department_id ORDER BY d.name, f.name`).all());
}));
api.post('/faculties', A.requireAdmin, wrap((req, res) => {
  const name = str(req.body.name, 80), subject = str(req.body.subject, 100), dep = Number(req.body.departmentId);
  if (!name || !subject || !dep) return bad(res, 'Name, subject and department are required.');
  res.status(201).json({ id: db.prepare('INSERT INTO faculties (department_id,name,subject) VALUES (?,?,?)').run(dep, name, subject).lastInsertRowid });
}));
api.put('/faculties/:id', A.requireAdmin, wrap((req, res) => {
  const name = str(req.body.name, 80), subject = str(req.body.subject, 100), dep = Number(req.body.departmentId);
  if (!name || !subject || !dep) return bad(res, 'Name, subject and department are required.');
  db.prepare('UPDATE faculties SET name=?, subject=?, department_id=? WHERE id=?').run(name, subject, dep, req.params.id); res.json({ ok: true });
}));
api.delete('/faculties/:id', A.requireAdmin, wrap((req, res) => {
  db.prepare('DELETE FROM faculties WHERE id=?').run(req.params.id); res.json({ ok: true });
}));

/* ---------- STUDENTS (admin) ---------- */
api.get('/students', A.requireAdmin, wrap((_req, res) => {
  res.json(db.prepare(`SELECT u.id, u.name, u.email, u.roll_no AS rollNo, c.name AS className, u.created_at AS createdAt
    FROM users u LEFT JOIN classes c ON c.id=u.class_id WHERE u.role='student' ORDER BY u.name`).all());
}));
api.post('/students/:id/reset-password', A.requireAdmin, wrap((req, res) => {
  const pw = str(req.body.password, 100);
  if (pw.length < 8 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return bad(res, 'Password must be 8+ characters with a letter and a number.');
  db.prepare("UPDATE users SET password_hash=? WHERE id=? AND role='student'").run(A.hashPassword(pw), req.params.id);
  db.prepare('DELETE FROM sessions WHERE user_id=?').run(req.params.id);
  res.json({ ok: true });
}));
api.delete('/students/:id', A.requireAdmin, wrap((req, res) => {
  db.prepare("DELETE FROM users WHERE id=? AND role='student'").run(req.params.id); res.json({ ok: true });
}));

/* ---------- QUESTIONS (admin) ---------- */
api.get('/questions', A.requireAdmin, wrap((_req, res) =>
  res.json(db.prepare('SELECT * FROM questions ORDER BY category, id').all())));
api.post('/questions', A.requireAdmin, wrap((req, res) => {
  const text = str(req.body.text, 300), type = req.body.type, cat = str(req.body.category, 50) || 'General';
  if (text.length < 5) return bad(res, 'Question text is too short.');
  if (!['rating', 'text'].includes(type)) return bad(res, 'Type must be rating or text.');
  res.status(201).json({ id: db.prepare('INSERT INTO questions (text,type,category) VALUES (?,?,?)').run(text, type, cat).lastInsertRowid });
}));
api.put('/questions/:id', A.requireAdmin, wrap((req, res) => {
  const text = str(req.body.text, 300), type = req.body.type, cat = str(req.body.category, 50) || 'General';
  if (text.length < 5) return bad(res, 'Question text is too short.');
  if (!['rating', 'text'].includes(type)) return bad(res, 'Type must be rating or text.');
  db.prepare('UPDATE questions SET text=?, type=?, category=? WHERE id=?').run(text, type, cat, req.params.id); res.json({ ok: true });
}));
api.delete('/questions/:id', A.requireAdmin, wrap((req, res) => {
  const used = db.prepare('SELECT COUNT(*) n FROM survey_questions WHERE question_id=?').get(req.params.id).n;
  if (used) return bad(res, `This question is used in ${used} survey(s). Remove it from them first.`);
  db.prepare('DELETE FROM questions WHERE id=?').run(req.params.id); res.json({ ok: true });
}));

/* ---------- SURVEYS ---------- */
function surveyDetail(id) {
  const s = db.prepare(`SELECT s.id, s.title, s.description, s.class_id AS classId, c.name AS className,
    s.is_active AS isActive, s.closes_on AS closesOn, s.created_at AS createdAt
    FROM surveys s JOIN classes c ON c.id=s.class_id WHERE s.id=?`).get(id);
  if (!s) return null;
  s.isActive = !!s.isActive;
  s.faculties = db.prepare(`SELECT f.id, f.name, f.subject FROM survey_faculties sf
    JOIN faculties f ON f.id=sf.faculty_id WHERE sf.survey_id=? ORDER BY f.name`).all(id);
  s.questions = db.prepare(`SELECT q.id, q.text, q.type, q.category FROM survey_questions sq
    JOIN questions q ON q.id=sq.question_id WHERE sq.survey_id=? ORDER BY sq.position`).all(id);
  return s;
}
const isOpen = s => s.isActive && (!s.closesOn || s.closesOn >= new Date().toISOString().slice(0, 10));

api.get('/surveys', A.requireAdmin, wrap((_req, res) => {
  const rows = db.prepare(`SELECT s.id, s.title, c.name AS className, s.is_active AS isActive, s.closes_on AS closesOn,
    s.created_at AS createdAt,
    (SELECT COUNT(*) FROM submissions x WHERE x.survey_id=s.id) AS submissions,
    (SELECT COUNT(*) FROM users u WHERE u.class_id=s.class_id AND u.role='student') AS students
    FROM surveys s JOIN classes c ON c.id=s.class_id ORDER BY s.id DESC`).all();
  res.json(rows.map(r => ({ ...r, isActive: !!r.isActive })));
}));
api.get('/surveys/:id', A.requireLogin, wrap((req, res) => {
  const s = surveyDetail(req.params.id);
  if (!s) return res.status(404).json({ error: 'Survey not found.' });
  if (req.user.role === 'student' && s.classId !== req.user.class_id) return res.status(403).json({ error: 'This survey is not for your class.' });
  res.json({ ...s, open: isOpen(s) });
}));

function saveSurvey(req, res, id) {
  const title = str(req.body.title, 120), description = str(req.body.description, 500);
  const classId = Number(req.body.classId), closesOn = str(req.body.closesOn, 10) || null;
  const fac = [...new Set((req.body.facultyIds || []).map(Number).filter(Boolean))];
  const qs = [...new Set((req.body.questionIds || []).map(Number).filter(Boolean))];
  if (title.length < 3) return bad(res, 'Survey title is required.');
  if (!db.prepare('SELECT 1 FROM classes WHERE id=?').get(classId)) return bad(res, 'Select a class.');
  if (!fac.length) return bad(res, 'Select at least one faculty.');
  if (!qs.length) return bad(res, 'Select at least one question.');
  if (closesOn && !/^\d{4}-\d{2}-\d{2}$/.test(closesOn)) return bad(res, 'Invalid closing date.');
  db.transaction(() => {
    if (id) {
      if (db.prepare('SELECT COUNT(*) n FROM submissions WHERE survey_id=?').get(id).n)
        throw Object.assign(new Error('LOCKED'), { locked: true });
      db.prepare('UPDATE surveys SET title=?,description=?,class_id=?,closes_on=? WHERE id=?').run(title, description, classId, closesOn, id);
      db.prepare('DELETE FROM survey_faculties WHERE survey_id=?').run(id);
      db.prepare('DELETE FROM survey_questions WHERE survey_id=?').run(id);
    } else {
      id = db.prepare('INSERT INTO surveys (title,description,class_id,closes_on) VALUES (?,?,?,?)').run(title, description, classId, closesOn).lastInsertRowid;
    }
    fac.forEach(f => db.prepare('INSERT INTO survey_faculties VALUES (?,?)').run(id, f));
    qs.forEach((q, i) => db.prepare('INSERT INTO survey_questions VALUES (?,?,?)').run(id, q, i));
  })();
  return id;
}
api.post('/surveys', A.requireAdmin, wrap((req, res) => {
  const id = saveSurvey(req, res, null); if (id) res.status(201).json({ id });
}));
api.put('/surveys/:id', A.requireAdmin, wrap((req, res) => {
  try { const id = saveSurvey(req, res, Number(req.params.id)); if (id) res.json({ ok: true }); }
  catch (e) { if (e.locked) return bad(res, 'Students have already responded, so questions and faculties can no longer be changed. You can still close the survey.'); throw e; }
}));
api.patch('/surveys/:id/active', A.requireAdmin, wrap((req, res) => {
  db.prepare('UPDATE surveys SET is_active=? WHERE id=?').run(req.body.isActive ? 1 : 0, req.params.id); res.json({ ok: true });
}));
api.delete('/surveys/:id', A.requireAdmin, wrap((req, res) => {
  db.prepare('DELETE FROM surveys WHERE id=?').run(req.params.id); res.json({ ok: true });
}));

/* ---------- STUDENT: my surveys + submit ---------- */
api.get('/my/surveys', A.requireStudent, wrap((req, res) => {
  const rows = db.prepare(`SELECT s.id, s.title, s.description, s.closes_on AS closesOn, s.is_active AS isActive,
    (SELECT submitted_at FROM submissions x WHERE x.survey_id=s.id AND x.user_id=?) AS submittedAt
    FROM surveys s WHERE s.class_id=? ORDER BY s.id DESC`).all(req.user.id, req.user.class_id);
  res.json(rows.map(r => ({ ...r, isActive: !!r.isActive, open: isOpen({ isActive: !!r.isActive, closesOn: r.closesOn }) })));
}));

api.post('/surveys/:id/submit', A.requireStudent, wrap((req, res) => {
  const s = surveyDetail(req.params.id);
  if (!s || s.classId !== req.user.class_id) return res.status(404).json({ error: 'Survey not found.' });
  if (!isOpen(s)) return bad(res, 'This survey is closed.');
  if (db.prepare('SELECT 1 FROM submissions WHERE survey_id=? AND user_id=?').get(s.id, req.user.id))
    return res.status(409).json({ error: 'You have already submitted this survey.' });
  const answers = Array.isArray(req.body.answers) ? req.body.answers : [];
  const map = new Map(answers.map(a => [`${a.facultyId}:${a.questionId}`, a]));
  const batch = crypto.randomBytes(8).toString('hex');
  const rows = [];
  for (const f of s.faculties) for (const q of s.questions) {
    const a = map.get(`${f.id}:${q.id}`) || {};
    if (q.type === 'rating') {
      const r = Number(a.rating);
      if (!Number.isInteger(r) || r < 1 || r > RATING_MAX) return bad(res, `Please rate "${q.text}" for ${f.name}.`);
      rows.push([s.id, f.id, q.id, r, null, batch]);
    } else {
      rows.push([s.id, f.id, q.id, null, str(a.comment, 500) || null, batch]);
    }
  }
  db.transaction(() => {
    db.prepare('INSERT INTO submissions (survey_id,user_id) VALUES (?,?)').run(s.id, req.user.id);
    const ins = db.prepare('INSERT INTO responses (survey_id,faculty_id,question_id,rating,comment,batch) VALUES (?,?,?,?,?,?)');
    rows.forEach(r => ins.run(...r));
  })();
  res.status(201).json({ ok: true });
}));

/* ---------- ADMIN: stats + reports ---------- */
api.get('/admin/stats', A.requireAdmin, wrap((_req, res) => {
  const n = sql => db.prepare(sql).get().n;
  const perFaculty = db.prepare(`SELECT f.name, ROUND(AVG(r.rating),2) AS avg, COUNT(DISTINCT r.batch) AS responses
    FROM responses r JOIN faculties f ON f.id=r.faculty_id WHERE r.rating IS NOT NULL GROUP BY f.id ORDER BY avg DESC`).all();
  res.json({
    students: n("SELECT COUNT(*) n FROM users WHERE role='student'"),
    faculties: n('SELECT COUNT(*) n FROM faculties'),
    surveys: n('SELECT COUNT(*) n FROM surveys'),
    activeSurveys: n('SELECT COUNT(*) n FROM surveys WHERE is_active=1'),
    submissions: n('SELECT COUNT(*) n FROM submissions'),
    perFaculty,
    recent: db.prepare(`SELECT s.id, s.title, c.name AS className,
      (SELECT COUNT(*) FROM submissions x WHERE x.survey_id=s.id) AS submissions,
      (SELECT COUNT(*) FROM users u WHERE u.class_id=s.class_id AND u.role='student') AS students
      FROM surveys s JOIN classes c ON c.id=s.class_id ORDER BY s.id DESC LIMIT 5`).all()
  });
}));

api.get('/admin/submission-overview', A.requireAdmin, wrap((_req, res) => {
  const submitted = db.prepare(`SELECT u.roll_no AS rollNo, d.name AS department
    FROM submissions x
    JOIN users u ON u.id=x.user_id
    JOIN surveys s ON s.id=x.survey_id
    JOIN classes c ON c.id=s.class_id
    JOIN departments d ON d.id=c.department_id
    ORDER BY x.id`).all();
  const notSubmittedCount = db.prepare(`SELECT COUNT(*) AS n FROM users u
    WHERE u.role='student' AND NOT EXISTS (
      SELECT 1 FROM submissions x WHERE x.user_id=u.id
    )`).get().n;
  res.json({ submitted, notSubmittedCount });
}));

api.get('/reports/faculty', A.requireAdmin, wrap((req, res) => {
  const where = [], args = [];
  if (req.query.surveyId) { where.push('r.survey_id=?'); args.push(Number(req.query.surveyId)); }
  if (req.query.departmentId) { where.push('f.department_id=?'); args.push(Number(req.query.departmentId)); }
  const w = where.length ? 'AND ' + where.join(' AND ') : '';
  const rows = db.prepare(`SELECT f.id, f.name, f.subject, d.name AS department,
    ROUND(AVG(r.rating),2) AS avg, COUNT(DISTINCT r.batch) AS responses, MIN(r.rating) AS lowest, MAX(r.rating) AS highest
    FROM responses r JOIN faculties f ON f.id=r.faculty_id JOIN departments d ON d.id=f.department_id
    WHERE r.rating IS NOT NULL ${w} GROUP BY f.id ORDER BY avg DESC`).all(...args);
  res.json(rows);
}));

api.get('/reports/faculty/:id', A.requireAdmin, wrap((req, res) => {
  const args = [req.params.id], sv = req.query.surveyId ? 'AND r.survey_id=?' : '';
  if (req.query.surveyId) args.push(Number(req.query.surveyId));
  const faculty = db.prepare('SELECT f.id,f.name,f.subject,d.name AS department FROM faculties f JOIN departments d ON d.id=f.department_id WHERE f.id=?').get(req.params.id);
  if (!faculty) return res.status(404).json({ error: 'Faculty not found.' });
  const byQuestion = db.prepare(`SELECT q.id, q.text, q.category, ROUND(AVG(r.rating),2) AS avg, COUNT(r.rating) AS n
    FROM responses r JOIN questions q ON q.id=r.question_id WHERE r.faculty_id=? ${sv} AND q.type='rating'
    GROUP BY q.id ORDER BY q.category, q.id`).all(...args);
  const distribution = db.prepare(`SELECT r.rating, COUNT(*) AS n FROM responses r WHERE r.faculty_id=? ${sv} AND r.rating IS NOT NULL
    GROUP BY r.rating ORDER BY r.rating`).all(...args);
  const comments = db.prepare(`SELECT q.text AS question, r.comment, r.created_at AS at FROM responses r
    JOIN questions q ON q.id=r.question_id WHERE r.faculty_id=? ${sv} AND r.comment IS NOT NULL ORDER BY r.id DESC LIMIT 100`).all(...args);
  res.json({ faculty, byQuestion, distribution, comments });
}));

api.get('/reports/submissions/:surveyId', A.requireAdmin, wrap((req, res) => {
  const s = db.prepare('SELECT id,title,class_id FROM surveys WHERE id=?').get(req.params.surveyId);
  if (!s) return res.status(404).json({ error: 'Survey not found.' });
  // Only reveals WHO submitted / who is pending, never what they answered
  const students = db.prepare(`SELECT u.id, u.name, u.roll_no AS rollNo, x.submitted_at AS submittedAt
    FROM users u LEFT JOIN submissions x ON x.user_id=u.id AND x.survey_id=?
    WHERE u.role='student' AND u.class_id=? ORDER BY u.roll_no, u.name`).all(s.id, s.class_id);
  res.json({ survey: { id: s.id, title: s.title }, students });
}));

app.use('/api', api);
app.use('/api', (_req, res) => res.status(404).json({ error: 'Unknown API route.' }));

/* ---------- Static frontend ---------- */
app.use(express.static(path.join(__dirname, '..', 'public'), { extensions: ['html'] }));

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`Faculty Feedback System running at http://localhost:${PORT}`));
}
module.exports = app;
