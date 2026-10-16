-- Faculty Feedback System: database schema (SQLite)
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS departments (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS classes (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  UNIQUE (department_id, name)
);

CREATE TABLE IF NOT EXISTS faculties (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  subject       TEXT NOT NULL,
  UNIQUE (department_id, name, subject)
);

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('student','admin')),
  roll_no       TEXT,
  class_id      INTEGER REFERENCES classes(id) ON DELETE SET NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS questions (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  text     TEXT NOT NULL UNIQUE,
  type     TEXT NOT NULL CHECK (type IN ('rating','text')),
  category TEXT NOT NULL DEFAULT 'General'
);

CREATE TABLE IF NOT EXISTS surveys (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  class_id    INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  is_active   INTEGER NOT NULL DEFAULT 1,
  closes_on   TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS survey_faculties (
  survey_id  INTEGER NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  faculty_id INTEGER NOT NULL REFERENCES faculties(id) ON DELETE CASCADE,
  PRIMARY KEY (survey_id, faculty_id)
);

CREATE TABLE IF NOT EXISTS survey_questions (
  survey_id   INTEGER NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (survey_id, question_id)
);

-- Who has submitted (kept SEPARATE from answers so feedback stays anonymous)
CREATE TABLE IF NOT EXISTS submissions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  survey_id    INTEGER NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (survey_id, user_id)
);

-- Anonymous answers: no user_id on purpose
CREATE TABLE IF NOT EXISTS responses (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  survey_id   INTEGER NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  faculty_id  INTEGER NOT NULL REFERENCES faculties(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  rating      INTEGER,
  comment     TEXT,
  batch       TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_resp_survey  ON responses(survey_id);
CREATE INDEX IF NOT EXISTS idx_resp_faculty ON responses(faculty_id);
