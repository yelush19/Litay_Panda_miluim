// ===== ניהול טאבים =====
function switchTab(tabName) {
  // הסתר כל הטאבים
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
  });
  
  // הסר active מכל כפתורי הטאבים
  document.querySelectorAll('.tab').forEach(tab => {
    tab.classList.remove('active');
  });
  
  // הצג את הטאב הנבחר
  const selectedContent = document.getElementById(tabName);
  if (selectedContent) {
    selectedContent.classList.add('active');
  }
  
  const selectedTab = document.querySelector(`[data-tab="${tabName}"]`);
  if (selectedTab) {
    selectedTab.classList.add('active');
  }
  
  // טען נתונים אם צריך
  if (tabName === 'employees') {
    loadEmployees();
  } else if (tabName === 'monthly') {
    loadAvailableMonths();
  }
}

// ===== טעינת סטטיסטיקות =====
async function loadStats() {
  try {
    const response = await fetch('http://localhost:3000/api/stats');
    const stats = await response.json();
    
    document.getElementById('totalEmployees').textContent = stats.totalEmployees || 0;
    document.getElementById('totalDays').textContent = stats.totalDays || 0;
    document.getElementById('avgDays').textContent = stats.avgDaysPerEmployee || 0;
    document.getElementById('pendingPayments').textContent = stats.pendingPayments || 0;
  } catch (error) {
    console.error('❌ שגיאה בטעינת סטטיסטיקות:', error);
  }
}

// ===== טעינת רשימת עובדים =====
async function loadEmployees() {
  try {
    const response = await fetch('http://localhost:3000/api/employees');
    const employees = await response.json();
    
    const tbody = document.getElementById('employeesTableBody');
    
    if (employees.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem;">אין עובדים במערכת</td></tr>';
      return;
    }
    
    tbody.innerHTML = employees.map(emp => `
      <tr>
        <td>${emp.first_name} ${emp.last_name}</td>
        <td>${emp.department || '-'}</td>
        <td class="amount-cell">${emp.total_days || 0} ימים</td>
        <td>${emp.tz}</td>
        <td class="amount-cell">₪${(emp.daily_rate || 0).toLocaleString()}</td>
      </tr>
    `).join('');
  } catch (error) {
    console.error('❌ שגיאה בטעינת עובדים:', error);
  }
}

// ===== המרת תאריך מקובץ Excel =====
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
      console.log(`✅ פורמט עברי הומר: ${excelDate} → ${formatted}`);
      return formatted;
    }
  }
  
  // פורמט אמריקאי: mm/dd/yyyy
  if (typeof excelDate === 'string' && excelDate.includes('/')) {
    const parts = excelDate.split('/');
    if (parts.length === 3) {
      const month = parts[0].padStart(2, '0');
      const day = parts[1].padStart(2, '0');
      const year = parts[2];
      const formatted = `${year}-${month}-${day}`;
      console.log(`✅ פורמט אמריקאי הומר: ${excelDate} → ${formatted}`);
      return formatted;
    }
  }
  
  // מספר סידורי של Excel
  if (typeof excelDate === 'number') {
    const date = new Date((excelDate - 25569) * 86400 * 1000);
    const formatted = date.toISOString().split('T')[0];
    console.log(`✅ מספר Excel הומר: ${excelDate} → ${formatted}`);
    return formatted;
  }
  
  // Date object
  if (excelDate instanceof Date) {
    const formatted = excelDate.toISOString().split('T')[0];
    console.log(`✅ Date object הומר: ${formatted}`);
    return formatted;
  }
  
  console.warn('⚠️ פורמט תאריך לא מזוהה:', excelDate);
  return null;
}

// ===== עיבוד נתוני קאנו =====
function processKanoData(data) {
  console.log('📊 מעבד נתוני קאנו:', data.length, 'שורות');
  
  // קבץ לפי עובד וחודש
  const grouped = {};
  
  data.forEach((row, index) => {
    // בדיקה: האם השורה ריקה
    const isEmpty = Object.values(row).every(val => !val || val === '');
    if (isEmpty) {
      console.log(`⚠️ שורה ${index + 1}: ריקה - מדלג`);
      return;
    }
    
    // חילוץ נתונים - פורמט חדש של קאנו
    const fullName = row['שם עובד'] || '';
    const dutyDate = formatDateFromExcel(row['תאריך'] || '');
    const department = row['מחלקה'] || '';
    const isMiluim = row['מילואים'] || 0;
    
    // וולידציה
    if (!fullName || !dutyDate || isMiluim !== 1) {
      console.log(`⚠️ שורה ${index + 1}: חסרים נתונים או לא מילואים - מדלג`);
      return;
    }
    
    // פיצול שם מלא לשם פרטי ומשפחה
    const nameParts = fullName.trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || nameParts[0];
    
    // יצירת מפתח ייחודי: שם מלא (משמש כת.ז. זמני)
    const uniqueKey = fullName.trim();
    
    // יצירת מפתח חודש (YYYY-MM)
    const monthKey = dutyDate.substring(0, 7);
    
    // מפתח משולב: עובד + חודש
    const combinedKey = `${uniqueKey}_${monthKey}`;
    
    if (!grouped[combinedKey]) {
      grouped[combinedKey] = {
        tz: uniqueKey, // שם מלא כת.ז. זמני
        first_name: firstName,
        last_name: lastName,
        department: department,
        month: monthKey,
        days: 0,
        dates: []
      };
    }
    
    grouped[combinedKey].days += 1;
    grouped[combinedKey].dates.push(dutyDate);
  });
  
  // המרה למערך
  const processed = Object.values(grouped).map(item => {
    // תאריך ייצוגי - היום הראשון
    const representativeDate = item.dates.sort()[0];
    
    return {
      tz: item.tz,
      last_name: item.last_name,
      first_name: item.first_name,
      duty_date: representativeDate,
      days: item.days,
      daily_rate: 500, // ברירת מחדל
      department: item.department
    };
  });
  
  console.log(`📋 סה"כ רשומות אחרי קיבוץ: ${processed.length}`);
  console.log('👥 עובדים:', [...new Set(processed.map(p => `${p.first_name} ${p.last_name}`))].join(', '));
  
  return processed;
}

// ===== העלאת קובץ =====
async function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  console.log('📁 קובץ נבחר:', file.name);
  
  // הצג הודעת טעינה
  showMessage('מעבד קובץ...', 'info');
  
  try {
    // קריאת הקובץ
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(firstSheet);
    
    console.log('📊 נתונים גולמיים מהקובץ:', jsonData.length, 'שורות');
    
    // עיבוד הנתונים
    const processedData = processKanoData(jsonData);
    
    if (processedData.length === 0) {
      showMessage('❌ לא נמצאו נתונים תקינים בקובץ', 'error');
      return;
    }
    
    // שליחה לשרת
    const response = await fetch('http://localhost:3000/api/import-kano', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ data: processedData })
    });
    
    const result = await response.json();
    
    if (result.success) {
      showMessage(result.message, 'success');
      loadStats();
      loadEmployees();
    } else {
      showMessage('❌ שגיאה בייבוא: ' + result.error, 'error');
    }
    
  } catch (error) {
    console.error('❌ שגיאה בעיבוד הקובץ:', error);
    showMessage('❌ שגיאה בעיבוד הקובץ: ' + error.message, 'error');
  }
}

// ===== הצגת הודעה =====
function showMessage(text, type = 'info') {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${type}`;
  messageDiv.textContent = text;
  
  const container = document.querySelector('.content');
  container.insertBefore(messageDiv, container.firstChild);
  
  setTimeout(() => {
    messageDiv.remove();
  }, 5000);
}

// ===== Drag & Drop =====
function setupDragDrop() {
  const uploadArea = document.querySelector('.upload-area');
  
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    uploadArea.addEventListener(eventName, preventDefaults, false);
  });
  
  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }
  
  ['dragenter', 'dragover'].forEach(eventName => {
    uploadArea.addEventListener(eventName, () => {
      uploadArea.classList.add('dragover');
    }, false);
  });
  
  ['dragleave', 'drop'].forEach(eventName => {
    uploadArea.addEventListener(eventName, () => {
      uploadArea.classList.remove('dragover');
    }, false);
  });
  
  uploadArea.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    
    document.getElementById('fileInput').files = files;
    handleFileUpload({ target: { files: files } });
  }, false);
}

// ===== טעינת חודשים זמינים =====
async function loadAvailableMonths() {
  try {
    const response = await fetch('http://localhost:3000/api/available-months');
    const months = await response.json();
    
    const select = document.getElementById('monthSelect');
    select.innerHTML = '<option value="">בחר חודש...</option>';
    
    months.forEach(month => {
      const option = document.createElement('option');
      option.value = month;
      
      // המרת YYYY-MM לפורמט עברי
      const [year, monthNum] = month.split('-');
      const monthNames = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
      option.textContent = `${monthNames[parseInt(monthNum) - 1]} ${year}`;
      
      select.appendChild(option);
    });
  } catch (error) {
    console.error('❌ שגיאה בטעינת חודשים:', error);
  }
}

// ===== טעינת דוח חודשי =====
async function loadMonthlyReport() {
  const month = document.getElementById('monthSelect').value;
  
  if (!month) {
    showMessage('⚠️ בחר חודש', 'warning');
    return;
  }
  
  try {
    const response = await fetch(`http://localhost:3000/api/monthly-report/${month}`);
    const report = await response.json();
    
    const tbody = document.getElementById('monthlyReportBody');
    
    if (report.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem;">אין נתונים לחודש זה</td></tr>';
      return;
    }
    
    tbody.innerHTML = report.map(item => `
      <tr>
        <td>${item.duty_date}</td>
        <td>${item.employee_name}</td>
        <td>${item.tz}</td>
        <td class="amount-cell">${item.days} ימים</td>
        <td class="amount-cell">₪${(item.calculated_amount || 0).toLocaleString()}</td>
      </tr>
    `).join('');
    
    // חישוב סיכום
    const totalDays = report.reduce((sum, item) => sum + (item.days || 0), 0);
    const totalAmount = report.reduce((sum, item) => sum + (item.calculated_amount || 0), 0);
    
    tbody.innerHTML += `
      <tr style="background-color: var(--primary-green-light); font-weight: bold;">
        <td colspan="3">סה"כ</td>
        <td class="amount-cell">${totalDays} ימים</td>
        <td class="amount-cell">₪${totalAmount.toLocaleString()}</td>
      </tr>
    `;
    
  } catch (error) {
    console.error('❌ שגיאה בטעינת דוח חודשי:', error);
    showMessage('❌ שגיאה בטעינת הדוח', 'error');
  }
}

// ===== אתחול =====
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 המערכת נטענת...');
  
  // טען סטטיסטיקות
  loadStats();
  
  // הגדר Drag & Drop
  setupDragDrop();
  
  // הוסף event listener לקובץ
  document.getElementById('fileInput').addEventListener('change', handleFileUpload);
  
  // הוסף event listeners לטאבים
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', function() {
      const tabName = this.getAttribute('data-tab');
      switchTab(tabName);
    });
  });
  
  // הוסף event listener לupload area
  const uploadArea = document.getElementById('uploadArea');
  if (uploadArea) {
    uploadArea.addEventListener('click', () => {
      document.getElementById('fileInput').click();
    });
  }
  
  // הוסף event listener לselect חודש
  const monthSelect = document.getElementById('monthSelect');
  if (monthSelect) {
    monthSelect.addEventListener('change', loadMonthlyReport);
  }
  
  console.log('✅ המערכת מוכנה!');
});