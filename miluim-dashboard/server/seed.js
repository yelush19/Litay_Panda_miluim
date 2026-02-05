/**
 * Seed script: reads the 2025 PUBLIC Excel file and populates the database.
 * Handles emoji prefixes in sheet names and non-standard column layouts.
 */

const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const PUBLIC_DIR = path.join(__dirname, '..', '..', 'PUBLIC');
const FILE_2025 = path.join(PUBLIC_DIR, 'מערכת_מילואים_מלאה_2025.xlsx');

function parseExcelDate(val) {
  if (!val && val !== 0) return '';
  if (typeof val === 'string') {
    // dd/mm/yyyy
    const m = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
    // dd.mm.yyyy
    const m2 = val.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (m2) return `${m2[3]}-${m2[2].padStart(2,'0')}-${m2[1].padStart(2,'0')}`;
    // mm/yyyy
    const m3 = val.match(/^(\d{1,2})\/(\d{4})$/);
    if (m3) return `${m3[2]}-${m3[1].padStart(2,'0')}`;
    if (/^\d{4}-\d{2}/.test(val)) return val;
    return val;
  }
  if (typeof val === 'number') {
    const d = new Date((val - 25569) * 86400 * 1000);
    return d.toISOString().split('T')[0];
  }
  return String(val);
}

function num(val) {
  if (val == null || val === '') return 0;
  const n = parseFloat(String(val).replace(/[,₪\s]/g, ''));
  return isNaN(n) ? 0 : Math.round(n * 100) / 100;
}

function monthFromDate(dateStr) {
  if (!dateStr) return { year: 2025, month: 1 };
  const s = String(dateStr);
  const m = s.match(/^(\d{4})-(\d{1,2})/);
  if (m) return { year: parseInt(m[1]), month: parseInt(m[2]) };
  return { year: 2025, month: 1 };
}

function findSheet(wb, keyword) {
  const name = wb.SheetNames.find(s => s.includes(keyword));
  return name ? wb.Sheets[name] : null;
}

function run() {
  if (!fs.existsSync(FILE_2025)) {
    console.log('2025 file not found at:', FILE_2025);
    return null;
  }

  console.log('Reading 2025 data from:', FILE_2025);
  const wb = XLSX.readFile(FILE_2025);

  const result = {
    employees: [],
    salary_history: [],
    duties: [],
    bl_payments: [],
    payment_batches: []
  };

  // ===== 1. EMPLOYEES from "רשימת עובדים" =====
  // Note: this sheet does NOT have ת.ז. - we'll get TZ from duties sheet
  const empSheet = findSheet(wb, 'רשימת עובדים');
  if (empSheet) {
    const rows = XLSX.utils.sheet_to_json(empSheet);
    let empId = 1;
    rows.forEach(row => {
      const fullName = String(row['שם מלא'] || '').trim();
      if (!fullName) return;

      result.employees.push({
        id: empId,
        tz: '', // Will be filled from duties sheet
        first_name: String(row['שם פרטי'] || '').trim(),
        last_name: String(row['שם משפחה'] || '').trim(),
        full_name: fullName,
        department: String(row['מחלקה'] || '').trim(),
        daily_rate: num(row['תעריף יומי']),
        monthly_salary: 0,
        bank: String(row['בנק'] || '').trim(),
        account_number: String(row['מספר חשבון'] || '').trim(),
        status: String(row['סטטוס'] || 'פעיל').trim(),
        created: new Date().toISOString()
      });
      empId++;
    });
    console.log(`  Employees (initial): ${result.employees.length}`);
  }

  // ===== 2. DUTY PERIODS from "תקופות מילואים-חדש" - also fills TZ on employees =====
  const dutySheet = findSheet(wb, 'תקופות מילואים-חדש');
  if (dutySheet) {
    const rows = XLSX.utils.sheet_to_json(dutySheet);
    let dutyId = 1;

    // First pass: fill TZ on employees from duty rows
    const tzByName = {};
    rows.forEach(row => {
      const tz = String(row['ת"ז'] || '').trim();
      const name = String(row['שם עובד'] || '').trim();
      if (tz && name && !tzByName[name]) {
        tzByName[name] = tz;
      }
    });

    // Update employees with TZ
    result.employees.forEach(emp => {
      if (!emp.tz && tzByName[emp.full_name]) {
        emp.tz = tzByName[emp.full_name];
      }
    });
    console.log(`  TZ mapped for ${Object.keys(tzByName).length} employees`);

    // Helper to find employee
    function findEmpId(tz, name) {
      if (tz) {
        const emp = result.employees.find(e => e.tz === String(tz).trim());
        if (emp) return emp.id;
      }
      if (name) {
        const clean = name.trim();
        const emp = result.employees.find(e =>
          e.full_name === clean ||
          `${e.first_name} ${e.last_name}` === clean ||
          `${e.last_name} ${e.first_name}` === clean
        );
        if (emp) return emp ? emp.id : null;
      }
      return null;
    }

    // Second pass: create duty records
    rows.forEach(row => {
      const tz = String(row['ת"ז'] || '').trim();
      const name = String(row['שם עובד'] || '').trim();
      const totalDays = num(row['סה"כ ימים']);
      if (!name || totalDays === 0) return;

      const empId = findEmpId(tz, name);
      if (!empId) return;

      const startDate = parseExcelDate(row['תאריך התחלה']);
      const endDate = parseExcelDate(row['תאריך סיום']);
      const monthDate = parseExcelDate(row['חודש']);
      const { year, month } = monthFromDate(monthDate || startDate);

      // Find notes column (has emoji prefix)
      const notesKey = Object.keys(row).find(k => k.includes('הערות'));

      result.duties.push({
        id: dutyId,
        employee_id: empId,
        year: year,
        month: month,
        start_date: startDate,
        end_date: endDate,
        total_days: totalDays,
        weekdays: num(row['ימי א-ה']),
        fridays: num(row['ימי שישי']),
        saturdays: num(row['ימי שבת']),
        holidays: num(row['ימי חג']),
        daily_rate: num(row['תעריף יומי']),
        employer_payment: num(row['תשלום מעסיק (א-ה)']),
        compensation_20: 0,
        supplement_40: 0,
        expected_bl: num(row['סה"כ תגמול מביטוח לאומי ₪']),
        bl_payment_date: parseExcelDate(row['מועד תשלום ביטוח לאומי']),
        difference_amount: num(row['סכום הפרשים לעובד ₪']),
        paid_in_previous: '',
        payment_month: parseExcelDate(row['חודש ביצוע תשלום']),
        notes: notesKey ? String(row[notesKey] || '').trim() : '',
        status: 'imported_2025',
        created: new Date().toISOString()
      });
      dutyId++;
    });
    console.log(`  Duty periods: ${result.duties.length}`);
  }

  // ===== 3. BL PAYMENTS from "תשלומי ב"ל" =====
  const blSheet = findSheet(wb, 'תשלומי');
  if (blSheet) {
    const rows = XLSX.utils.sheet_to_json(blSheet);
    let blId = 1;

    function findEmpId(tz, name) {
      if (tz) {
        const tzStr = String(tz).trim();
        const emp = result.employees.find(e => e.tz === tzStr);
        if (emp) return emp.id;
      }
      if (name) {
        const clean = name.trim();
        const emp = result.employees.find(e =>
          e.full_name === clean ||
          `${e.first_name} ${e.last_name}` === clean
        );
        if (emp) return emp.id;
      }
      return null;
    }

    rows.forEach(row => {
      const tz = String(row['ת.ז.'] || '').trim();
      const name = String(row['שם עובד'] || '').trim();
      const empId = findEmpId(tz, name);
      if (!empId) return;

      const startDate = parseExcelDate(row['תאריך התחלה']);
      const endDate = parseExcelDate(row['תאריך סיום']);

      // Try to match to a duty
      let dutyId = null;
      if (startDate) {
        const duty = result.duties.find(d =>
          d.employee_id === empId && d.start_date === startDate
        );
        if (duty) dutyId = duty.id;
      }

      result.bl_payments.push({
        id: blId,
        employee_id: empId,
        duty_id: dutyId,
        start_date: startDate,
        end_date: endDate,
        payment_type: String(row['סוג תשלום'] || 'רגיל').trim(),
        tagmul: num(row['תגמול ₪']),
        compensation_20: num(row['פיצוי 20% ₪']),
        supplement_40: num(row['תוספת 40% ₪']),
        total_to_employee: num(row['סה"כ לעובד ₪']),
        batch_number: String(row['מספר מנה'] || '').trim(),
        payment_date: parseExcelDate(row['תאריך תשלום']),
        source_file: String(row['קובץ מקור'] || '').trim(),
        created: new Date().toISOString()
      });
      blId++;
    });
    console.log(`  BL payments: ${result.bl_payments.length}`);
  }

  // ===== 4. SALARY HISTORY from "היסטוריית שכר" =====
  // This sheet has a title row, then instructions, then actual headers at row 3
  const salSheet = findSheet(wb, 'היסטוריית');
  if (salSheet) {
    const allRows = XLSX.utils.sheet_to_json(salSheet, { defval: '' });
    let salId = 1;

    // The real data starts after the header row (row index 2+)
    // Row 0 = title, Row 1 = instructions/empty, Row 2 = headers (ת.ז., שם מלא, etc)
    // Actual data columns are: __EMPTY = שם מלא, __EMPTY_1 = תעריף יומי, etc.
    allRows.forEach((row, idx) => {
      if (idx < 2) return; // Skip title and header rows

      const tz = row[Object.keys(row)[0]]; // First column = ת.ז.
      if (!tz || typeof tz !== 'number') return;

      const tzStr = String(tz).trim();
      const emp = result.employees.find(e => e.tz === tzStr);
      if (!emp) return;

      const dailyRate = num(row['__EMPTY_1']);
      const monthlySalary = num(row['__EMPTY_2']);
      const effectiveDate = parseExcelDate(row['__EMPTY_3']);

      if (!dailyRate && !monthlySalary) return;

      // Also update employee's daily rate and monthly salary
      if (dailyRate > 0 && emp.daily_rate === 0) {
        emp.daily_rate = dailyRate;
      }
      if (monthlySalary > 0 && emp.monthly_salary === 0) {
        emp.monthly_salary = monthlySalary;
      }

      result.salary_history.push({
        id: salId,
        employee_id: emp.id,
        daily_rate: dailyRate,
        monthly_salary: monthlySalary,
        effective_date: effectiveDate,
        notes: String(row['__EMPTY_5'] || '').trim(),
        created: new Date().toISOString()
      });
      salId++;
    });
    console.log(`  Salary history: ${result.salary_history.length}`);
  }

  // ===== 5. PAYMENT BATCHES from "רשימת תשלומים" =====
  const batchSheet = findSheet(wb, 'רשימת תשלומים');
  if (batchSheet) {
    const rows = XLSX.utils.sheet_to_json(batchSheet);
    rows.forEach(row => {
      result.payment_batches.push({
        batch_number: String(row['מנה'] || '').trim(),
        date: parseExcelDate(row['תאריך תשלום']),
        tagmul: num(row['תגמול ₪']),
        compensation_20: num(row['פיצוי 20% ₪']),
        supplement_40: num(row['תוספת 40% ₪']),
        total: num(row['סה"כ כולל ₪'])
      });
    });
    console.log(`  Payment batches: ${result.payment_batches.length}`);
  }

  console.log('');
  console.log('Seed data ready:');
  console.log(`  ${result.employees.length} employees`);
  console.log(`  ${result.duties.length} duty periods`);
  console.log(`  ${result.bl_payments.length} BL payments`);
  console.log(`  ${result.salary_history.length} salary history records`);
  console.log(`  ${result.payment_batches.length} payment batches`);

  return result;
}

module.exports = { run };
