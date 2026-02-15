// ===== ניהול טאבים =====
function switchTab(tabName) {
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));

  const content = document.getElementById(tabName);
  if (content) content.classList.add('active');

  const tab = document.querySelector(`[data-tab="${tabName}"]`);
  if (tab) tab.classList.add('active');

  // Load data for the selected tab
  if (tabName === 'employees') loadEmployees();
  else if (tabName === 'monthly') loadAvailableMonths();
  else if (tabName === 'daily') loadDailyReport();
  else if (tabName === 'payments') loadPayments();
  else if (tabName === 'reports') loadReportFilters();
}

// ===== Helper: format currency =====
function formatCurrency(amount) {
  return '\u20AA' + (amount || 0).toLocaleString('he-IL');
}

// ===== Helper: format date for display =====
function formatDate(dateStr) {
  if (!dateStr) return '-';
  const parts = dateStr.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
}

// ===== Helper: Hebrew month name =====
const MONTH_NAMES = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

function formatMonth(monthStr) {
  if (!monthStr) return '-';
  const [year, month] = monthStr.split('-');
  return `${MONTH_NAMES[parseInt(month) - 1]} ${year}`;
}

// ===== Helper: status badge =====
function statusBadge(status) {
  const labels = { paid: 'שולם', partial: 'חלקי', pending: 'ממתין', received: 'התקבל' };
  return `<span class="badge badge-${status}">${labels[status] || status}</span>`;
}

// ===== טעינת סטטיסטיקות =====
async function loadStats() {
  try {
    const response = await fetch('/api/stats');
    const stats = await response.json();

    document.getElementById('totalEmployees').textContent = stats.totalEmployees || 0;
    document.getElementById('totalDays').textContent = stats.totalDays || 0;
    document.getElementById('avgDays').textContent = stats.avgDaysPerEmployee || 0;
    document.getElementById('totalExpected').textContent = formatCurrency(stats.totalExpected);
    document.getElementById('totalReceived').textContent = formatCurrency(stats.totalReceived);
    document.getElementById('totalDifference').textContent = formatCurrency(stats.totalDifference);
  } catch (error) {
    console.error('שגיאה בטעינת סטטיסטיקות:', error);
  }
}

// ===== טעינת רשימת עובדים =====
async function loadEmployees() {
  try {
    const response = await fetch('/api/employees');
    const employees = await response.json();
    const tbody = document.getElementById('employeesTableBody');

    if (employees.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-cell">אין עובדים במערכת</td></tr>';
      return;
    }

    tbody.innerHTML = employees.map(emp => `
      <tr>
        <td>${emp.first_name} ${emp.last_name}</td>
        <td>${emp.department || '-'}</td>
        <td class="amount-cell">${emp.total_days || 0} ימים</td>
        <td>${emp.tz}</td>
        <td class="amount-cell">${formatCurrency(emp.daily_rate)}</td>
        <td>
          <button class="btn btn-sm btn-primary" onclick="showEmployeeDetails(${emp.id})">פרטים</button>
        </td>
      </tr>
    `).join('');
  } catch (error) {
    console.error('שגיאה בטעינת עובדים:', error);
  }
}

// ===== פרטי עובד =====
async function showEmployeeDetails(employeeId) {
  try {
    const response = await fetch(`/api/employees/${employeeId}`);
    const data = await response.json();

    document.getElementById('employeeModalTitle').textContent = `${data.first_name} ${data.last_name}`;

    const totalExpected = (data.duties || []).reduce((s, d) => s + (d.calculated_amount || 0), 0);
    const totalReceived = (data.payments || []).reduce((s, p) => s + (p.amount || 0), 0);

    let html = `
      <div class="employee-detail-section">
        <h4>פרטים אישיים</h4>
        <div class="detail-grid">
          <div class="detail-item"><span class="label">ת.ז.</span><span class="value">${data.tz}</span></div>
          <div class="detail-item"><span class="label">מחלקה</span><span class="value">${data.department || '-'}</span></div>
          <div class="detail-item"><span class="label">תעריף יומי</span><span class="value">${formatCurrency(data.daily_rate)}</span></div>
          <div class="detail-item"><span class="label">סה"כ ימים</span><span class="value">${data.total_days || 0}</span></div>
        </div>
      </div>

      <div class="employee-detail-section">
        <h4>סיכום כספי</h4>
        <div class="detail-grid">
          <div class="detail-item"><span class="label">סכום צפוי</span><span class="value">${formatCurrency(totalExpected)}</span></div>
          <div class="detail-item"><span class="label">סכום שהתקבל</span><span class="value">${formatCurrency(totalReceived)}</span></div>
          <div class="detail-item"><span class="label">הפרש</span><span class="value">${formatCurrency(totalExpected - totalReceived)}</span></div>
          <div class="detail-item"><span class="label">סטטוס</span><span class="value">${
            totalReceived >= totalExpected && totalExpected > 0 ? statusBadge('paid')
            : totalReceived > 0 ? statusBadge('partial')
            : statusBadge('pending')
          }</span></div>
        </div>
      </div>`;

    // Duties table
    if (data.duties && data.duties.length > 0) {
      html += `
        <div class="employee-detail-section">
          <h4>ימי מילואים (${data.duties.length} רשומות)</h4>
          <table class="mini-table">
            <thead><tr><th>תאריך</th><th>ימים</th><th>סכום</th></tr></thead>
            <tbody>
              ${data.duties.map(d => `
                <tr>
                  <td>${formatDate(d.duty_date)}</td>
                  <td>${d.days}</td>
                  <td>${formatCurrency(d.calculated_amount)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>`;
    }

    // Payments table
    if (data.payments && data.payments.length > 0) {
      html += `
        <div class="employee-detail-section">
          <h4>תשלומים (${data.payments.length} רשומות)</h4>
          <table class="mini-table">
            <thead><tr><th>תאריך</th><th>סכום</th><th>אסמכתא</th><th>הערות</th></tr></thead>
            <tbody>
              ${data.payments.map(p => `
                <tr>
                  <td>${formatDate(p.payment_date)}</td>
                  <td>${formatCurrency(p.amount)}</td>
                  <td>${p.reference || '-'}</td>
                  <td>${p.notes || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>`;
    } else {
      html += `<div class="employee-detail-section"><h4>תשלומים</h4><p style="color: var(--neutral-medium);">אין תשלומים רשומים</p></div>`;
    }

    document.getElementById('employeeModalBody').innerHTML = html;
    document.getElementById('employeeModal').style.display = 'flex';
  } catch (error) {
    console.error('שגיאה בטעינת פרטי עובד:', error);
    showMessage('שגיאה בטעינת פרטי העובד', 'error');
  }
}

function closeEmployeeModal() {
  document.getElementById('employeeModal').style.display = 'none';
}

// ===== המרת תאריך מקובץ Excel =====
function formatDateFromExcel(excelDate) {
  if (!excelDate) return null;

  // Already ISO format
  if (typeof excelDate === 'string' && excelDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return excelDate;
  }

  // Hebrew format: dd.mm.yyyy
  if (typeof excelDate === 'string' && excelDate.includes('.')) {
    const parts = excelDate.trim().split('.');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }

  // Format with slashes: could be dd/mm/yyyy or mm/dd/yyyy
  if (typeof excelDate === 'string' && excelDate.includes('/')) {
    const parts = excelDate.split('/');
    if (parts.length === 3) {
      // If first part > 12, it's dd/mm/yyyy
      if (parseInt(parts[0]) > 12) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
      // Otherwise assume mm/dd/yyyy
      return `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
    }
  }

  // Format dd-mm-yyyy
  if (typeof excelDate === 'string' && excelDate.match(/^\d{1,2}-\d{1,2}-\d{4}$/)) {
    const parts = excelDate.split('-');
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }

  // Excel serial number
  if (typeof excelDate === 'number') {
    const date = new Date((excelDate - 25569) * 86400 * 1000);
    return date.toISOString().split('T')[0];
  }

  // Date object
  if (excelDate instanceof Date) {
    return excelDate.toISOString().split('T')[0];
  }

  return null;
}

// ===== זיהוי עמודות בקובץ =====
function detectColumns(row) {
  const keys = Object.keys(row);
  const cols = {};

  for (const key of keys) {
    const k = key.trim();
    // Full name
    if (/שם\s*עובד|שם\s*מלא|employee.*name|full.*name/i.test(k)) cols.fullName = key;
    // First name
    if (/שם\s*פרטי|first.*name/i.test(k)) cols.firstName = key;
    // Last name
    if (/שם\s*משפחה|last.*name/i.test(k)) cols.lastName = key;
    // ID
    if (/ת\.?ז\.?|תעודת\s*זהות|מספר\s*זהות|id.*number|tz/i.test(k)) cols.tz = key;
    // Date
    if (/תאריך|date/i.test(k)) cols.date = key;
    // Days
    if (/ימים|days|מספר\s*ימים/i.test(k)) cols.days = key;
    // Department
    if (/מחלקה|department|יחידה/i.test(k)) cols.department = key;
    // Daily rate
    if (/תעריף|rate|שכר\s*יומי/i.test(k)) cols.dailyRate = key;
    // Is miluim
    if (/מילואים|miluim|reserve/i.test(k)) cols.isMiluim = key;
  }

  return cols;
}

// ===== עיבוד נתוני קאנו =====
function processKanoData(data) {
  if (!data || data.length === 0) return [];

  // Detect column mapping from first row
  const cols = detectColumns(data[0]);

  // Group by employee and month
  const grouped = {};
  let employeeCounter = 0;

  data.forEach((row) => {
    // Skip empty rows
    const values = Object.values(row);
    if (values.every(val => !val || val === '')) return;

    // Check miluim filter (if column exists)
    if (cols.isMiluim) {
      const val = row[cols.isMiluim];
      if (val !== 1 && val !== '1' && val !== true && val !== 'כן') return;
    }

    // Extract name
    let firstName = '', lastName = '', fullName = '';
    if (cols.fullName) {
      fullName = String(row[cols.fullName] || '').trim();
      const parts = fullName.split(/\s+/);
      firstName = parts[0] || '';
      lastName = parts.slice(1).join(' ') || firstName;
    } else if (cols.firstName || cols.lastName) {
      firstName = String(row[cols.firstName] || '').trim();
      lastName = String(row[cols.lastName] || '').trim();
      fullName = `${firstName} ${lastName}`.trim();
    }

    if (!fullName) return;

    // Extract TZ (use name as fallback identifier)
    let tz = '';
    if (cols.tz) {
      tz = String(row[cols.tz] || '').trim();
    }
    if (!tz) {
      tz = fullName; // Use name as unique identifier when no TZ
    }

    // Extract date
    const dutyDate = formatDateFromExcel(cols.date ? row[cols.date] : null);

    // Extract other fields
    const department = cols.department ? String(row[cols.department] || '').trim() : '';
    const dailyRate = cols.dailyRate ? parseFloat(row[cols.dailyRate]) || 500 : 500;

    // Determine days - if column exists use it, otherwise count as 1 day per row
    let days = 1;
    if (cols.days) {
      days = parseInt(row[cols.days]) || 1;
    }

    // Create grouping key: employee + month
    const monthKey = dutyDate ? dutyDate.substring(0, 7) : 'unknown';
    const combinedKey = `${tz}_${monthKey}`;

    if (!grouped[combinedKey]) {
      grouped[combinedKey] = {
        tz,
        first_name: firstName,
        last_name: lastName,
        department,
        daily_rate: dailyRate,
        month: monthKey,
        days: 0,
        dates: []
      };
    }

    grouped[combinedKey].days += days;
    if (dutyDate) grouped[combinedKey].dates.push(dutyDate);
  });

  // Convert to array
  const processed = Object.values(grouped).map(item => {
    const representativeDate = item.dates.length > 0 ? item.dates.sort()[0] : null;
    return {
      tz: item.tz,
      last_name: item.last_name,
      first_name: item.first_name,
      duty_date: representativeDate,
      days: item.days,
      daily_rate: item.daily_rate,
      department: item.department
    };
  }).filter(item => item.duty_date); // Only include items with valid dates

  const uniqueEmployees = [...new Set(processed.map(p => p.tz))];
  console.log(`עיבוד הושלם: ${processed.length} רשומות, ${uniqueEmployees.length} עובדים`);

  return processed;
}

// ===== העלאת קובץ =====
async function handleFileUpload(event) {
  const file = event.target.files ? event.target.files[0] : null;
  if (!file) return;

  showMessage('מעבד קובץ...', 'info');

  try {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(firstSheet);

    console.log(`נתונים גולמיים: ${jsonData.length} שורות`);

    const processedData = processKanoData(jsonData);

    if (processedData.length === 0) {
      showMessage('לא נמצאו נתונים תקינים בקובץ', 'error');
      return;
    }

    const response = await fetch('/api/import-kano', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: processedData })
    });

    const result = await response.json();

    if (result.success) {
      showMessage(result.message, 'success');
      loadStats();
    } else {
      showMessage('שגיאה בייבוא: ' + result.error, 'error');
    }
  } catch (error) {
    console.error('שגיאה בעיבוד הקובץ:', error);
    showMessage('שגיאה בעיבוד הקובץ: ' + error.message, 'error');
  }

  // Reset file input
  document.getElementById('fileInput').value = '';
}

// ===== הצגת הודעה =====
function showMessage(text, type) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${type || 'info'}`;
  messageDiv.textContent = text;

  const container = document.querySelector('.content');
  container.insertBefore(messageDiv, container.firstChild);

  setTimeout(() => messageDiv.remove(), 5000);
}

// ===== Drag & Drop =====
function setupDragDrop() {
  const uploadArea = document.getElementById('uploadArea');
  if (!uploadArea) return;

  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(e => {
    uploadArea.addEventListener(e, ev => { ev.preventDefault(); ev.stopPropagation(); }, false);
  });

  ['dragenter', 'dragover'].forEach(e => {
    uploadArea.addEventListener(e, () => uploadArea.classList.add('dragover'), false);
  });

  ['dragleave', 'drop'].forEach(e => {
    uploadArea.addEventListener(e, () => uploadArea.classList.remove('dragover'), false);
  });

  uploadArea.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      document.getElementById('fileInput').files = files;
      handleFileUpload({ target: { files: files } });
    }
  }, false);
}

// ===== טעינת חודשים זמינים =====
async function loadAvailableMonths() {
  try {
    const response = await fetch('/api/available-months');
    const months = await response.json();

    const select = document.getElementById('monthSelect');
    select.innerHTML = '<option value="">בחר חודש...</option>';

    months.forEach(month => {
      const option = document.createElement('option');
      option.value = month;
      option.textContent = formatMonth(month);
      select.appendChild(option);
    });
  } catch (error) {
    console.error('שגיאה בטעינת חודשים:', error);
  }
}

// ===== דוח חודשי =====
async function loadMonthlyReport() {
  const month = document.getElementById('monthSelect').value;
  if (!month) return;

  try {
    const response = await fetch(`/api/monthly-report/${month}`);
    const report = await response.json();
    const tbody = document.getElementById('monthlyReportBody');

    if (report.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-cell">אין נתונים לחודש זה</td></tr>';
      return;
    }

    tbody.innerHTML = report.map(item => `
      <tr>
        <td>${formatDate(item.duty_date)}</td>
        <td>${item.employee_name}</td>
        <td>${item.tz}</td>
        <td>${item.department || '-'}</td>
        <td class="amount-cell">${item.days} ימים</td>
        <td class="amount-cell">${formatCurrency(item.calculated_amount)}</td>
      </tr>
    `).join('');

    // Summary row
    const totalDays = report.reduce((s, i) => s + (i.days || 0), 0);
    const totalAmount = report.reduce((s, i) => s + (i.calculated_amount || 0), 0);

    tbody.innerHTML += `
      <tr class="summary-row">
        <td colspan="4">סה"כ</td>
        <td class="amount-cell">${totalDays} ימים</td>
        <td class="amount-cell">${formatCurrency(totalAmount)}</td>
      </tr>`;
  } catch (error) {
    console.error('שגיאה בטעינת דוח חודשי:', error);
    showMessage('שגיאה בטעינת הדוח', 'error');
  }
}

// ===== דוח יומי =====
async function loadDailyReport() {
  try {
    const from = document.getElementById('dailyFrom').value;
    const to = document.getElementById('dailyTo').value;

    let url = '/api/daily-report';
    const params = [];
    if (from) params.push(`from=${from}`);
    if (to) params.push(`to=${to}`);
    if (params.length > 0) url += '?' + params.join('&');

    const response = await fetch(url);
    const report = await response.json();
    const tbody = document.getElementById('dailyReportBody');

    if (report.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-cell">אין נתונים להצגה</td></tr>';
      return;
    }

    tbody.innerHTML = report.map(item => `
      <tr>
        <td>${formatDate(item.duty_date)}</td>
        <td>${item.employee_name}</td>
        <td>${item.department || '-'}</td>
        <td class="amount-cell">${item.days}</td>
        <td class="amount-cell">${formatCurrency(item.daily_rate)}</td>
        <td class="amount-cell">${formatCurrency(item.calculated_amount)}</td>
      </tr>
    `).join('');

    // Summary
    const totalDays = report.reduce((s, i) => s + (i.days || 0), 0);
    const totalAmount = report.reduce((s, i) => s + (i.calculated_amount || 0), 0);

    tbody.innerHTML += `
      <tr class="summary-row">
        <td colspan="3">סה"כ</td>
        <td class="amount-cell">${totalDays}</td>
        <td></td>
        <td class="amount-cell">${formatCurrency(totalAmount)}</td>
      </tr>`;
  } catch (error) {
    console.error('שגיאה בטעינת דוח יומי:', error);
    showMessage('שגיאה בטעינת הדוח', 'error');
  }
}

function clearDailyFilters() {
  document.getElementById('dailyFrom').value = '';
  document.getElementById('dailyTo').value = '';
  loadDailyReport();
}

// ===== תשלומים =====
async function loadPayments() {
  try {
    const response = await fetch('/api/payments');
    const payments = await response.json();
    const tbody = document.getElementById('paymentsTableBody');

    if (payments.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty-cell">אין תשלומים רשומים. לחץ "+ הוסף תשלום" להתחיל.</td></tr>';
      return;
    }

    tbody.innerHTML = payments.map(p => `
      <tr>
        <td>${formatDate(p.payment_date)}</td>
        <td>${p.employee_name}</td>
        <td>${p.month ? formatMonth(p.month) : '-'}</td>
        <td class="amount-cell">${formatCurrency(p.amount)}</td>
        <td>${p.reference || '-'}</td>
        <td>${p.notes || '-'}</td>
        <td>${statusBadge(p.status)}</td>
        <td>
          <button class="btn btn-sm btn-danger" onclick="deletePayment(${p.id})">מחק</button>
        </td>
      </tr>
    `).join('');

    // Summary
    const total = payments.reduce((s, p) => s + (p.amount || 0), 0);
    tbody.innerHTML += `
      <tr class="summary-row">
        <td colspan="3">סה"כ (${payments.length} תשלומים)</td>
        <td class="amount-cell">${formatCurrency(total)}</td>
        <td colspan="4"></td>
      </tr>`;
  } catch (error) {
    console.error('שגיאה בטעינת תשלומים:', error);
  }
}

async function showAddPaymentModal() {
  // Load employees for dropdown
  try {
    const response = await fetch('/api/employees');
    const employees = await response.json();

    const select = document.getElementById('paymentEmployee');
    select.innerHTML = '<option value="">בחר עובד...</option>';
    employees.forEach(emp => {
      select.innerHTML += `<option value="${emp.id}">${emp.first_name} ${emp.last_name}</option>`;
    });
  } catch (error) {
    console.error('שגיאה בטעינת עובדים:', error);
  }

  // Set default date to today
  document.getElementById('paymentDate').value = new Date().toISOString().split('T')[0];

  // Clear form
  document.getElementById('paymentAmount').value = '';
  document.getElementById('paymentMonth').value = '';
  document.getElementById('paymentReference').value = '';
  document.getElementById('paymentNotes').value = '';

  document.getElementById('paymentModal').style.display = 'flex';
}

function closePaymentModal() {
  document.getElementById('paymentModal').style.display = 'none';
}

async function savePayment() {
  const employee_id = document.getElementById('paymentEmployee').value;
  const month = document.getElementById('paymentMonth').value;
  const amount = document.getElementById('paymentAmount').value;
  const payment_date = document.getElementById('paymentDate').value;
  const reference = document.getElementById('paymentReference').value;
  const notes = document.getElementById('paymentNotes').value;

  if (!employee_id || !amount || !payment_date) {
    showMessage('נא למלא שדות חובה: עובד, סכום, תאריך', 'warning');
    return;
  }

  try {
    const response = await fetch('/api/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employee_id, month, amount, payment_date, reference, notes })
    });

    const result = await response.json();
    if (result.success) {
      showMessage('התשלום נוסף בהצלחה', 'success');
      closePaymentModal();
      loadPayments();
      loadStats();
    } else {
      showMessage('שגיאה: ' + result.error, 'error');
    }
  } catch (error) {
    console.error('שגיאה בשמירת תשלום:', error);
    showMessage('שגיאה בשמירת התשלום', 'error');
  }
}

async function deletePayment(id) {
  if (!confirm('האם למחוק את התשלום?')) return;

  try {
    const response = await fetch(`/api/payments/${id}`, { method: 'DELETE' });
    const result = await response.json();
    if (result.success) {
      showMessage('התשלום נמחק', 'success');
      loadPayments();
      loadStats();
    }
  } catch (error) {
    console.error('שגיאה במחיקת תשלום:', error);
  }
}

// ===== דוחות ומעקב =====
async function loadReportFilters() {
  try {
    // Load employees
    const empResponse = await fetch('/api/employees');
    const employees = await empResponse.json();

    const empSelect = document.getElementById('reportEmployee');
    empSelect.innerHTML = '<option value="">כל העובדים</option>';
    employees.forEach(emp => {
      empSelect.innerHTML += `<option value="${emp.id}">${emp.first_name} ${emp.last_name}</option>`;
    });

    // Load departments
    const deptResponse = await fetch('/api/departments');
    const departments = await deptResponse.json();

    const deptSelect = document.getElementById('reportDepartment');
    deptSelect.innerHTML = '<option value="">כל המחלקות</option>';
    departments.forEach(dept => {
      deptSelect.innerHTML += `<option value="${dept}">${dept}</option>`;
    });
  } catch (error) {
    console.error('שגיאה בטעינת פילטרים:', error);
  }
}

async function loadComprehensiveReport() {
  try {
    const employeeId = document.getElementById('reportEmployee').value;
    const department = document.getElementById('reportDepartment').value;
    const status = document.getElementById('reportStatus').value;

    const params = [];
    if (employeeId) params.push(`employeeId=${employeeId}`);
    if (department) params.push(`department=${encodeURIComponent(department)}`);
    if (status) params.push(`status=${status}`);

    const url = '/api/comprehensive-report' + (params.length > 0 ? '?' + params.join('&') : '');
    const response = await fetch(url);
    const report = await response.json();
    const tbody = document.getElementById('comprehensiveReportBody');

    if (report.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" class="empty-cell">אין נתונים להצגה</td></tr>';
      return;
    }

    tbody.innerHTML = report.map(item => `
      <tr>
        <td>${item.employee_name}</td>
        <td>${item.tz}</td>
        <td>${item.department || '-'}</td>
        <td class="amount-cell">${item.total_days}</td>
        <td class="amount-cell">${formatCurrency(item.total_expected)}</td>
        <td class="amount-cell">${formatCurrency(item.total_received)}</td>
        <td class="amount-cell" style="color: ${item.difference > 0 ? 'var(--status-error)' : 'var(--status-success)'}">${formatCurrency(item.difference)}</td>
        <td>${statusBadge(item.status)}</td>
        <td>
          <button class="btn btn-sm btn-primary" onclick="showEmployeeDetails(${item.employee_id})">פרטים</button>
        </td>
      </tr>
    `).join('');

    // Summary
    const totalDays = report.reduce((s, i) => s + i.total_days, 0);
    const totalExpected = report.reduce((s, i) => s + i.total_expected, 0);
    const totalReceived = report.reduce((s, i) => s + i.total_received, 0);
    const totalDiff = totalExpected - totalReceived;

    tbody.innerHTML += `
      <tr class="summary-row">
        <td colspan="3">סה"כ (${report.length} עובדים)</td>
        <td class="amount-cell">${totalDays}</td>
        <td class="amount-cell">${formatCurrency(totalExpected)}</td>
        <td class="amount-cell">${formatCurrency(totalReceived)}</td>
        <td class="amount-cell">${formatCurrency(totalDiff)}</td>
        <td colspan="2"></td>
      </tr>`;
  } catch (error) {
    console.error('שגיאה בטעינת דוח כולל:', error);
    showMessage('שגיאה בטעינת הדוח', 'error');
  }
}

// ===== אתחול =====
document.addEventListener('DOMContentLoaded', () => {
  // Load dashboard stats
  loadStats();

  // Setup drag & drop
  setupDragDrop();

  // File input handler
  document.getElementById('fileInput').addEventListener('change', handleFileUpload);

  // Tab click handlers
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', function() {
      switchTab(this.getAttribute('data-tab'));
    });
  });

  // Upload area click
  const uploadArea = document.getElementById('uploadArea');
  if (uploadArea) {
    uploadArea.addEventListener('click', () => document.getElementById('fileInput').click());
  }

  // Month select change
  const monthSelect = document.getElementById('monthSelect');
  if (monthSelect) {
    monthSelect.addEventListener('change', loadMonthlyReport);
  }

  // Close modals on backdrop click
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.style.display = 'none';
    });
  });

  console.log('המערכת מוכנה');
});
