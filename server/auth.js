const crypto = require('crypto');
const db = require('./db');

const SESSION_HOURS = 8;

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const test = crypto.scryptSync(password, salt, 64);
  const known = Buffer.from(hash, 'hex');
  return known.length === test.length && crypto.timingSafeEqual(known, test);
}

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + SESSION_HOURS * 3600 * 1000).toISOString();
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?,?,?)').run(token, userId, expires);
  return token;
}

// Attaches req.user when a valid Bearer token is sent
function attachUser(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (token) {
    const row = db.prepare(`
      SELECT u.id, u.name, u.email, u.role, u.roll_no, u.class_id, s.expires_at
      FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?`).get(token);
    if (row && new Date(row.expires_at) > new Date()) { req.user = row; req.token = token; }
    else if (row) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  }
  next();
}

const requireLogin = (req, res, next) =>
  req.user ? next() : res.status(401).json({ error: 'Please log in first.' });

const requireAdmin = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Please log in first.' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access only.' });
  next();
};

const requireStudent = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Please log in first.' });
  if (req.user.role !== 'student') return res.status(403).json({ error: 'Students only.' });
  next();
};

module.exports = { hashPassword, verifyPassword, createSession, attachUser, requireLogin, requireAdmin, requireStudent };
