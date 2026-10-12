process.env.DB_PATH = ':memory:';
const assert = require('assert'); const app = require('./server');
(async () => {
  const srv = app.listen(0); const base = `http://localhost:${srv.address().port}/api`;
  const call = async (p, m = 'GET', b, t) => { const r = await fetch(base + p, { method: m,
    headers: { 'Content-Type': 'application/json', ...(t && { Authorization: 'Bearer ' + t }) },
    body: b && JSON.stringify(b) }); return { s: r.status, j: r.status === 204 ? null : await r.json() }; };
  const reg = await call('/auth/register', 'POST', { name: 'T', email: 't@t.com', password: 'secret1' });
  assert.equal(reg.s, 201); const t = reg.j.token;
  assert.equal((await call('/tasks')).s, 401);
  for (let i = 1; i <= 12; i++) await call('/tasks', 'POST', { title: 'Task ' + i, priority: i % 2 ? 'high' : 'low', status: i > 8 ? 'done' : 'todo' }, t);
  let r = await call('/tasks?page=2&limit=5', 'GET', null, t);
  assert.equal(r.j.total, 12); assert.equal(r.j.data.length, 5); assert.equal(r.j.totalPages, 3);
  r = await call('/tasks?q=Task 1&limit=50', 'GET', null, t); assert.equal(r.j.total, 4);
  r = await call('/tasks?status=done', 'GET', null, t); assert.equal(r.j.total, 4);
  r = await call('/tasks?priority=high&status=todo', 'GET', null, t); assert.ok(r.j.total > 0);
  const id = r.j.data[0].id;
  assert.equal((await call('/tasks/' + id, 'PUT', { status: 'done' }, t)).j.status, 'done');
  assert.equal((await call('/tasks/' + id, 'DELETE', null, t)).s, 204);
  assert.equal((await call('/tasks', 'POST', { title: '' }, t)).s, 400);
  assert.equal((await call('/tasks/stats', 'GET', null, t)).j.total, 11);
  console.log('All tests passed'); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
