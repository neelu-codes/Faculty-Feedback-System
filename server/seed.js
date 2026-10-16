// Fills the database with sample data. Run: npm run seed   (or npm run reset to wipe first)
const db = require('./db');
const { hashPassword } = require('./auth');

if (process.argv.includes('--reset')) {
  ['responses','submissions','survey_questions','survey_faculties','surveys','questions','sessions','users','faculties','classes','departments']
    .forEach(t => db.exec(`DELETE FROM ${t}`));
  db.exec("DELETE FROM sqlite_sequence");
  console.log('Existing data cleared.');
}
if (db.prepare('SELECT COUNT(*) n FROM users').get().n) {
  console.log('Database already has data. Use "npm run reset" to start fresh.'); process.exit(0);
}

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@college.edu';
const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'Admin@123';

db.transaction(() => {
  const dep = n => db.prepare('INSERT INTO departments (name) VALUES (?)').run(n).lastInsertRowid;
  const cs = dep('Computer Applications'), mgmt = dep('Management Studies');

  const cls = (d, n) => db.prepare('INSERT INTO classes (department_id,name) VALUES (?,?)').run(d, n).lastInsertRowid;
  const mca1 = cls(cs, 'MCA Semester 1'), mca3 = cls(cs, 'MCA Semester 3'), mba1 = cls(mgmt, 'MBA Semester 1');

  const fac = (d, n, s) => db.prepare('INSERT INTO faculties (department_id,name,subject) VALUES (?,?,?)').run(d, n, s).lastInsertRowid;
  const f1 = fac(cs, 'Dr. Anita Rao', 'Web Technology'), f2 = fac(cs, 'Prof. Suresh Kumar', 'Database Management'),
        f3 = fac(cs, 'Prof. Meera Nair', 'Data Structures'), f4 = fac(cs, 'Dr. Rahul Shetty', 'Operating Systems'),
        f5 = fac(mgmt, 'Dr. Kavya Iyer', 'Marketing Management');

  const q = (t, ty, c) => db.prepare('INSERT INTO questions (text,type,category) VALUES (?,?,?)').run(t, ty, c).lastInsertRowid;
  const qs = [
    q('The faculty explains concepts clearly.', 'rating', 'Teaching'),
    q('The faculty is well prepared for every class.', 'rating', 'Teaching'),
    q('The faculty encourages questions and discussion.', 'rating', 'Interaction'),
    q('The faculty is punctual and completes the syllabus on time.', 'rating', 'Discipline'),
    q('The faculty gives useful feedback on assignments and tests.', 'rating', 'Evaluation'),
    q('What should this faculty improve? (optional)', 'text', 'Suggestions'),
  ];

  const admin = db.prepare("INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,'admin')")
    .run('Administrator', ADMIN_EMAIL, hashPassword(ADMIN_PASS)).lastInsertRowid;

  const names = ['Aarav Shah','Diya Menon','Rohan Pai','Sneha Hegde','Karthik Naik','Isha Gupta','Vivek Rao','Nisha Bhat'];
  const studentIds = names.map((n, i) => db.prepare(
    "INSERT INTO users (name,email,password_hash,role,roll_no,class_id) VALUES (?,?,?,'student',?,?)")
    .run(n, `student${i + 1}@college.edu`, hashPassword('Student@123'), `MCA24${String(i + 1).padStart(3, '0')}`, mca1).lastInsertRowid);

  const sv = db.prepare('INSERT INTO surveys (title,description,class_id) VALUES (?,?,?)')
    .run('Semester 1 Faculty Feedback', 'Please rate your faculty honestly. Your answers are anonymous.', mca1).lastInsertRowid;
  [f1, f2, f3, f4].forEach(f => db.prepare('INSERT INTO survey_faculties VALUES (?,?)').run(sv, f));
  qs.forEach((qid, i) => db.prepare('INSERT INTO survey_questions VALUES (?,?,?)').run(sv, qid, i));

  // A few already-submitted sample responses so charts are not empty
  const bias = { [f1]: 4.4, [f2]: 3.9, [f3]: 4.1, [f4]: 3.3 };
  const comments = ['More practical examples would help.', 'Please share notes after class.', 'Great teaching, keep it up!', ''];
  studentIds.slice(0, 5).forEach((uid, si) => {
    db.prepare('INSERT INTO submissions (survey_id,user_id) VALUES (?,?)').run(sv, uid);
    const batch = 'seed' + si;
    [f1, f2, f3, f4].forEach(f => qs.forEach((qid, qi) => {
      if (qi < 5) {
        const r = Math.max(1, Math.min(5, Math.round(bias[f] + ((si * 7 + qi * 3 + f) % 3) - 1)));
        db.prepare('INSERT INTO responses (survey_id,faculty_id,question_id,rating,batch) VALUES (?,?,?,?,?)').run(sv, f, qid, r, batch);
      } else {
        const c = comments[(si + f) % comments.length];
        if (c) db.prepare('INSERT INTO responses (survey_id,faculty_id,question_id,comment,batch) VALUES (?,?,?,?,?)').run(sv, f, qid, c, batch);
      }
    }));
  });
})();

console.log(`Seed complete.\n  Admin   : ${ADMIN_EMAIL} / ${ADMIN_PASS}\n  Student : student1@college.edu / Student@123 (student1..student8)`);
