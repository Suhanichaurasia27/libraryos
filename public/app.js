// app.js – LibraryOS Frontend Logic (v2.0 – Multi-Tenant)

// ── Auth helpers ──────────────────────────────────────────────────────────
function getToken() { return localStorage.getItem('los_token') || ''; }

function doLogout() {
  if (!confirm('Log out of LibraryOS?')) return;
  localStorage.removeItem('los_token');
  localStorage.removeItem('los_libraryName');
  localStorage.removeItem('los_ownerName');
  location.href = '/auth.html';
}

// ── Core helpers ──────────────────────────────────────────────────────────
const $   = id => document.getElementById(id);
const fmt = n  => n != null ? '₹' + Number(n).toLocaleString('en-IN') : '—';

function toast(msg, type = 'info') {
  const el = $('toast');
  el.textContent = msg;
  el.className   = 'toast';
  if (type === 'success') el.style.borderColor = '#22c55e';
  else if (type === 'error') el.style.borderColor = '#ef4444';
  else el.style.borderColor = '#2d3748';
  el.classList.remove('hidden');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.add('hidden'), 3500);
}

async function api(method, path, body) {
  const opts = {
    method,
    headers: {
      'Content-Type':  'application/json',
      'Authorization': 'Bearer ' + getToken()
    }
  };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(path, opts);

  // If 401 – token expired, redirect to login
  if (r.status === 401) {
    localStorage.removeItem('los_token');
    location.href = '/auth.html';
    return;
  }
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.error || r.statusText);
  }
  return r.json();
}

// ── Navigation ─────────────────────────────────────────────────────────────
const pageTitles = {
  dashboard: 'Dashboard', students: 'Students', payments: 'Payments',
  reminders: 'Reminders', reports: 'Reports',  settings: 'Settings'
};

function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  $('page-' + name).classList.add('active');
  document.querySelector(`.nav-item[data-page="${name}"]`).classList.add('active');
  $('page-title').textContent = pageTitles[name];
  if (name === 'dashboard') loadDashboard();
  if (name === 'students')  loadStudents();
  if (name === 'payments')  loadPayments();
  if (name === 'reminders') loadReminderLog();
  if (name === 'reports')   loadReports();
  if (name === 'settings')  loadSettings();
}

// ── Health Check ────────────────────────────────────────────────────────────
async function checkHealth() {
  try {
    await fetch('/api/health');
    $('server-status').className      = 'status-dot online';
    $('server-status-text').textContent = 'Online';
  } catch {
    $('server-status').className      = 'status-dot offline';
    $('server-status-text').textContent = 'Offline';
  }
}

// ── Dashboard ───────────────────────────────────────────────────────────────
async function loadDashboard() {
  try {
    const s = await api('GET', '/api/reports/summary');
    $('stat-total').textContent     = s.total_students ?? 0;
    $('stat-collected').textContent = fmt(s.total_collected);
    $('stat-due').textContent       = fmt(s.total_outstanding);
    const pct = s.total_due > 0 ? Math.round((s.total_collected / s.total_due) * 100) : 0;
    $('stat-pct').textContent       = pct + '%';
    $('badge-paid').textContent     = s.paid_count    ?? 0;
    $('badge-partial').textContent  = s.partial_count ?? 0;
    $('badge-pending').textContent  = s.pending_count ?? 0;
    $('progress-bar').style.width   = pct + '%';
  } catch(e) { toast('Dashboard load failed: ' + e.message, 'error'); }

  try {
    const rows  = await api('GET', '/api/reports/defaulters');
    const tbody = $('defaulters-body');
    tbody.innerHTML = rows.length
      ? rows.map(r => `<tr>
          <td>${r.name}</td><td>${r.seat}</td><td>${r.phone}</td>
          <td style="color:#f87171;font-weight:700">${fmt(r.due)}</td>
          <td><span class="pill pill-${r.status}">${r.status}</span></td>
        </tr>`).join('')
      : '<tr><td colspan="5" style="color:#64748b;text-align:center;padding:24px">🎉 No defaulters this month</td></tr>';
  } catch {}
}

// ── Students ─────────────────────────────────────────────────────────────────
let editingStudentId = null;

async function loadStudents() {
  const search = $('student-search').value.trim();
  const status = $('student-filter').value;
  let url = '/api/students?';
  if (search) url += `search=${encodeURIComponent(search)}&`;
  if (status && status !== 'all') url += `status=${status}`;

  try {
    const rows  = await api('GET', url);
    const tbody = $('students-body');
    tbody.innerHTML = rows.length
      ? rows.map(r => `<tr>
          <td><strong>${r.name}</strong></td>
          <td>${r.seat}</td>
          <td>${r.phone}</td>
          <td>${r.email || '—'}</td>
          <td style="font-weight:600">${fmt(r.due)}</td>
          <td><span class="pill pill-${r.fee_status || 'pending'}">${r.fee_status || 'pending'}</span></td>
          <td><div class="actions">
            <button class="btn btn-sm btn-secondary" onclick="openEditModal(${r.id})">Edit</button>
            <button class="btn btn-sm btn-danger"    onclick="deleteStudent(${r.id},'${r.name}')">Del</button>
          </div></td>
        </tr>`).join('')
      : '<tr><td colspan="7" style="color:#64748b;text-align:center;padding:24px">No students found</td></tr>';
  } catch(e) { toast('Error: ' + e.message, 'error'); }
}

function openAddStudentModal() {
  editingStudentId = null;
  $('modal-title').textContent = 'Add Student';
  ['m-name','m-phone','m-email','m-seat'].forEach(id => $(id).value = '');
  $('m-fee').value = 400;
  $('student-modal').classList.remove('hidden');
}

async function openEditModal(id) {
  try {
    const s = await api('GET', `/api/students/${id}`);
    editingStudentId = id;
    $('modal-title').textContent = 'Edit Student';
    $('m-name').value  = s.name        || '';
    $('m-phone').value = s.phone       || '';
    $('m-email').value = s.email       || '';
    $('m-seat').value  = s.seat        || '';
    $('m-fee').value   = s.monthly_fee || 400;
    $('student-modal').classList.remove('hidden');
  } catch(e) { toast('Error: ' + e.message, 'error'); }
}

function closeModal() { $('student-modal').classList.add('hidden'); }

async function saveStudent() {
  const body = {
    name:        $('m-name').value.trim(),
    phone:       $('m-phone').value.trim(),
    email:       $('m-email').value.trim(),
    seat:        $('m-seat').value.trim(),
    monthly_fee: parseInt($('m-fee').value) || 400,
  };
  if (!body.name || !body.phone || !body.seat) {
    toast('Name, phone and seat are required', 'error'); return;
  }
  try {
    if (editingStudentId) {
      await api('PUT', `/api/students/${editingStudentId}`, body);
      toast('Student updated ✓', 'success');
    } else {
      await api('POST', '/api/students', body);
      toast('Student added ✓', 'success');
    }
    closeModal();
    loadStudents();
  } catch(e) { toast('Error: ' + e.message, 'error'); }
}

async function deleteStudent(id, name) {
  if (!confirm(`Remove ${name} from the system?`)) return;
  try {
    await api('DELETE', `/api/students/${id}`);
    toast(`${name} removed`, 'success');
    loadStudents();
  } catch(e) { toast('Error: ' + e.message, 'error'); }
}

// ── Payments ──────────────────────────────────────────────────────────────────
let _studentsCache = [];

async function loadPayments() {
  // Populate student dropdown
  try {
    _studentsCache = await api('GET', '/api/students');
    const sel = $('pay-student');
    sel.innerHTML = _studentsCache.map(s =>
      `<option value="${s.id}" data-fee-id="${s.fee_id}">${s.name} (${s.seat})</option>`
    ).join('');
  } catch {}

  // Load recent payments
  try {
    const data  = await api('GET', '/api/payments');
    const tbody = $('payments-body');
    tbody.innerHTML = data.length
      ? data.map(p => `<tr>
          <td><strong>${p.student_name}</strong></td>
          <td>${p.seat}</td>
          <td>${p.month}</td>
          <td style="color:#4ade80;font-weight:700">${fmt(p.amount)}</td>
          <td><span class="pill pill-paid">${p.mode}</span></td>
          <td style="color:#64748b">${new Date(p.recorded_at).toLocaleDateString('en-IN')}</td>
        </tr>`).join('')
      : '<tr><td colspan="6" style="color:#64748b;text-align:center;padding:24px">No payments yet</td></tr>';
  } catch(e) { toast('Error: ' + e.message, 'error'); }
}

async function recordPayment() {
  const sel     = $('pay-student');
  const feeId   = sel.options[sel.selectedIndex]?.dataset?.feeId;
  const body    = {
    student_id: parseInt(sel.value),
    fee_id:     parseInt(feeId),
    amount:     parseFloat($('pay-amount').value),
    mode:       $('pay-mode').value,
    note:       $('pay-note').value.trim() || undefined,
  };
  if (!body.amount || body.amount <= 0) { toast('Enter a valid amount', 'error'); return; }
  if (!body.fee_id) { toast('No fee record found for this student', 'error'); return; }
  try {
    await api('POST', '/api/payments', body);
    toast(`₹${body.amount} recorded ✓`, 'success');
    $('pay-amount').value = '';
    $('pay-note').value   = '';
    loadPayments();
    loadDashboard();
  } catch(e) { toast('Error: ' + e.message, 'error'); }
}

// ── Reminders ─────────────────────────────────────────────────────────────────
async function sendAllReminders() {
  const btn = $('send-all-btn');
  const res = $('reminder-result');
  if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
  try {
    const r   = await api('POST', '/api/reminders/send');
    const msg = `Sent: ${r.sent ?? 0}  |  Failed: ${r.failed ?? 0}  |  Total: ${r.total ?? 0}`;
    if (res) { res.className = 'alert success mt-16'; res.textContent = '✅ ' + msg; }
    toast('Reminders sent ✓', 'success');
    loadReminderLog();
  } catch(e) {
    if (res) { res.className = 'alert error mt-16'; res.textContent = '❌ ' + e.message; }
    toast('Error: ' + e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '📧 Send to All Pending'; }
  }
}

async function loadReminderLog() {
  try {
    const rows  = await api('GET', '/api/reminders/log');
    const tbody = $('reminder-log-body');
    tbody.innerHTML = rows.length
      ? rows.map(r => `<tr>
          <td>${r.student_name || '—'}</td>
          <td>${r.channel}</td>
          <td><span class="pill pill-${r.status === 'sent' ? 'paid' : 'pending'}">${r.status}</span></td>
          <td>—</td>
          <td style="color:#64748b">${new Date(r.sent_at).toLocaleString('en-IN')}</td>
        </tr>`).join('')
      : '<tr><td colspan="5" style="color:#64748b;text-align:center;padding:24px">No reminders sent yet</td></tr>';
  } catch(e) { toast('Error: ' + e.message, 'error'); }
}

// ── Reports ────────────────────────────────────────────────────────────────────
async function loadReports() {
  try {
    const s     = await api('GET', '/api/reports/summary');
    const tbody = $('monthly-body');
    tbody.innerHTML = `<tr>
      <td><strong>${s.month}</strong></td>
      <td>${s.total_students}</td>
      <td>${fmt(s.total_due)}</td>
      <td style="color:#4ade80">${fmt(s.total_collected)}</td>
      <td style="color:#f87171">${fmt(s.total_outstanding)}</td>
    </tr>`;
  } catch(e) { toast('Error: ' + e.message, 'error'); }
}

function downloadCSV() {
  const month = $('export-month').value || new Date().toISOString().slice(0, 7);
  const token = getToken();
  // Create a temporary link with token in header won't work for file download
  // So we fetch as blob and create a download link
  fetch(`/api/reports/csv?month=${month}`, {
    headers: { 'Authorization': 'Bearer ' + token }
  }).then(r => r.blob()).then(blob => {
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href    = url;
    a.download = `fees-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }).catch(e => toast('Export failed: ' + e.message, 'error'));
}

// ── Settings ───────────────────────────────────────────────────────────────────
async function loadSettings() {
  try {
    const s = await api('GET', '/api/settings');
    $('s-library-name').value  = s.library_name     || '';
    $('s-monthly-fee').value   = s.monthly_fee       || 400;
    $('s-late-fee').value      = s.late_fee_percent  || 0;
    $('s-enable-email').value  = s.enable_email      || 'true';
    $('s-reminder-days').value = s.reminder_days     || '25,28';
    $('s-msg-template').value  = s.msg_template      || '';
  } catch(e) { toast('Error: ' + e.message, 'error'); }
}

async function saveSettings() {
  const body = {
    library_name:     $('s-library-name').value.trim(),
    monthly_fee:      $('s-monthly-fee').value,
    late_fee_percent: $('s-late-fee').value,
    enable_email:     $('s-enable-email').value,
    reminder_days:    $('s-reminder-days').value.trim(),
    msg_template:     $('s-msg-template').value.trim(),
  };
  const res = $('settings-result');
  try {
    await api('PUT', '/api/settings', body);
    res.className   = 'alert success mt-12';
    res.textContent = '✅ Settings saved!';
    toast('Settings saved ✓', 'success');
  } catch(e) {
    res.className   = 'alert error mt-12';
    res.textContent = '❌ ' + e.message;
  }
}

// ── Init ────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  // Show library name in sidebar
  const libName = localStorage.getItem('los_libraryName') || 'My Library';
  const el = $('sidebar-lib-name');
  if (el) el.textContent = libName;

  const now   = new Date();
  const month = now.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
  $('current-month-label').textContent = month;
  $('export-month').value = now.toISOString().slice(0, 7);

  checkHealth();
  setInterval(checkHealth, 30000);
  loadDashboard();
});
