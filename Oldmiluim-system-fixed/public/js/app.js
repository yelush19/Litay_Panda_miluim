// ============ קונפיגורציה ============
const API_URL = 'http://localhost:3000/api';

// ============ מצב אפליקציה ============
let currentTab = 'dashboard';
let employees = [];
let payments = [];

// ============ אתחול ============
document.addEventListener('DOMContentLoaded', function() {
    setupDropZone();
    loadStats();
    loadEmployees();
    loadPayments();
    loadAvailableMonths();
    setupModalCloseOnOutsideClick();
});

// ============ ניהול טאבים ============
function showTab(tabName) {
    // הסתרת כל הטאבים
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.add('hidden');
    });
    
    // הסרת active מכל הכפתורים
    document.querySelectorAll('.tab').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // הצגת הטאב הנבחר
    document.getElementById(`tab-${tabName}`).classList.remove('hidden');
    event.target.classList.add('active');
    
    currentTab = tabName;
    
    // רענון נתונים
    if (tabName === 'dashboard') {
        loadStats();
        loadDashboardEmployees();
    } else if (tabName === 'employees') {
        loadEmployees();
    } else if (tabName === 'monthly') {
        loadAvailableMonths();
    } else if (tabName === 'payments') {
        loadPayments();
    }
}

// ============ הודעות ============
function showMessage(text, type = 'success') {
    const messageEl = document.getElementById('message');
    messageEl.textContent = text;
    messageEl.className = `message message-${type} show`;
    
    setTimeout(() => {
        messageEl.classList.remove('show');
    }, 3000);
}

// ============ מודלים ============
function openModal(modalId) {
    document.getElementById(modalId).classList.add('show');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('show');
}

function setupModalCloseOnOutsideClick() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                this.classList.remove('show');
            }
        });
    });
}

// ============ גרירת קבצים ============
function setupDropZone() {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');

    dropZone.addEventListener('click', () => fileInput.click());

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('active');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('active');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('active');
        if (e.dataTransfer.files.length > 0) {
            handleFile(e.dataTransfer.files[0]);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFile(e.target.files[0]);
        }
    });
}

// ============ עיבוד קובץ Excel ============
async function handleFile(file) {
    if (!file.name.match(/\.(xlsx|xls)$/)) {
        showMessage('נא להעלות קובץ Excel בלבד', 'error');
        return;
    }

    try {
        const data = await readExcelFile(file);
        const processed = processKanoData(data);
        await importToServer(processed);
        
        showMessage(`✅ הקובץ יובא בהצלחה! ${processed.length} רשומות`, 'success');
        loadStats();
        loadEmployees();
        loadDashboardEmployees();
        loadAvailableMonths();
    } catch (error) {
        showMessage('שגיאה בייבוא הקובץ: ' + error.message, 'error');
    }
}

function readExcelFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(firstSheet);
                resolve(jsonData);
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

function processKanoData(data) {
    return data.map(row => ({
        date: formatDateFromExcel(row['תאריך']),
        employee: row['שם עובד'],
        department: row['מחלקה'],
        days: row['מילואים'] || 1
    }));
}

function formatDateFromExcel(excelDate) {
    console.log('🔍 מעבד תאריך:', excelDate, typeof excelDate);
    
    // אם זה כבר בפורמט ISO (yyyy-mm-dd)
    if (typeof excelDate === 'string' && excelDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return excelDate;
    }
    
    // פורמט עברי: dd.mm.yyyy
    if (typeof excelDate === 'string' && excelDate.includes('.')) {
        const parts = excelDate.trim().split('.');
        if (parts.length === 3) {
            const day = parts[0].padStart(2, '0');
            const month = parts[1].padStart(2, '0');
            const year = parts[2];
            const formatted = `${year}-${month}-${day}`;
            console.log('✅ פורמט עברי הומר:', excelDate, '→', formatted);
            return formatted;
        }
    }
    
    // פורמט אמריקאי: mm/dd/yyyy
    if (typeof excelDate === 'string' && excelDate.includes('/')) {
        const parts = excelDate.trim().split('/');
        if (parts.length === 3) {
            const month = parts[0].padStart(2, '0');
            const day = parts[1].padStart(2, '0');
            const year = parts[2];
            const formatted = `${year}-${month}-${day}`;
            console.log('✅ פורמט אמריקאי הומר:', excelDate, '→', formatted);
            return formatted;
        }
    }
    
    // מספר Excel (serial date)
    if (typeof excelDate === 'number') {
        try {
            const date = XLSX.SSF.parse_date_code(excelDate);
            const formatted = `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
            console.log('✅ מספר Excel הומר:', excelDate, '→', formatted);
            return formatted;
        } catch (e) {
            console.error('❌ שגיאה בהמרת מספר Excel:', e);
        }
    }
    
    console.warn('⚠️ תאריך לא מוכר:', excelDate);
    return excelDate;
}

async function importToServer(data) {
    const response = await fetch(`${API_URL}/import-kano`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data })
    });
    
    if (!response.ok) throw new Error('שגיאה בייבוא נתונים');
    return response.json();
}

// ============ טעינת נתונים ============
async function loadStats() {
    try {
        const response = await fetch(`${API_URL}/stats`);
        const stats = await response.json();
        
        document.getElementById('stat-employees').textContent = stats.totalEmployees;
        document.getElementById('stat-days').textContent = stats.totalDays;
        document.getElementById('stat-pending').textContent = stats.pendingPayments;
        document.getElementById('stat-amount').textContent = '₪' + stats.totalPending.toLocaleString();
    } catch (error) {
        console.error('שגיאה בטעינת סטטיסטיקות:', error);
    }
}

async function loadEmployees() {
    try {
        const response = await fetch(`${API_URL}/employees`);
        employees = await response.json();
        renderEmployeesTable();
        updateEmployeeSelects();
    } catch (error) {
        console.error('שגיאה בטעינת עובדים:', error);
    }
}

async function loadDashboardEmployees() {
    const tbody = document.getElementById('dashboard-employees');
    
    if (employees.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="empty-state">
                    <div class="empty-state-icon">📋</div>
                    <div class="empty-state-text">אין נתונים להצגה</div>
                    <div class="empty-state-hint">ייבא קובץ מקאנו להתחלה</div>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = employees.slice(0, 5).map(emp => `
        <tr>
            <td>${emp.name}</td>
            <td>${emp.department || '-'}</td>
            <td><span class="badge badge-info">${emp.total_days} ימים</span></td>
            <td style="font-weight: 600;">₪${(emp.expected_amount || 0).toLocaleString()}</td>
        </tr>
    `).join('');
}

function renderEmployeesTable() {
    const tbody = document.getElementById('employees-table');
    
    if (employees.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    <div class="empty-state-icon">👥</div>
                    <div class="empty-state-text">אין עובדים במערכת</div>
                    <div class="empty-state-hint">ייבא קובץ או הוסף עובדים ידנית</div>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = employees.map(emp => `
        <tr>
            <td>${emp.name}</td>
            <td>${emp.id_number || '-'}</td>
            <td>${emp.department || '-'}</td>
            <td>
                <input type="number" 
                       value="${emp.daily_rate}" 
                       onchange="updateEmployeeRate(${emp.id}, this.value)"
                       style="width: 120px; padding: 6px; border: 1px solid var(--neutral-light); border-radius: 4px;"
                       placeholder="₪">
            </td>
            <td><span class="badge badge-info">${emp.total_days} ימים</span></td>
            <td style="font-weight: 600;">₪${(emp.expected_amount || 0).toLocaleString()}</td>
            <td>
                <div class="action-btns">
                    <button class="btn btn-sm btn-primary" onclick="editEmployee(${emp.id})">✏️ ערוך</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteEmployee(${emp.id})">🗑️</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function updateEmployeeSelects() {
    const select = document.getElementById('payment-employee');
    select.innerHTML = '<option value="">בחר עובד</option>' +
        employees.map(emp => `<option value="${emp.id}">${emp.name}</option>`).join('');
}

async function loadAvailableMonths() {
    try {
        const response = await fetch(`${API_URL}/available-months`);
        const months = await response.json();
        
        const selects = ['month-select', 'payment-month'];
        selects.forEach(selectId => {
            const select = document.getElementById(selectId);
            if (select) {
                select.innerHTML = '<option value="">בחר חודש</option>' +
                    months
                        .filter(m => m) // סינון ערכי null
                        .map(month => {
                            const [year, monthNum] = month.split('-');
                            const date = new Date(year, monthNum - 1);
                            const monthName = date.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
                            return `<option value="${month}">${monthName}</option>`;
                        }).join('');
            }
        });
    } catch (error) {
        console.error('שגיאה בטעינת חודשים:', error);
    }
}

async function loadMonthlyReport() {
    const month = document.getElementById('month-select').value;
    if (!month) return;
    
    try {
        const response = await fetch(`${API_URL}/monthly-report/${month}`);
        const report = await response.json();
        
        const tbody = document.getElementById('monthly-table');
        const tfoot = document.getElementById('monthly-footer');
        
        if (report.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="empty-state">
                        <div class="empty-state-text">אין נתונים לחודש זה</div>
                    </td>
                </tr>
            `;
            tfoot.style.display = 'none';
            return;
        }
        
        let total = 0;
        
        tbody.innerHTML = report.map(emp => {
            total += emp.expected_amount || 0;
            return `
                <tr>
                    <td>${emp.name}</td>
                    <td>${formatDate(emp.start_date)}</td>
                    <td>${formatDate(emp.end_date)}</td>
                    <td><span class="badge badge-info">${emp.total_days}</span></td>
                    <td><span class="badge badge-success">${emp.work_days}</span></td>
                    <td>₪${(emp.daily_rate || 0).toLocaleString()}</td>
                    <td style="font-weight: 600;">₪${(emp.expected_amount || 0).toLocaleString()}</td>
                </tr>
            `;
        }).join('');
        
        document.getElementById('monthly-total').textContent = '₪' + total.toLocaleString();
        tfoot.style.display = 'table-footer-group';
        
    } catch (error) {
        console.error('שגיאה בטעינת דוח חודשי:', error);
        showMessage('שגיאה בטעינת הדוח', 'error');
    }
}

async function loadPayments() {
    try {
        const response = await fetch(`${API_URL}/payments`);
        payments = await response.json();
        renderPaymentsTable();
    } catch (error) {
        console.error('שגיאה בטעינת תשלומים:', error);
    }
}

function renderPaymentsTable() {
    const tbody = document.getElementById('payments-table');
    
    if (payments.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    <div class="empty-state-icon">💰</div>
                    <div class="empty-state-text">אין תשלומים מעודכנים</div>
                    <div class="empty-state-hint">הוסף תשלומים שהתקבלו מביטוח לאומי</div>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = payments.map(payment => {
        const statusBadge = getStatusBadge(payment.status);
        const [year, month] = payment.month.split('-');
        const monthName = new Date(year, month - 1).toLocaleDateString('he-IL', { month: '2-digit', year: '2-digit' });
        
        return `
            <tr>
                <td>${payment.employee_name}</td>
                <td>${monthName}</td>
                <td>₪${(payment.expected_amount || 0).toLocaleString()}</td>
                <td>₪${(payment.received_amount || 0).toLocaleString()}</td>
                <td style="font-weight: 600; color: ${payment.difference > 0 ? 'var(--status-error)' : 'var(--status-success)'};">
                    ₪${Math.abs(payment.difference || 0).toLocaleString()}
                </td>
                <td>${statusBadge}</td>
                <td>
                    <button class="btn btn-sm btn-info" onclick="viewPaymentDetails(${payment.id})">👁️ צפה</button>
                </td>
            </tr>
        `;
    }).join('');
}

function getStatusBadge(status) {
    const badges = {
        'paid': '<span class="badge badge-success">✅ שולם מלא</span>',
        'partial': '<span class="badge badge-warning">🟡 ממתין להפרש</span>',
        'pending': '<span class="badge badge-error">🔴 לא שולם</span>'
    };
    return badges[status] || badges.pending;
}

// ============ פעולות על עובדים ============
function openAddEmployeeModal() {
    document.getElementById('employee-form').reset();
    openModal('employee-modal');
}

async function saveEmployee(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const data = Object.fromEntries(formData.entries());
    
    try {
        const response = await fetch(`${API_URL}/employees`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) throw new Error('שגיאה בשמירת עובד');
        
        showMessage('✅ עובד נוסף בהצלחה', 'success');
        closeModal('employee-modal');
        loadEmployees();
        loadStats();
    } catch (error) {
        showMessage('שגיאה בשמירת עובד: ' + error.message, 'error');
    }
}

async function updateEmployeeRate(id, rate) {
    try {
        const employee = employees.find(e => e.id === id);
        const response = await fetch(`${API_URL}/employees/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...employee, daily_rate: parseFloat(rate) || 0 })
        });
        
        if (!response.ok) throw new Error('שגיאה בעדכון תעריף');
        
        showMessage('תעריף עודכן בהצלחה', 'success');
        loadEmployees();
    } catch (error) {
        showMessage('שגיאה בעדכון תעריף', 'error');
    }
}

async function deleteEmployee(id) {
    if (!confirm('האם אתה בטוח שברצונך למחוק עובד זה? כל הנתונים שלו יימחקו.')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/employees/${id}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) throw new Error('שגיאה במחיקת עובד');
        
        showMessage('עובד נמחק בהצלחה', 'success');
        loadEmployees();
        loadStats();
    } catch (error) {
        showMessage('שגיאה במחיקת עובד', 'error');
    }
}

// ============ פעולות על תשלומים ============
function openAddPaymentModal() {
    document.getElementById('payment-form').reset();
    openModal('payment-modal');
}

async function savePayment(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const data = Object.fromEntries(formData.entries());
    
    try {
        const response = await fetch(`${API_URL}/payments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (!response.ok) throw new Error(result.error || 'שגיאה בשמירת תשלום');
        
        const diffMsg = result.difference > 0 
            ? `יש הפרש של ₪${result.difference.toLocaleString()} לתשלום`
            : 'התשלום שולם במלואו';
        
        showMessage(`✅ תשלום עודכן בהצלחה. ${diffMsg}`, 'success');
        closeModal('payment-modal');
        loadPayments();
        loadStats();
    } catch (error) {
        showMessage('שגיאה בשמירת תשלום: ' + error.message, 'error');
    }
}

function viewPaymentDetails(id) {
    const payment = payments.find(p => p.id === id);
    if (!payment) return;
    
    alert(`פרטי תשלום:\n\n` +
          `עובד: ${payment.employee_name}\n` +
          `חודש: ${payment.month}\n` +
          `צפוי: ₪${payment.expected_amount.toLocaleString()}\n` +
          `התקבל: ₪${payment.received_amount.toLocaleString()}\n` +
          `הפרש: ₪${payment.difference.toLocaleString()}\n` +
          `הערות: ${payment.notes || '-'}`
    );
}

// ============ יצוא PDF ============
async function exportMonthlyToPDF() {
    const month = document.getElementById('month-select').value;
    if (!month) {
        showMessage('נא לבחור חודש', 'error');
        return;
    }
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // כותרת
    doc.setFontSize(18);
    doc.text('Monthly Reserve Duty Report - Litay', 105, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.text(`Month: ${month}`, 105, 30, { align: 'center' });
    
    // טבלה
    const table = document.getElementById('monthly-table');
    doc.autoTable({ 
        html: table,
        startY: 40,
        theme: 'grid',
        headStyles: { fillColor: [82, 129, 99] }
    });
    
    doc.save(`miluim-report-${month}.pdf`);
    showMessage('הדוח יוצא לPDF', 'success');
}

// ============ פונקציות עזר ============
function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('he-IL');
}

function formatMonth(monthString) {
    const [year, month] = monthString.split('-');
    const date = new Date(year, month - 1);
    return date.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
}
