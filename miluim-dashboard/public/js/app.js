// ===== CONFIG =====
const API = window.location.origin + '/api';
let currentYear = null;
let pendingImportData = null;

// ===== HELPERS =====

async function api(path, options = {}) {
  const res = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  return res.json();
}

function formatMoney(amount) {
  if (amount == null || isNaN(amount)) return '0';
  return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', minimumFractionDigits: 0 }).format(amount);
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString('he-IL');
}

const MONTH_NAMES = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

function monthLabel(year, month) {
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

function toast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

function statusBadge(status) {
  const labels = { paid: 'שולם', partial: 'חלקי', pending: 'ממתין' };
  return `<span class="badge badge-${status}">${labels[status] || status}</span>`;
}

// ===== TABS =====

function switchTab(tabName) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  const panel = document.getElementById('tab-' + tabName);
  if (panel) panel.classList.add('active');

  const btn = document.querySelector(`.nav-btn[data-tab="${tabName}"]`);
  if (btn) btn.classList.add('active');

  // Load data for tab
  if (tabName === 'dashboard') loadDashboard();
  if (tabName === 'employees') loadEmployees();
  if (tabName === 'duties') { loadDutyFilters(); loadDuties(); }
  if (tabName === 'payments') loadPayments();
}

// ===== YEAR SELECTOR =====

async function loadYears() {
  const years = await api('/years');
  const select = document.getElementById('yearSelect');
  select.innerHTML = '<option value="">כל השנים</option>';
  years.forEach(y => {
    const opt = document.createElement('option');
    opt.value = y;
    opt.textContent = y;
    select.appendChild(opt);
  });

  // Default to current year if available
  const thisYear = new Date().getFullYear();
  if (years.includes(thisYear)) {
    select.value = thisYear;
    currentYear = thisYear;
  }
}

function onYearChange() {
  const val = document.getElementById('yearSelect').value;
  currentYear = val ? parseInt(val) : null;
  // Refresh current tab
  const activeTab = document.querySelector('.nav-btn.active');
  if (activeTab) {
    switchTab(activeTab.dataset.tab);
  }
}

// ===== DASHBOARD =====

async function loadDashboard() {
  const yearParam = currentYear ? `?year=${currentYear}` : '';
  const stats = await api('/stats' + yearParam);

  document.getElementById('statEmployees').textContent = stats.totalEmployees;
  document.getElementById('statDays').textContent = stats.totalDays;
  document.getElementById('statExpected').textContent = formatMoney(stats.totalExpected);
  document.getElementById('statPaid').textContent = formatMoney(stats.totalPaid);
  document.getElementById('statBalance').textContent = formatMoney(stats.balance);
  document.getElementById('statPending').textContent = stats.pendingCount;

  // Color the balance card
  const balanceCard = document.getElementById('balanceCard');
  balanceCard.classList.remove('success', 'error', 'warning');
  if (stats.balance === 0 && stats.totalExpected > 0) {
    balanceCard.classList.add('success');
  } else if (stats.balance > 0) {
    balanceCard.classList.add('error');
  }

  // Alerts
  const alertsEl = document.getElementById('dashboardAlerts');
  alertsEl.innerHTML = '';
  if (stats.pendingCount > 0) {
    alertsEl.innerHTML += `<div class="alert alert-warning">יש ${stats.pendingCount} רשומות שירות שעדיין לא שולמו במלואן</div>`;
  }
  if (stats.balance > 5000) {
    alertsEl.innerHTML += `<div class="alert alert-error">יתרה לגבייה: ${formatMoney(stats.balance)} - כדאי לבדוק מול ביטוח לאומי</div>`;
  }

  // Monthly summary
  await loadMonthlySummary();
}

async function loadMonthlySummary() {
  const yearParam = currentYear ? `?year=${currentYear}` : '';
  const duties = await api('/duties' + yearParam);

  const container = document.getElementById('monthlySummary');

  if (duties.length === 0) {
    container.innerHTML = '<p class="empty-text">יש לייבא נתונים כדי לראות סיכום</p>';
    return;
  }

  // Group by month
  const byMonth = {};
  duties.forEach(d => {
    const key = `${d.year}-${String(d.month).padStart(2, '0')}`;
    if (!byMonth[key]) {
      byMonth[key] = { year: d.year, month: d.month, duties: [], totalDays: 0, totalExpected: 0, totalPaid: 0 };
    }
    byMonth[key].duties.push(d);
    byMonth[key].totalDays += d.total_days || 0;
    byMonth[key].totalExpected += d.expected_amount || 0;
    byMonth[key].totalPaid += d.total_paid || 0;
  });

  const sorted = Object.values(byMonth).sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.month - a.month;
  });

  container.innerHTML = sorted.map(m => {
    const balance = m.totalExpected - m.totalPaid;
    const paidPct = m.totalExpected > 0 ? Math.round(m.totalPaid / m.totalExpected * 100) : 0;
    const statusColor = paidPct >= 100 ? 'var(--success)' : paidPct > 0 ? 'var(--warning)' : 'var(--error)';

    return `
      <div class="month-card" style="border-right-color: ${statusColor}">
        <div class="month-card-title">${monthLabel(m.year, m.month)}</div>
        <div class="month-card-row"><span>עובדים:</span> <strong>${m.duties.length}</strong></div>
        <div class="month-card-row"><span>ימים:</span> <strong>${m.totalDays}</strong></div>
        <div class="month-card-row"><span>צפוי:</span> <strong>${formatMoney(m.totalExpected)}</strong></div>
        <div class="month-card-row"><span>שולם:</span> <strong style="color:${statusColor}">${formatMoney(m.totalPaid)} (${paidPct}%)</strong></div>
        ${balance > 0 ? `<div class="month-card-row"><span>יתרה:</span> <strong style="color:var(--error)">${formatMoney(balance)}</strong></div>` : ''}
      </div>
    `;
  }).join('');
}

// ===== IMPORT =====

function setupFileUpload() {
  const uploadBox = document.getElementById('uploadBox');
  const fileInput = document.getElementById('fileInput');

  uploadBox.addEventListener('click', () => fileInput.click());

  ['dragenter', 'dragover'].forEach(e => {
    uploadBox.addEventListener(e, ev => { ev.preventDefault(); uploadBox.classList.add('dragover'); });
  });
  ['dragleave', 'drop'].forEach(e => {
    uploadBox.addEventListener(e, ev => { ev.preventDefault(); uploadBox.classList.remove('dragover'); });
  });

  uploadBox.addEventListener('drop', ev => {
    const files = ev.dataTransfer.files;
    if (files.length) processFile(files[0]);
  });

  fileInput.addEventListener('change', ev => {
    if (ev.target.files.length) processFile(ev.target.files[0]);
  });
}

async function processFile(file) {
  toast('מעבד קובץ...', 'info');

  try {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json(sheet);

    if (raw.length === 0) {
      toast('הקובץ ריק', 'error');
      return;
    }

    // Process and group the data
    const processed = processKanoData(raw);

    if (processed.length === 0) {
      toast('לא נמצאו נתונים תקינים', 'error');
      return;
    }

    // Show preview
    pendingImportData = processed;
    showImportPreview(processed, raw.length);

  } catch (err) {
    toast('שגיאה בעיבוד הקובץ: ' + err.message, 'error');
  }
}

function parseExcelDate(val) {
  if (!val) return null;

  // Already ISO format
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) return val;

  // Hebrew format: dd.mm.yyyy
  if (typeof val === 'string' && val.includes('.')) {
    const parts = val.trim().split('.');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }

  // US format: mm/dd/yyyy or dd/mm/yyyy
  if (typeof val === 'string' && val.includes('/')) {
    const parts = val.split('/');
    if (parts.length === 3) {
      // Assume dd/mm/yyyy for Israeli context
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2].length === 2 ? '20' + parts[2] : parts[2];
      return `${year}-${month}-${day}`;
    }
  }

  // Excel serial number
  if (typeof val === 'number') {
    const d = new Date((val - 25569) * 86400 * 1000);
    return d.toISOString().split('T')[0];
  }

  // Date object
  if (val instanceof Date) {
    return val.toISOString().split('T')[0];
  }

  return null;
}

function processKanoData(rows) {
  const grouped = {};

  rows.forEach(row => {
    // Skip empty rows
    const vals = Object.values(row);
    if (vals.every(v => !v || v === '')) return;

    // Extract fields - support multiple column name formats
    const fullName = row['שם עובד'] || row['שם'] || '';
    const tz = row['ת.ז.'] || row['tz'] || row['תעודת זהות'] || fullName.trim();
    const rawDate = row['תאריך'] || row['date'] || '';
    const department = row['מחלקה'] || row['department'] || '';
    const dailyRate = parseFloat(row['תעריף יומי'] || row['daily_rate'] || 0);

    const dutyDate = parseExcelDate(rawDate);
    if (!fullName || !dutyDate) return;

    // Check if marked as miluim (if column exists)
    if ('מילואים' in row && row['מילואים'] !== 1 && row['מילואים'] !== '1' && row['מילואים'] !== true) return;

    // Split name
    const nameParts = fullName.trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    // Group key: employee + year + month
    const year = parseInt(dutyDate.substring(0, 4));
    const month = parseInt(dutyDate.substring(5, 7));
    const key = `${tz}_${year}_${month}`;

    if (!grouped[key]) {
      grouped[key] = {
        tz: tz,
        first_name: firstName,
        last_name: lastName,
        department: department,
        daily_rate: dailyRate || 500,
        year: year,
        month: month,
        dates: []
      };
    }

    if (!grouped[key].dates.includes(dutyDate)) {
      grouped[key].dates.push(dutyDate);
    }
    if (dailyRate > 0 && grouped[key].daily_rate === 500) {
      grouped[key].daily_rate = dailyRate;
    }
  });

  return Object.values(grouped).map(g => ({
    ...g,
    dates: g.dates.sort(),
    total_days: g.dates.length,
    expected_amount: g.dates.length * g.daily_rate
  }));
}

function showImportPreview(data, rawCount) {
  const preview = document.getElementById('importPreview');
  const statsEl = document.getElementById('previewStats');
  const headerEl = document.getElementById('previewHeader');
  const bodyEl = document.getElementById('previewBody');

  const uniqueEmployees = new Set(data.map(d => d.tz));
  const totalDays = data.reduce((s, d) => s + d.total_days, 0);

  statsEl.innerHTML = `
    <div class="preview-stat">שורות בקובץ: <strong>${rawCount}</strong></div>
    <div class="preview-stat">עובדים: <strong>${uniqueEmployees.size}</strong></div>
    <div class="preview-stat">רשומות חודשיות: <strong>${data.length}</strong></div>
    <div class="preview-stat">ימי שירות: <strong>${totalDays}</strong></div>
  `;

  headerEl.innerHTML = '<th>עובד</th><th>ת.ז.</th><th>מחלקה</th><th>חודש</th><th>ימים</th><th>סכום צפוי</th>';

  bodyEl.innerHTML = data.map(d => `
    <tr>
      <td>${d.first_name} ${d.last_name}</td>
      <td>${d.tz}</td>
      <td>${d.department || '-'}</td>
      <td>${monthLabel(d.year, d.month)}</td>
      <td class="money">${d.total_days}</td>
      <td class="money">${formatMoney(d.expected_amount)}</td>
    </tr>
  `).join('');

  preview.style.display = 'block';
}

async function confirmImport() {
  if (!pendingImportData) return;

  try {
    const result = await api('/import', {
      method: 'POST',
      body: { data: pendingImportData }
    });

    if (result.success) {
      toast(`יובאו ${result.importedEmployees} עובדים ו-${result.importedDuties} רשומות`, 'success');
      pendingImportData = null;
      document.getElementById('importPreview').style.display = 'none';
      document.getElementById('fileInput').value = '';
      loadYears();
      loadDashboard();
    } else {
      toast('שגיאה: ' + (result.error || 'Unknown'), 'error');
    }
  } catch (err) {
    toast('שגיאה בייבוא: ' + err.message, 'error');
  }
}

function cancelImport() {
  pendingImportData = null;
  document.getElementById('importPreview').style.display = 'none';
  document.getElementById('fileInput').value = '';
}

// ===== EMPLOYEES =====

async function loadEmployees() {
  const yearParam = currentYear ? `?year=${currentYear}` : '';
  const employees = await api('/employees' + yearParam);
  const tbody = document.getElementById('employeesBody');

  if (employees.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-text">אין עובדים' + (currentYear ? ` בשנת ${currentYear}` : '') + '</td></tr>';
    return;
  }

  tbody.innerHTML = employees.map(emp => `
    <tr>
      <td><strong>${emp.first_name} ${emp.last_name}</strong></td>
      <td>${emp.tz}</td>
      <td>${emp.department || '-'}</td>
      <td class="money">${emp.total_days}</td>
      <td class="money">${formatMoney(emp.total_expected)}</td>
      <td class="money money-positive">${formatMoney(emp.total_paid)}</td>
      <td class="money ${emp.balance > 0 ? 'money-negative' : 'money-positive'}">${formatMoney(emp.balance)}</td>
      <td>
        <button class="btn btn-sm btn-danger" onclick="deleteEmployee(${emp.id})">מחק</button>
      </td>
    </tr>
  `).join('');

  // Summary row
  const totalDays = employees.reduce((s, e) => s + e.total_days, 0);
  const totalExpected = employees.reduce((s, e) => s + e.total_expected, 0);
  const totalPaid = employees.reduce((s, e) => s + e.total_paid, 0);
  const totalBalance = employees.reduce((s, e) => s + e.balance, 0);

  tbody.innerHTML += `
    <tr class="summary-row">
      <td colspan="3"><strong>סה"כ</strong></td>
      <td class="money">${totalDays}</td>
      <td class="money">${formatMoney(totalExpected)}</td>
      <td class="money money-positive">${formatMoney(totalPaid)}</td>
      <td class="money ${totalBalance > 0 ? 'money-negative' : 'money-positive'}">${formatMoney(totalBalance)}</td>
      <td></td>
    </tr>
  `;
}

function showAddEmployee() {
  document.getElementById('addEmployeeForm').style.display = 'block';
}

function hideAddEmployee() {
  document.getElementById('addEmployeeForm').style.display = 'none';
  ['empTz', 'empFirstName', 'empLastName', 'empDept'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('empRate').value = '500';
}

async function saveEmployee() {
  const tz = document.getElementById('empTz').value.trim();
  const firstName = document.getElementById('empFirstName').value.trim();
  const lastName = document.getElementById('empLastName').value.trim();
  const dept = document.getElementById('empDept').value.trim();
  const rate = parseFloat(document.getElementById('empRate').value) || 500;

  if (!tz || !firstName || !lastName) {
    toast('יש למלא ת.ז., שם פרטי ושם משפחה', 'error');
    return;
  }

  await api('/employees', { method: 'POST', body: { tz, first_name: firstName, last_name: lastName, department: dept, daily_rate: rate } });
  toast('עובד נוסף בהצלחה');
  hideAddEmployee();
  loadEmployees();
}

async function deleteEmployee(id) {
  if (!confirm('למחוק את העובד וכל הנתונים שלו?')) return;
  await api(`/employees/${id}`, { method: 'DELETE' });
  toast('עובד נמחק');
  loadEmployees();
}

// ===== DUTIES =====

async function loadDutyFilters() {
  // Load months
  if (currentYear) {
    const months = await api(`/months/${currentYear}`);
    const monthSelect = document.getElementById('dutyMonthFilter');
    monthSelect.innerHTML = '<option value="">כל החודשים</option>';
    months.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = MONTH_NAMES[m - 1];
      monthSelect.appendChild(opt);
    });
  }

  // Load employees
  const employees = await api('/employees');
  const empSelect = document.getElementById('dutyEmployeeFilter');
  empSelect.innerHTML = '<option value="">כל העובדים</option>';
  employees.forEach(emp => {
    const opt = document.createElement('option');
    opt.value = emp.id;
    opt.textContent = `${emp.first_name} ${emp.last_name}`;
    empSelect.appendChild(opt);
  });
}

async function loadDuties() {
  let params = [];
  if (currentYear) params.push(`year=${currentYear}`);

  const monthFilter = document.getElementById('dutyMonthFilter');
  if (monthFilter && monthFilter.value) params.push(`month=${monthFilter.value}`);

  const empFilter = document.getElementById('dutyEmployeeFilter');
  if (empFilter && empFilter.value) params.push(`employee_id=${empFilter.value}`);

  const query = params.length ? '?' + params.join('&') : '';
  const duties = await api('/duties' + query);
  const tbody = document.getElementById('dutiesBody');

  if (duties.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-text">אין רשומות</td></tr>';
    return;
  }

  tbody.innerHTML = duties.map(d => `
    <tr>
      <td><strong>${d.employee_name}</strong></td>
      <td>${monthLabel(d.year, d.month)}</td>
      <td class="money">${d.total_days}</td>
      <td class="money">${formatMoney(d.expected_amount)}</td>
      <td class="money money-positive">${formatMoney(d.total_paid)}</td>
      <td class="money ${d.balance > 0 ? 'money-negative' : 'money-positive'}">${formatMoney(d.balance)}</td>
      <td>${statusBadge(d.payment_status)}</td>
      <td>
        <button class="btn btn-sm btn-danger" onclick="deleteDuty(${d.id})">מחק</button>
      </td>
    </tr>
  `).join('');

  // Summary
  const totalDays = duties.reduce((s, d) => s + d.total_days, 0);
  const totalExpected = duties.reduce((s, d) => s + d.expected_amount, 0);
  const totalPaid = duties.reduce((s, d) => s + d.total_paid, 0);
  const totalBalance = duties.reduce((s, d) => s + d.balance, 0);

  tbody.innerHTML += `
    <tr class="summary-row">
      <td colspan="2"><strong>סה"כ</strong></td>
      <td class="money">${totalDays}</td>
      <td class="money">${formatMoney(totalExpected)}</td>
      <td class="money money-positive">${formatMoney(totalPaid)}</td>
      <td class="money ${totalBalance > 0 ? 'money-negative' : 'money-positive'}">${formatMoney(totalBalance)}</td>
      <td></td>
      <td></td>
    </tr>
  `;
}

async function deleteDuty(id) {
  if (!confirm('למחוק רשומת שירות זו?')) return;
  await api(`/duties/${id}`, { method: 'DELETE' });
  toast('רשומה נמחקה');
  loadDuties();
}

// ===== PAYMENTS =====

async function loadPayments() {
  const payments = await api('/payments');
  const tbody = document.getElementById('paymentsBody');

  if (payments.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-text">אין תשלומים רשומים</td></tr>';
    return;
  }

  tbody.innerHTML = payments.map(p => `
    <tr>
      <td><strong>${p.employee_name}</strong></td>
      <td>${p.duty_month || '-'}</td>
      <td class="money money-positive">${formatMoney(p.amount)}</td>
      <td>${formatDate(p.payment_date)}</td>
      <td>${p.reference || '-'}</td>
      <td>${p.notes || '-'}</td>
      <td>
        <button class="btn btn-sm btn-danger" onclick="deletePayment(${p.id})">מחק</button>
      </td>
    </tr>
  `).join('');

  // Summary
  const total = payments.reduce((s, p) => s + p.amount, 0);
  tbody.innerHTML += `
    <tr class="summary-row">
      <td colspan="2"><strong>סה"כ</strong></td>
      <td class="money money-positive">${formatMoney(total)}</td>
      <td colspan="4"></td>
    </tr>
  `;
}

function showAddPayment() {
  document.getElementById('addPaymentForm').style.display = 'block';
  loadEmployeesForPayment();
  document.getElementById('payDate').value = new Date().toISOString().split('T')[0];
}

function hideAddPayment() {
  document.getElementById('addPaymentForm').style.display = 'none';
  ['payAmount', 'payRef', 'payNotes'].forEach(id => document.getElementById(id).value = '');
}

async function loadEmployeesForPayment() {
  const employees = await api('/employees');
  const select = document.getElementById('payEmployee');
  select.innerHTML = '<option value="">בחר עובד...</option>';
  employees.forEach(emp => {
    const opt = document.createElement('option');
    opt.value = emp.id;
    opt.textContent = `${emp.first_name} ${emp.last_name}`;
    select.appendChild(opt);
  });
}

async function loadDutiesForPayment() {
  const empId = document.getElementById('payEmployee').value;
  const dutySelect = document.getElementById('payDuty');
  dutySelect.innerHTML = '<option value="">בחר חודש...</option>';

  if (!empId) return;

  const duties = await api(`/duties?employee_id=${empId}`);
  duties.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d.id;
    const balance = d.balance;
    opt.textContent = `${monthLabel(d.year, d.month)} - צפוי: ${formatMoney(d.expected_amount)} | יתרה: ${formatMoney(balance)}`;
    dutySelect.appendChild(opt);
  });
}

async function savePayment() {
  const empId = parseInt(document.getElementById('payEmployee').value);
  const dutyId = parseInt(document.getElementById('payDuty').value);
  const amount = parseFloat(document.getElementById('payAmount').value);
  const payDate = document.getElementById('payDate').value;
  const reference = document.getElementById('payRef').value.trim();
  const notes = document.getElementById('payNotes').value.trim();

  if (!empId || !dutyId || !amount || !payDate) {
    toast('יש למלא עובד, חודש, סכום ותאריך', 'error');
    return;
  }

  await api('/payments', {
    method: 'POST',
    body: { employee_id: empId, duty_id: dutyId, amount, payment_date: payDate, reference, notes }
  });

  toast('תשלום נרשם בהצלחה');
  hideAddPayment();
  loadPayments();
}

async function deletePayment(id) {
  if (!confirm('למחוק תשלום זה?')) return;
  await api(`/payments/${id}`, { method: 'DELETE' });
  toast('תשלום נמחק');
  loadPayments();
}

// ===== INIT =====

document.addEventListener('DOMContentLoaded', async () => {
  setupFileUpload();
  await loadYears();
  loadDashboard();
});
