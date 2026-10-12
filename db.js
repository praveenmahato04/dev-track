const { DatabaseSync } = require('node:sqlite');   // built into Node 22.13+, no compiling needed
const db = new DatabaseSync(process.env.DB_PATH || 'data.db');
db.exec(`
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL, password TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS tasks(
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL,
  title TEXT NOT NULL, description TEXT DEFAULT '',
  status TEXT DEFAULT 'todo', priority TEXT DEFAULT 'medium',
  due_date TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE);
CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id);
`);
module.exports = db;
