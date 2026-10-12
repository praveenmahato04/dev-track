require('dotenv').config();
const bcrypt = require('bcryptjs'); const db = require('./db');
db.prepare('DELETE FROM users WHERE email=?').run('demo@devtrack.dev');
const uid = db.prepare('INSERT INTO users(name,email,password) VALUES(?,?,?)')
  .run('Demo User', 'demo@devtrack.dev', bcrypt.hashSync('demo1234', 10)).lastInsertRowid;
const titles = ['Design database schema','Build REST API','Implement JWT auth','Create login page','Add search bar','Add status filter','Implement pagination','Write README','Record demo video','Deploy backend','Deploy frontend','Fix CORS issue','Add input validation','Write unit tests','Create capstone report','Add loading states','Polish UI','Set up CI','Review security','Update LinkedIn','Add certificates','Prepare portfolio','Optimise queries','Add dark mode','Final submission'];
const S = ['todo','in_progress','done'], P = ['low','medium','high'];
const ins = db.prepare('INSERT INTO tasks(user_id,title,description,status,priority,due_date) VALUES(?,?,?,?,?,?)');
titles.forEach((t, i) => ins.run(uid, t, `Details for: ${t}`, S[i % 3], P[(i * 2) % 3],
  new Date(Date.now() + (i - 5) * 864e5).toISOString().slice(0, 10)));
console.log('Seeded demo@devtrack.dev / demo1234 with', titles.length, 'tasks');
