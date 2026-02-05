const API = window.location.origin + '/api';
let currentYear = null;
let pendingImport = null; // { type: 'mecano'|'bl', data: [...] }

// ===== HELPERS =====

async function api(path, options = {}) {
  const res = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  return res.json();
}

function fmt(amount) {
  if (amount == null || isNaN(amount)) return '0';
  return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

function fmtDate(d) {
  if (!d) return '-';
  if (d.length === 7) return d; // yyyy-mm
  const parts = d.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return d;
}

const MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];

function monthLabel(y, m) { return `${MONTHS[m-1]} ${y}`; }

function toast(msg, type = 'success') {
  const c = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  c.appendChild(el);
  setTimeout(() => el.remove(), 4500);
}

function badge(status) {
  const labels = { paid: 'שולם', partial: 'חלקי', pending: 'ממתין' };
  return `<span class="badge badge-${status}">${labels[status] || status}</span>`;
}

function moneyClass(val) {
  if (val > 0) return 'money-negative';
  if (val < 0) return 'money-positive';
  return '';
}

// ===== TABS =====

function switchTab(name) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const panel = document.getElementById('tab-' + name);
  if (panel) panel.classList.add('active');
  const btn = document.querySelector(`.nav-btn[data-tab="${name}"]`);
  if (btn) btn.classList.add('active');

  if (name === 'dashboard') loadDashboard();
  if (name === 'employees') loadEmployees();
  if (name === 'duties') { loadDutyFilters(); loadDuties(); }
  if (name === 'bl-payments') { loadBLFilters(); loadBLPayments(); }
}

// ===== YEAR =====

async function loadYears() {
  const years = await api('/years');
  const sel = document.getElementById('yearSelect');
  sel.innerHTML = '<option value="">כל השנים</option>';
  years.forEach(y => {
    const o = document.createElement('option');
    o.value = y; o.textContent = y;
    sel.appendChild(o);
  });
  if (years.includes(2025)) { sel.value = 2025; currentYear = 2025; }
  else if (years.length) { sel.value = years[0]; currentYear = years[0]; }
}

function onYearChange() {
  const v = document.getElementById('yearSelect').value;
  currentYear = v ? parseInt(v) : null;
  const active = document.querySelector('.nav-btn.active');
  if (active) switchTab(active.dataset.tab);
}

// ===== DASHBOARD =====

async function loadDashboard() {
  const q = currentYear ? `?year=${currentYear}` : '';
  const s = await api('/stats' + q);

  document.getElementById('statEmployees').textContent = s.totalEmployees;
  document.getElementById('statDays').textContent = s.totalDays;
  document.getElementById('statEmployerPay').textContent = fmt(s.totalEmployerPay);
  document.getElementById('statExpectedBL').textContent = fmt(s.totalExpectedBL);
  document.getElementById('statBLPaid').textContent = fmt(s.totalBLPaid);
  document.getElementById('statBLBalance').textContent = fmt(s.blBalance);
  document.getElementById('statPending').textContent = s.pendingCount;
  document.getElementById('statDifference').textContent = fmt(s.totalDifference);

  const bc = document.getElementById('balanceCard');
  bc.classList.remove('success','error','warning');
  if (s.blBalance === 0 && s.totalExpectedBL > 0) bc.classList.add('success');
  else if (s.blBalance > 0) bc.classList.add('error');

  // Alerts
  const alerts = document.getElementById('dashboardAlerts');
  alerts.innerHTML = '';
  if (s.pendingCount > 0)
    alerts.innerHTML += `<div class="alert alert-warning">${s.pendingCount} תקופות שירות עדיין לא שולמו במלואן מב"ל</div>`;
  if (s.blBalance > 5000)
    alerts.innerHTML += `<div class="alert alert-error">יתרה לגבייה מב"ל: ${fmt(s.blBalance)} - כדאי לבדוק</div>`;

  // Monthly summary
  const duties = await api('/duties' + q);
  const container = document.getElementById('monthlySummary');
  if (!duties.length) { container.innerHTML = '<p class="empty-text">אין נתונים</p>'; return; }

  const byMonth = {};
  duties.forEach(d => {
    const k = `${d.year}-${String(d.month).padStart(2,'0')}`;
    if (!byMonth[k]) byMonth[k] = { year: d.year, month: d.month, count: 0, days: 0, employer: 0, expectedBL: 0, paidBL: 0, diff: 0 };
    byMonth[k].count++;
    byMonth[k].days += d.total_days || 0;
    byMonth[k].employer += d.employer_payment || 0;
    byMonth[k].expectedBL += d.expected_bl || 0;
    byMonth[k].paidBL += d.total_bl_paid || 0;
    byMonth[k].diff += d.difference_amount || 0;
  });

  const sorted = Object.values(byMonth).sort((a,b) => a.year !== b.year ? b.year-a.year : b.month-a.month);
  container.innerHTML = sorted.map(m => {
    const bal = m.expectedBL - m.paidBL;
    const pct = m.expectedBL > 0 ? Math.round(m.paidBL / m.expectedBL * 100) : 0;
    const color = pct >= 100 ? 'var(--success)' : pct > 0 ? 'var(--warning)' : 'var(--error)';
    return `
      <div class="month-card" style="border-right-color:${color}">
        <div class="month-card-title">${monthLabel(m.year, m.month)}</div>
        <div class="month-card-row"><span>עובדים/תקופות:</span><strong>${m.count}</strong></div>
        <div class="month-card-row"><span>ימים:</span><strong>${m.days}</strong></div>
        <div class="month-card-row"><span>מעסיק:</span><strong>${fmt(m.employer)}</strong></div>
        <div class="month-card-row"><span>צפוי ב"ל:</span><strong>${fmt(m.expectedBL)}</strong></div>
        <div class="month-card-row"><span>התקבל:</span><strong style="color:${color}">${fmt(m.paidBL)} (${pct}%)</strong></div>
        ${bal > 0 ? `<div class="month-card-row"><span>יתרה:</span><strong style="color:var(--error)">${fmt(bal)}</strong></div>` : ''}
        ${m.diff !== 0 ? `<div class="month-card-row"><span>הפרשים:</span><strong>${fmt(m.diff)}</strong></div>` : ''}
      </div>`;
  }).join('');
}

// ===== EMPLOYEES =====

async function loadEmployees() {
  const q = currentYear ? `?year=${currentYear}` : '';
  const emps = await api('/employees' + q);
  const tbody = document.getElementById('employeesBody');

  if (!emps.length) {
    tbody.innerHTML = `<tr><td colspan="10" class="empty-text">אין עובדים${currentYear ? ` בשנת ${currentYear}` : ''}</td></tr>`;
    return;
  }

  tbody.innerHTML = emps.map(e => `
    <tr>
      <td><strong>${e.full_name || e.first_name + ' ' + e.last_name}</strong></td>
      <td>${e.tz || '-'}</td>
      <td>${e.department || '-'}</td>
      <td class="money">${fmt(e.current_daily_rate || e.daily_rate)}</td>
      <td class="money">${e.total_days}</td>
      <td class="money">${fmt(e.total_expected_bl)}</td>
      <td class="money money-positive">${fmt(e.total_bl_paid)}</td>
      <td class="money ${e.bl_balance > 0 ? 'money-negative' : ''}">${fmt(e.bl_balance)}</td>
      <td class="money ${e.total_difference < 0 ? 'money-negative' : ''}">${fmt(e.total_difference)}</td>
      <td>${e.status || '-'}</td>
    </tr>
  `).join('');

  // Summary
  const totals = emps.reduce((t, e) => ({
    days: t.days + e.total_days,
    exp: t.exp + e.total_expected_bl,
    paid: t.paid + e.total_bl_paid,
    bal: t.bal + e.bl_balance,
    diff: t.diff + e.total_difference
  }), { days: 0, exp: 0, paid: 0, bal: 0, diff: 0 });

  tbody.innerHTML += `
    <tr class="summary-row">
      <td colspan="4"><strong>סה"כ (${emps.length} עובדים)</strong></td>
      <td class="money">${totals.days}</td>
      <td class="money">${fmt(totals.exp)}</td>
      <td class="money money-positive">${fmt(totals.paid)}</td>
      <td class="money ${totals.bal > 0 ? 'money-negative' : ''}">${fmt(totals.bal)}</td>
      <td class="money">${fmt(totals.diff)}</td>
      <td></td>
    </tr>`;
}

function showAddEmployee() { document.getElementById('addEmployeeForm').style.display = 'block'; }
function hideAddEmployee() {
  document.getElementById('addEmployeeForm').style.display = 'none';
  ['empTz','empFirstName','empLastName','empDept'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('empRate').value = '500';
}

async function saveEmployee() {
  const tz = document.getElementById('empTz').value.trim();
  const fn = document.getElementById('empFirstName').value.trim();
  const ln = document.getElementById('empLastName').value.trim();
  const dept = document.getElementById('empDept').value.trim();
  const rate = parseFloat(document.getElementById('empRate').value) || 500;
  if (!fn || !ln) { toast('יש למלא שם פרטי ושם משפחה', 'error'); return; }
  await api('/employees', { method: 'POST', body: { tz, first_name: fn, last_name: ln, full_name: `${fn} ${ln}`, department: dept, daily_rate: rate } });
  toast('עובד נוסף');
  hideAddEmployee();
  loadEmployees();
}

// ===== DUTIES =====

async function loadDutyFilters() {
  if (currentYear) {
    const months = await api(`/months/${currentYear}`);
    const ms = document.getElementById('dutyMonthFilter');
    ms.innerHTML = '<option value="">כל החודשים</option>';
    months.forEach(m => { const o = document.createElement('option'); o.value = m; o.textContent = MONTHS[m-1]; ms.appendChild(o); });
  }
  const emps = await api('/employees');
  const es = document.getElementById('dutyEmployeeFilter');
  es.innerHTML = '<option value="">כל העובדים</option>';
  emps.forEach(e => { const o = document.createElement('option'); o.value = e.id; o.textContent = e.full_name || `${e.first_name} ${e.last_name}`; es.appendChild(o); });
}

async function loadDuties() {
  let p = [];
  if (currentYear) p.push(`year=${currentYear}`);
  const mf = document.getElementById('dutyMonthFilter');
  if (mf && mf.value) p.push(`month=${mf.value}`);
  const ef = document.getElementById('dutyEmployeeFilter');
  if (ef && ef.value) p.push(`employee_id=${ef.value}`);
  const q = p.length ? '?' + p.join('&') : '';

  const duties = await api('/duties' + q);
  const tbody = document.getElementById('dutiesBody');

  if (!duties.length) { tbody.innerHTML = '<tr><td colspan="13" class="empty-text">אין רשומות</td></tr>'; return; }

  tbody.innerHTML = duties.map(d => `
    <tr>
      <td><strong>${d.employee_name}</strong></td>
      <td>${fmtDate(d.start_date)}${d.end_date && d.end_date !== d.start_date ? ' - ' + fmtDate(d.end_date) : ''}</td>
      <td class="money">${d.total_days}</td>
      <td class="money">${d.weekdays || '-'}</td>
      <td class="money">${d.fridays || '-'}</td>
      <td class="money">${d.saturdays || '-'}</td>
      <td class="money">${fmt(d.daily_rate)}</td>
      <td class="money">${fmt(d.employer_payment)}</td>
      <td class="money">${fmt(d.expected_bl)}</td>
      <td class="money money-positive">${fmt(d.total_bl_paid)}</td>
      <td class="money ${d.difference_amount < 0 ? 'money-negative' : ''}">${d.difference_amount ? fmt(d.difference_amount) : '-'}</td>
      <td>${badge(d.payment_status)}</td>
      <td class="notes-cell">${d.notes || ''}</td>
    </tr>
  `).join('');

  // Summary
  const t = duties.reduce((s, d) => ({
    days: s.days + (d.total_days||0),
    emp: s.emp + (d.employer_payment||0),
    exp: s.exp + (d.expected_bl||0),
    paid: s.paid + (d.total_bl_paid||0),
    diff: s.diff + (d.difference_amount||0)
  }), { days:0, emp:0, exp:0, paid:0, diff:0 });

  tbody.innerHTML += `
    <tr class="summary-row">
      <td colspan="2"><strong>סה"כ (${duties.length} תקופות)</strong></td>
      <td class="money">${t.days}</td>
      <td colspan="3"></td>
      <td></td>
      <td class="money">${fmt(t.emp)}</td>
      <td class="money">${fmt(t.exp)}</td>
      <td class="money money-positive">${fmt(t.paid)}</td>
      <td class="money">${fmt(t.diff)}</td>
      <td colspan="2"></td>
    </tr>`;
}

// ===== BL PAYMENTS =====

async function loadBLFilters() {
  const emps = await api('/employees');
  const es = document.getElementById('blEmployeeFilter');
  es.innerHTML = '<option value="">כל העובדים</option>';
  emps.forEach(e => { const o = document.createElement('option'); o.value = e.id; o.textContent = e.full_name || `${e.first_name} ${e.last_name}`; es.appendChild(o); });
}

async function loadBLPayments() {
  let p = [];
  const ef = document.getElementById('blEmployeeFilter');
  if (ef && ef.value) p.push(`employee_id=${ef.value}`);
  const q = p.length ? '?' + p.join('&') : '';

  const payments = await api('/bl-payments' + q);
  const tbody = document.getElementById('blPaymentsBody');

  if (!payments.length) { tbody.innerHTML = '<tr><td colspan="9" class="empty-text">אין תשלומים</td></tr>'; return; }

  tbody.innerHTML = payments.map(p => `
    <tr>
      <td><strong>${p.employee_name}</strong></td>
      <td>${fmtDate(p.start_date)}${p.end_date && p.end_date !== p.start_date ? ' - ' + fmtDate(p.end_date) : ''}</td>
      <td class="money">${fmt(p.tagmul)}</td>
      <td class="money">${fmt(p.compensation_20)}</td>
      <td class="money">${fmt(p.supplement_40)}</td>
      <td class="money money-positive">${fmt(p.total_to_employee)}</td>
      <td>${p.batch_number || '-'}</td>
      <td>${fmtDate(p.payment_date)}</td>
      <td>${p.source_file || '-'}</td>
    </tr>
  `).join('');

  const t = payments.reduce((s, p) => ({
    tag: s.tag + (p.tagmul||0),
    c20: s.c20 + (p.compensation_20||0),
    s40: s.s40 + (p.supplement_40||0),
    total: s.total + (p.total_to_employee||0)
  }), { tag:0, c20:0, s40:0, total:0 });

  tbody.innerHTML += `
    <tr class="summary-row">
      <td colspan="2"><strong>סה"כ (${payments.length} תשלומים)</strong></td>
      <td class="money">${fmt(t.tag)}</td>
      <td class="money">${fmt(t.c20)}</td>
      <td class="money">${fmt(t.s40)}</td>
      <td class="money money-positive">${fmt(t.total)}</td>
      <td colspan="3"></td>
    </tr>`;
}

// ===== IMPORT =====

function setupImport() {
  document.querySelectorAll('.upload-box').forEach(box => {
    const input = box.querySelector('.file-input');
    const type = input.dataset.type;

    box.addEventListener('click', () => input.click());
    ['dragenter','dragover'].forEach(e => box.addEventListener(e, ev => { ev.preventDefault(); box.classList.add('dragover'); }));
    ['dragleave','drop'].forEach(e => box.addEventListener(e, ev => { ev.preventDefault(); box.classList.remove('dragover'); }));
    box.addEventListener('drop', ev => { if (ev.dataTransfer.files.length) processImportFile(ev.dataTransfer.files[0], type); });
    input.addEventListener('change', ev => { if (ev.target.files.length) processImportFile(ev.target.files[0], type); });
  });
}

function parseExcelDate(val) {
  if (!val) return null;
  if (typeof val === 'string') {
    // dd.mm.yyyy or dd/mm/yyyy
    const m = val.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
    // mm/dd/yyyy (try Israeli dd/mm/yyyy)
    const m2 = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m2) return `${m2[3]}-${m2[2].padStart(2,'0')}-${m2[1].padStart(2,'0')}`;
    if (/^\d{4}-\d{2}-\d{2}/.test(val)) return val.substring(0,10);
    return null;
  }
  if (typeof val === 'number') {
    const d = new Date((val - 25569) * 86400 * 1000);
    return d.toISOString().split('T')[0];
  }
  return null;
}

async function processImportFile(file, type) {
  toast('מעבד קובץ...', 'info');
  try {
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json(sheet);

    if (!raw.length) { toast('הקובץ ריק', 'error'); return; }

    if (type === 'mecano') {
      const processed = processMecano(raw);
      pendingImport = { type: 'mecano', data: processed, raw };
      showMecanoPreview(processed, raw.length);
    } else if (type === 'bl') {
      const processed = processBL(raw);
      pendingImport = { type: 'bl', data: processed, raw };
      showBLPreview(processed, raw.length);
    }
  } catch (err) {
    toast('שגיאה: ' + err.message, 'error');
  }
}

function processMecano(rows) {
  return rows.filter(row => {
    const name = row['שם עובד'] || '';
    const date = row['תאריך'] || row['date'] || '';
    const mil = row['מילואים'];
    if (!name || !date) return false;
    if (mil !== undefined && mil != 1 && mil !== '1' && mil !== '1.0' && mil !== true) return false;
    return true;
  }).map(row => {
    const date = parseExcelDate(row['תאריך'] || row['date']);
    return {
      name: (row['שם עובד'] || '').trim(),
      date: date,
      department: (row['מחלקה'] || '').trim(),
      tz: row['ת.ז'] ? String(row['ת.ז']).trim() : ''
    };
  }).filter(r => r.date);
}

function processBL(rows) {
  return rows.filter(row => {
    const tz = row['ת.ז.'] || row['ת.ז'] || '';
    const total = row['סה"כ לעובד ₪'] || row['סה"כ לעובד'] || 0;
    return tz && total;
  }).map(row => ({
    tz: String(row['ת.ז.'] || row['ת.ז'] || '').trim(),
    start_date: parseExcelDate(row['תאריך התחלה']) || '',
    end_date: parseExcelDate(row['תאריך סיום']) || '',
    payment_type: (row['סוג תשלום'] || 'רגיל').trim(),
    tagmul: parseFloat(row['תגמול ₪'] || 0),
    compensation_20: parseFloat(row['פיצוי 20% ₪'] || 0),
    supplement_40: parseFloat(row['תוספת 40% ₪'] || 0),
    total_to_employee: parseFloat(row['סה"כ לעובד ₪'] || row['סה"כ לעובד'] || 0),
    batch_number: String(row['מספר מנה'] || '').trim(),
    payment_date: parseExcelDate(row['תאריך תשלום']) || '',
    source_file: (row['קובץ מקור'] || '').trim()
  }));
}

function showMecanoPreview(data, rawCount) {
  document.getElementById('previewTitle').textContent = 'תצוגה מקדימה - מקאנו';
  const unique = new Set(data.map(d => d.name));
  document.getElementById('previewStats').innerHTML = `
    <div class="preview-stat">שורות בקובץ: <strong>${rawCount}</strong></div>
    <div class="preview-stat">שורות תקינות: <strong>${data.length}</strong></div>
    <div class="preview-stat">עובדים: <strong>${unique.size}</strong></div>
  `;
  document.getElementById('previewHeader').innerHTML = '<th>שם עובד</th><th>תאריך</th><th>מחלקה</th><th>ת.ז.</th>';
  document.getElementById('previewBody').innerHTML = data.slice(0, 20).map(r =>
    `<tr><td>${r.name}</td><td>${fmtDate(r.date)}</td><td>${r.department}</td><td>${r.tz || '-'}</td></tr>`
  ).join('') + (data.length > 20 ? `<tr><td colspan="4" class="empty-text">...ועוד ${data.length - 20} שורות</td></tr>` : '');
  document.getElementById('importWarnings').innerHTML = '';
  document.getElementById('importPreview').style.display = 'block';
}

function showBLPreview(data, rawCount) {
  document.getElementById('previewTitle').textContent = 'תצוגה מקדימה - תשלומי ב"ל';
  const total = data.reduce((s, r) => s + r.total_to_employee, 0);
  document.getElementById('previewStats').innerHTML = `
    <div class="preview-stat">שורות בקובץ: <strong>${rawCount}</strong></div>
    <div class="preview-stat">תשלומים תקינים: <strong>${data.length}</strong></div>
    <div class="preview-stat">סה"כ: <strong>${fmt(total)}</strong></div>
  `;
  document.getElementById('previewHeader').innerHTML = '<th>ת.ז.</th><th>תאריכים</th><th>תגמול</th><th>סה"כ לעובד</th><th>מנה</th>';
  document.getElementById('previewBody').innerHTML = data.slice(0, 20).map(r =>
    `<tr><td>${r.tz}</td><td>${fmtDate(r.start_date)} - ${fmtDate(r.end_date)}</td><td>${fmt(r.tagmul)}</td><td>${fmt(r.total_to_employee)}</td><td>${r.batch_number}</td></tr>`
  ).join('') + (data.length > 20 ? `<tr><td colspan="5" class="empty-text">...ועוד ${data.length - 20} שורות</td></tr>` : '');
  document.getElementById('importWarnings').innerHTML = '';
  document.getElementById('importPreview').style.display = 'block';
}

async function confirmImport() {
  if (!pendingImport) return;
  try {
    const endpoint = pendingImport.type === 'mecano' ? '/import/mecano' : '/import/bl';
    const result = await api(endpoint, { method: 'POST', body: { data: pendingImport.data } });

    if (pendingImport.type === 'mecano') {
      let msg = `יובאו ${result.dutiesCreated} תקופות (${result.matched} שורות תואמות)`;
      if (result.unmatched > 0) {
        msg += ` | ${result.unmatched} שורות לא תואמו`;
        const warnings = document.getElementById('importWarnings');
        warnings.innerHTML = `<div class="alert alert-warning">עובדים לא מזוהים: ${result.unmatchedNames.join(', ')}</div>`;
      }
      toast(msg, result.unmatched > 0 ? 'info' : 'success');
    } else {
      toast(`יובאו ${result.imported} תשלומי ב"ל`, 'success');
      if (result.errors.length) {
        document.getElementById('importWarnings').innerHTML = result.errors.map(e =>
          `<div class="alert alert-warning">${e}</div>`
        ).join('');
      }
    }

    if (!result.errors || !result.errors.length) {
      cancelImport();
    }
    loadYears();
  } catch (err) {
    toast('שגיאה: ' + err.message, 'error');
  }
}

function cancelImport() {
  pendingImport = null;
  document.getElementById('importPreview').style.display = 'none';
  document.querySelectorAll('.file-input').forEach(i => i.value = '');
}

// ===== INIT =====

document.addEventListener('DOMContentLoaded', async () => {
  setupImport();
  await loadYears();
  loadDashboard();
});
