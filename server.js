require('dotenv').config();
const express = require('express'), cors = require('cors'), path = require('path');
const bcrypt = require('bcryptjs'), jwt = require('jsonwebtoken');
const db = require('./db');

const app = express();
const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const STATUS = ['todo', 'in_progress', 'done'], PRIORITY = ['low', 'medium', 'high'];

app.use(cors({ origin: process.env.CORS_ORIGIN || true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const sign = u => jwt.sign({ id: u.id, name: u.name }, SECRET, { expiresIn: '7d' });
const auth = (req, res, next) => {
  try { req.user = jwt.verify((req.headers.authorization || '').replace('Bearer ', ''), SECRET); next(); }
  catch { res.status(401).json({ error: 'Unauthorized' }); }
};

// ---------- Auth ----------
app.post('/api/auth/register', (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !/^\S+@\S+\.\S+$/.test(email || '') || (password || '').length < 6)
    return res.status(400).json({ error: 'Name, valid email and password (min 6 chars) required' });
  if (db.prepare('SELECT 1 FROM users WHERE email=?').get(email.toLowerCase()))
    return res.status(409).json({ error: 'Email already registered' });
  const r = db.prepare('INSERT INTO users(name,email,password) VALUES(?,?,?)')
    .run(name.trim(), email.toLowerCase(), bcrypt.hashSync(password, 10));
  const u = { id: r.lastInsertRowid, name: name.trim() };
  res.status(201).json({ token: sign(u), user: u });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const u = db.prepare('SELECT * FROM users WHERE email=?').get((email || '').toLowerCase());
  if (!u || !bcrypt.compareSync(password || '', u.password))
    return res.status(401).json({ error: 'Invalid email or password' });
  res.json({ token: sign(u), user: { id: u.id, name: u.name } });
});

// ---------- Tasks ----------
function validate(b, partial = false) {
  const t = {};
  if (b.title !== undefined || !partial) {
    if (!b.title || !String(b.title).trim()) return { error: 'Title is required' };
    t.title = String(b.title).trim().slice(0, 150);
  }
  if (b.description !== undefined) t.description = String(b.description).slice(0, 1000);
  if (b.status !== undefined) { if (!STATUS.includes(b.status)) return { error: 'Invalid status' }; t.status = b.status; }
  if (b.priority !== undefined) { if (!PRIORITY.includes(b.priority)) return { error: 'Invalid priority' }; t.priority = b.priority; }
  if (b.due_date !== undefined) t.due_date = b.due_date || null;
  return { t };
}

// List with search + filter + sort + pagination
app.get('/api/tasks', auth, (req, res) => {
  const { q, status, priority, sort = 'created_at', order = 'desc' } = req.query;
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 5, 1), 50);
  const where = ['user_id = ?'], params = [req.user.id];
  if (q) { where.push('(title LIKE ? OR description LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }
  if (STATUS.includes(status)) { where.push('status = ?'); params.push(status); }
  if (PRIORITY.includes(priority)) { where.push('priority = ?'); params.push(priority); }
  const sortMap = {
    created_at: 'created_at', title: 'title COLLATE NOCASE', due_date: 'due_date',
    priority: "CASE priority WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END"
  };
  const orderBy = `${sortMap[sort] || 'created_at'} ${order === 'asc' ? 'ASC' : 'DESC'}, id DESC`;
  const w = where.join(' AND ');
  const total = db.prepare(`SELECT COUNT(*) c FROM tasks WHERE ${w}`).get(...params).c;
  const data = db.prepare(`SELECT * FROM tasks WHERE ${w} ORDER BY ${orderBy} LIMIT ? OFFSET ?`)
    .all(...params, limit, (page - 1) * limit);
  res.json({ data, page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) });
});

app.get('/api/tasks/stats', auth, (req, res) => {
  const rows = db.prepare('SELECT status, COUNT(*) c FROM tasks WHERE user_id=? GROUP BY status').all(req.user.id);
  const s = { todo: 0, in_progress: 0, done: 0 }; rows.forEach(r => (s[r.status] = r.c));
  res.json({ ...s, total: s.todo + s.in_progress + s.done });
});

app.post('/api/tasks', auth, (req, res) => {
  const { t, error } = validate(req.body || {});
  if (error) return res.status(400).json({ error });
  const r = db.prepare('INSERT INTO tasks(user_id,title,description,status,priority,due_date) VALUES(?,?,?,?,?,?)')
    .run(req.user.id, t.title, t.description || '', t.status || 'todo', t.priority || 'medium', t.due_date || null);
  res.status(201).json(db.prepare('SELECT * FROM tasks WHERE id=?').get(r.lastInsertRowid));
});

app.put('/api/tasks/:id', auth, (req, res) => {
  const cur = db.prepare('SELECT * FROM tasks WHERE id=? AND user_id=?').get(req.params.id, req.user.id);
  if (!cur) return res.status(404).json({ error: 'Task not found' });
  const { t, error } = validate(req.body || {}, true);
  if (error) return res.status(400).json({ error });
  const n = { ...cur, ...t };
  db.prepare('UPDATE tasks SET title=?,description=?,status=?,priority=?,due_date=? WHERE id=?')
    .run(n.title, n.description, n.status, n.priority, n.due_date, cur.id);
  res.json(db.prepare('SELECT * FROM tasks WHERE id=?').get(cur.id));
});

app.delete('/api/tasks/:id', auth, (req, res) => {
  const r = db.prepare('DELETE FROM tasks WHERE id=? AND user_id=?').run(req.params.id, req.user.id);
  r.changes ? res.status(204).end() : res.status(404).json({ error: 'Task not found' });
});

app.get('/api/health', (_, res) => res.json({ ok: true }));
app.use('/api', (_, res) => res.status(404).json({ error: 'Not found' }));

const PORT = process.env.PORT || 3000;
if (require.main === module) app.listen(PORT, () => console.log(`DevTrack running on :${PORT}`));
module.exports = app;
