const $ = id => document.getElementById(id);
const API = window.API_URL || '/api';          // set window.API_URL if frontend is hosted separately
let token = localStorage.getItem('token'), page = 1, totalPages = 1, editId = null, isRegister = false, timer;

async function api(path, method = 'GET', body) {
  const r = await fetch(API + path, { method, headers: { 'Content-Type': 'application/json', ...(token && { Authorization: 'Bearer ' + token }) }, body: body && JSON.stringify(body) });
  if (r.status === 401 && token) { logout(); throw new Error('Session expired'); }
  const j = r.status === 204 ? null : await r.json();
  if (!r.ok) throw new Error(j.error || 'Request failed');
  return j;
}
const toast = m => { const t = $('toast'); t.textContent = m; t.style.display = 'block'; setTimeout(() => (t.style.display = 'none'), 2200); };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- Auth ----------
function showApp(user) {
  $('auth').hidden = true; $('app').hidden = false; $('userbox').hidden = false; $('uname').textContent = user.name;
  load(); loadStats();
}
function logout() { localStorage.clear(); token = null; $('app').hidden = true; $('userbox').hidden = true; $('auth').hidden = false; }
$('logout').onclick = logout;
$('toggle').onclick = e => { e.preventDefault(); isRegister = !isRegister; $('name').hidden = !isRegister; $('name').required = isRegister;
  $('authTitle').textContent = isRegister ? 'Register' : 'Login'; $('toggle').textContent = isRegister ? 'Have an account? Login' : 'Need an account? Register'; };
async function authenticate(email, password, name) {
  try {
    const r = await api(isRegister ? '/auth/register' : '/auth/login', 'POST', { name, email, password });
    token = r.token; localStorage.setItem('token', token); localStorage.setItem('user', JSON.stringify(r.user)); showApp(r.user);
  } catch (e) { $('authErr').textContent = e.message; }
}
$('authForm').onsubmit = e => { e.preventDefault(); $('authErr').textContent = ''; authenticate($('email').value, $('password').value, $('name').value); };
$('demo').onclick = () => { isRegister = false; authenticate('demo@devtrack.dev', 'demo1234'); };

// ---------- List / search / filter / pagination ----------
async function load() {
  $('list').innerHTML = '<div class="loading">Loading…</div>';
  const [sort, order] = $('sort').value.split(':');
  const p = new URLSearchParams({ page, limit: $('limit').value, sort, order });
  if ($('q').value.trim()) p.set('q', $('q').value.trim());
  if ($('fStatus').value) p.set('status', $('fStatus').value);
  if ($('fPriority').value) p.set('priority', $('fPriority').value);
  try {
    const r = await api('/tasks?' + p); totalPages = r.totalPages;
    if (page > totalPages) { page = totalPages; return load(); }
    $('list').innerHTML = r.data.length ? r.data.map(row).join('') : '<div class="empty">No tasks found.</div>';
    $('pageInfo').textContent = `Page ${r.page} of ${r.totalPages} · ${r.total} task${r.total === 1 ? '' : 's'}`;
    $('prev').disabled = page <= 1; $('next').disabled = page >= totalPages;
  } catch (e) { $('list').innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
}
const row = t => `<div class="task"><div><h3>${esc(t.title)}</h3>${t.description ? `<p>${esc(t.description)}</p>` : ''}
  <span class="badge ${t.status}">${t.status.replace('_', ' ')}</span><span class="badge ${t.priority}">${t.priority}</span>${t.due_date ? `<span class="badge">📅 ${esc(t.due_date)}</span>` : ''}</div>
  <div class="actions"><button class="ghost" onclick='edit(${JSON.stringify(t).replace(/'/g, '&#39;')})'>Edit</button><button class="ghost" onclick="del(${t.id})">🗑</button></div></div>`;
async function loadStats() {
  const s = await api('/tasks/stats');
  $('stats').innerHTML = [['Total', s.total], ['To do', s.todo], ['In progress', s.in_progress], ['Done', s.done]].map(([l, n]) => `<div class="stat"><b>${n}</b><span>${l}</span></div>`).join('');
}
const refresh = () => { load(); loadStats(); };
$('q').oninput = () => { clearTimeout(timer); timer = setTimeout(() => { page = 1; load(); }, 300); };
['fStatus', 'fPriority', 'sort', 'limit'].forEach(id => ($(id).onchange = () => { page = 1; load(); }));
$('prev').onclick = () => { page--; load(); }; $('next').onclick = () => { page++; load(); };

// ---------- Create / edit / delete ----------
function openForm(t = {}) {
  editId = t.id || null; $('dlgTitle').textContent = editId ? 'Edit task' : 'New task'; $('taskErr').textContent = '';
  $('tTitle').value = t.title || ''; $('tDesc').value = t.description || ''; $('tStatus').value = t.status || 'todo';
  $('tPriority').value = t.priority || 'medium'; $('tDue').value = t.due_date || ''; $('dlg').showModal();
}
window.edit = openForm; $('add').onclick = () => openForm(); $('cancel').onclick = () => $('dlg').close();
$('taskForm').onsubmit = async e => {
  e.preventDefault();
  const body = { title: $('tTitle').value, description: $('tDesc').value, status: $('tStatus').value, priority: $('tPriority').value, due_date: $('tDue').value };
  try { await api(editId ? '/tasks/' + editId : '/tasks', editId ? 'PUT' : 'POST', body); $('dlg').close(); toast(editId ? 'Task updated' : 'Task created'); refresh(); }
  catch (err) { $('taskErr').textContent = err.message; }
};
window.del = async id => { if (!confirm('Delete this task?')) return; try { await api('/tasks/' + id, 'DELETE'); toast('Task deleted'); refresh(); } catch (e) { toast(e.message); } };

if (token) showApp(JSON.parse(localStorage.getItem('user') || '{"name":"User"}'));
