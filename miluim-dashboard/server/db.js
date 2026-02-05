const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data', 'miluim.json');

const DEFAULT_DATA = {
  employees: [],
  salary_history: [],
  duties: [],
  bl_payments: [],
  payment_batches: [],
  _meta: {
    version: 3,
    created: new Date().toISOString(),
    lastModified: new Date().toISOString()
  }
};

class Database {
  constructor() {
    this.data = this._load();
  }

  _load() {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        return {
          employees: parsed.employees || [],
          salary_history: parsed.salary_history || [],
          duties: parsed.duties || [],
          bl_payments: parsed.bl_payments || [],
          payment_batches: parsed.payment_batches || [],
          _meta: parsed._meta || DEFAULT_DATA._meta
        };
      }
    } catch (err) {
      console.error('Error loading data:', err.message);
    }
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }

  _save() {
    try {
      this.data._meta.lastModified = new Date().toISOString();
      const dir = path.dirname(DATA_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(DATA_FILE, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (err) {
      console.error('Error saving data:', err.message);
      throw err;
    }
  }

  _nextId(table) {
    const items = this.data[table] || [];
    if (items.length === 0) return 1;
    return Math.max(...items.map(i => i.id)) + 1;
  }

  // ===== EMPLOYEES =====

  getEmployees() {
    return this.data.employees.map(emp => this._enrichEmployee(emp));
  }

  getEmployeesByYear(year) {
    return this.data.employees.map(emp => {
      const enriched = this._enrichEmployee(emp, year);
      if (enriched.total_days === 0 && enriched.total_bl === 0) return null;
      return enriched;
    }).filter(Boolean);
  }

  _enrichEmployee(emp, year) {
    const duties = year
      ? this.data.duties.filter(d => d.employee_id === emp.id && d.year === year)
      : this.data.duties.filter(d => d.employee_id === emp.id);
    const blPayments = year
      ? this.data.bl_payments.filter(p => p.employee_id === emp.id && duties.some(d => d.id === p.duty_id))
      : this.data.bl_payments.filter(p => p.employee_id === emp.id);

    const totalDays = duties.reduce((s, d) => s + (d.total_days || 0), 0);
    const totalExpectedBL = duties.reduce((s, d) => s + (d.expected_bl || 0), 0);
    const totalBLPaid = blPayments.reduce((s, p) => s + (p.total_to_employee || 0), 0);
    const totalDifference = duties.reduce((s, d) => s + (d.difference_amount || 0), 0);

    // Current salary
    const salaryRecords = this.data.salary_history
      .filter(s => s.employee_id === emp.id)
      .sort((a, b) => b.effective_date.localeCompare(a.effective_date));
    const currentRate = salaryRecords.length > 0 ? salaryRecords[0].daily_rate : emp.daily_rate;

    return {
      ...emp,
      current_daily_rate: currentRate,
      total_days: totalDays,
      total_expected_bl: totalExpectedBL,
      total_bl_paid: totalBLPaid,
      bl_balance: totalExpectedBL - totalBLPaid,
      total_difference: totalDifference,
      duty_count: duties.length
    };
  }

  findEmployeeByTz(tz) {
    if (!tz) return null;
    const clean = String(tz).trim();
    return this.data.employees.find(e => String(e.tz).trim() === clean) || null;
  }

  findEmployeeByName(fullName) {
    if (!fullName) return null;
    const clean = fullName.trim();
    return this.data.employees.find(e => {
      const empFull = `${e.first_name} ${e.last_name}`.trim();
      return empFull === clean || `${e.last_name} ${e.first_name}`.trim() === clean;
    }) || null;
  }

  addEmployee(employee) {
    if (employee.tz) {
      const existing = this.findEmployeeByTz(employee.tz);
      if (existing) return existing;
    }

    const newEmp = {
      id: this._nextId('employees'),
      tz: employee.tz || '',
      first_name: employee.first_name || '',
      last_name: employee.last_name || '',
      full_name: employee.full_name || `${employee.first_name || ''} ${employee.last_name || ''}`.trim(),
      department: employee.department || '',
      daily_rate: employee.daily_rate || 0,
      monthly_salary: employee.monthly_salary || 0,
      bank: employee.bank || '',
      account_number: employee.account_number || '',
      status: employee.status || 'active',
      created: new Date().toISOString()
    };
    this.data.employees.push(newEmp);
    this._save();
    return newEmp;
  }

  updateEmployee(id, updates) {
    const idx = this.data.employees.findIndex(e => e.id === id);
    if (idx === -1) return null;
    this.data.employees[idx] = { ...this.data.employees[idx], ...updates };
    this._save();
    return this.data.employees[idx];
  }

  deleteEmployee(id) {
    this.data.employees = this.data.employees.filter(e => e.id !== id);
    this.data.duties = this.data.duties.filter(d => d.employee_id !== id);
    this.data.bl_payments = this.data.bl_payments.filter(p => p.employee_id !== id);
    this.data.salary_history = this.data.salary_history.filter(s => s.employee_id !== id);
    this._save();
  }

  // ===== SALARY HISTORY =====

  getSalaryHistory(employeeId) {
    return this.data.salary_history
      .filter(s => s.employee_id === employeeId)
      .sort((a, b) => b.effective_date.localeCompare(a.effective_date));
  }

  addSalaryRecord(record) {
    const newRecord = {
      id: this._nextId('salary_history'),
      employee_id: record.employee_id,
      daily_rate: record.daily_rate,
      monthly_salary: record.monthly_salary || 0,
      effective_date: record.effective_date,
      notes: record.notes || '',
      created: new Date().toISOString()
    };
    this.data.salary_history.push(newRecord);
    this._save();
    return newRecord;
  }

  getDailyRateForDate(employeeId, date) {
    const records = this.data.salary_history
      .filter(s => s.employee_id === employeeId && s.effective_date <= date)
      .sort((a, b) => b.effective_date.localeCompare(a.effective_date));
    if (records.length > 0) return records[0].daily_rate;
    const emp = this.data.employees.find(e => e.id === employeeId);
    return emp ? emp.daily_rate : 0;
  }

  // ===== DUTIES (reserve duty periods) =====

  getDuties(filters = {}) {
    let duties = this.data.duties;
    if (filters.year) duties = duties.filter(d => d.year === filters.year);
    if (filters.month) duties = duties.filter(d => d.month === filters.month);
    if (filters.employee_id) duties = duties.filter(d => d.employee_id === filters.employee_id);

    return duties.map(duty => {
      const emp = this.data.employees.find(e => e.id === duty.employee_id);
      const blPayments = this.data.bl_payments.filter(p => p.duty_id === duty.id);
      const totalBLPaid = blPayments.reduce((s, p) => s + (p.total_to_employee || 0), 0);
      return {
        ...duty,
        employee_name: emp ? emp.full_name || `${emp.first_name} ${emp.last_name}` : '',
        employee_tz: emp ? emp.tz : '',
        department: emp ? emp.department : '',
        total_bl_paid: totalBLPaid,
        bl_balance: (duty.expected_bl || 0) - totalBLPaid,
        payment_status: totalBLPaid === 0 ? 'pending'
          : totalBLPaid >= (duty.expected_bl || 0) ? 'paid'
          : 'partial'
      };
    });
  }

  addDuty(duty) {
    // Check for existing: same employee + same start_date
    const existing = this.data.duties.find(d =>
      d.employee_id === duty.employee_id &&
      d.start_date === duty.start_date &&
      d.end_date === duty.end_date
    );

    if (existing) {
      // Update existing
      Object.assign(existing, duty, { id: existing.id });
      this._save();
      return existing;
    }

    const newDuty = {
      id: this._nextId('duties'),
      employee_id: duty.employee_id,
      year: duty.year,
      month: duty.month,
      start_date: duty.start_date || '',
      end_date: duty.end_date || '',
      total_days: duty.total_days || 0,
      weekdays: duty.weekdays || 0,        // ימי א-ה
      fridays: duty.fridays || 0,          // ימי שישי
      saturdays: duty.saturdays || 0,      // ימי שבת
      holidays: duty.holidays || 0,        // ימי חג
      daily_rate: duty.daily_rate || 0,
      employer_payment: duty.employer_payment || 0,   // תשלום מעסיק (א-ה)
      compensation_20: duty.compensation_20 || 0,     // פיצוי 20%
      supplement_40: duty.supplement_40 || 0,          // תוספת 40%
      expected_bl: duty.expected_bl || 0,              // סה"כ צפוי מביטוח לאומי
      bl_payment_date: duty.bl_payment_date || '',     // מועד תשלום ב"ל
      difference_amount: duty.difference_amount || 0,  // הפרשים לעובד
      paid_in_previous: duty.paid_in_previous || '',   // שולם בשכר קודם
      payment_month: duty.payment_month || '',         // חודש ביצוע תשלום
      notes: duty.notes || '',
      status: duty.status || 'submitted',
      created: new Date().toISOString()
    };
    this.data.duties.push(newDuty);
    this._save();
    return newDuty;
  }

  updateDuty(id, updates) {
    const idx = this.data.duties.findIndex(d => d.id === id);
    if (idx === -1) return null;
    this.data.duties[idx] = { ...this.data.duties[idx], ...updates };
    this._save();
    return this.data.duties[idx];
  }

  deleteDuty(id) {
    this.data.duties = this.data.duties.filter(d => d.id !== id);
    this.data.bl_payments = this.data.bl_payments.filter(p => p.duty_id !== id);
    this._save();
  }

  // ===== BL PAYMENTS (Bituach Leumi) =====

  getBLPayments(filters = {}) {
    let payments = this.data.bl_payments;
    if (filters.employee_id) payments = payments.filter(p => p.employee_id === filters.employee_id);
    if (filters.batch_number) payments = payments.filter(p => p.batch_number === filters.batch_number);

    return payments.map(p => {
      const emp = this.data.employees.find(e => e.id === p.employee_id);
      const duty = this.data.duties.find(d => d.id === p.duty_id);
      return {
        ...p,
        employee_name: emp ? emp.full_name || `${emp.first_name} ${emp.last_name}` : '',
        duty_period: duty ? `${duty.start_date} - ${duty.end_date}` : '',
        duty_month: duty ? `${duty.year}-${String(duty.month).padStart(2, '0')}` : ''
      };
    });
  }

  addBLPayment(payment) {
    const newPayment = {
      id: this._nextId('bl_payments'),
      employee_id: payment.employee_id,
      duty_id: payment.duty_id || null,
      start_date: payment.start_date || '',
      end_date: payment.end_date || '',
      payment_type: payment.payment_type || 'regular',
      tagmul: payment.tagmul || 0,              // תגמול
      compensation_20: payment.compensation_20 || 0, // פיצוי 20%
      supplement_40: payment.supplement_40 || 0,     // תוספת 40%
      total_to_employee: payment.total_to_employee || 0, // סה"כ לעובד
      batch_number: payment.batch_number || '',  // מספר מנה
      payment_date: payment.payment_date || '',
      source_file: payment.source_file || '',
      created: new Date().toISOString()
    };
    this.data.bl_payments.push(newPayment);
    this._save();
    return newPayment;
  }

  deleteBLPayment(id) {
    this.data.bl_payments = this.data.bl_payments.filter(p => p.id !== id);
    this._save();
  }

  // ===== STATS =====

  getStats(year) {
    const employees = year ? this.getEmployeesByYear(year) : this.getEmployees();
    const duties = year ? this.data.duties.filter(d => d.year === year) : this.data.duties;
    const dutyIds = new Set(duties.map(d => d.id));
    const blPayments = this.data.bl_payments.filter(p => !year || dutyIds.has(p.duty_id));

    const totalDays = duties.reduce((s, d) => s + (d.total_days || 0), 0);
    const totalExpectedBL = duties.reduce((s, d) => s + (d.expected_bl || 0), 0);
    const totalEmployerPay = duties.reduce((s, d) => s + (d.employer_payment || 0), 0);
    const totalBLPaid = blPayments.reduce((s, p) => s + (p.total_to_employee || 0), 0);
    const totalDifference = duties.reduce((s, d) => s + (d.difference_amount || 0), 0);

    const pendingDuties = duties.filter(d => {
      const paid = blPayments.filter(p => p.duty_id === d.id).reduce((s, p) => s + (p.total_to_employee || 0), 0);
      return paid < (d.expected_bl || 0) && (d.expected_bl || 0) > 0;
    });

    return {
      totalEmployees: employees.length,
      totalDays,
      totalExpectedBL,
      totalEmployerPay,
      totalBLPaid,
      blBalance: totalExpectedBL - totalBLPaid,
      totalDifference,
      pendingCount: pendingDuties.length
    };
  }

  getAvailableYears() {
    const years = [...new Set(this.data.duties.map(d => d.year))].sort((a, b) => b - a);
    if (years.length === 0) return [new Date().getFullYear()];
    return years;
  }

  getAvailableMonths(year) {
    return [...new Set(
      this.data.duties.filter(d => d.year === year).map(d => d.month)
    )].sort((a, b) => a - b);
  }

  // ===== IMPORT: MECANO (attendance file, no TZ) =====

  importMecano(rows) {
    let matched = 0, unmatched = 0, errors = [];
    const unmatchedNames = new Set();

    // Group by employee+month
    const grouped = {};
    rows.forEach((row, i) => {
      try {
        const name = row.name;
        const date = row.date;
        const dept = row.department || '';

        if (!name || !date) return;

        // Try to match employee by name
        let emp = this.findEmployeeByName(name);
        // Also try by TZ if provided (2026 format)
        if (!emp && row.tz) emp = this.findEmployeeByTz(row.tz);

        if (!emp) {
          unmatchedNames.add(name);
          unmatched++;
          return;
        }

        const year = parseInt(date.substring(0, 4));
        const month = parseInt(date.substring(5, 7));
        const key = `${emp.id}_${year}_${month}`;

        if (!grouped[key]) {
          grouped[key] = {
            employee_id: emp.id,
            year, month,
            dates: [],
            department: dept
          };
        }
        if (!grouped[key].dates.includes(date)) {
          grouped[key].dates.push(date);
        }
        matched++;
      } catch (err) {
        errors.push(`Row ${i + 1}: ${err.message}`);
      }
    });

    // Create duty records from grouped data
    let dutiesCreated = 0;
    Object.values(grouped).forEach(g => {
      const rate = this.getDailyRateForDate(g.employee_id, g.dates[0]);
      this.addDuty({
        employee_id: g.employee_id,
        year: g.year,
        month: g.month,
        start_date: g.dates[0],
        end_date: g.dates[g.dates.length - 1],
        total_days: g.dates.length,
        daily_rate: rate,
        employer_payment: g.dates.length * rate,
        status: 'from_mecano'
      });
      dutiesCreated++;
    });

    return {
      matched, unmatched, dutiesCreated, errors,
      unmatchedNames: [...unmatchedNames]
    };
  }

  // ===== IMPORT: BL PAYMENTS =====

  importBLPayments(rows) {
    let imported = 0, errors = [];

    rows.forEach((row, i) => {
      try {
        const emp = this.findEmployeeByTz(row.tz);
        if (!emp) {
          errors.push(`Row ${i + 1}: employee TZ ${row.tz} not found`);
          return;
        }

        // Try to match to a duty period
        let dutyId = null;
        if (row.start_date) {
          const duty = this.data.duties.find(d =>
            d.employee_id === emp.id && d.start_date === row.start_date
          );
          if (duty) dutyId = duty.id;
        }

        this.addBLPayment({
          employee_id: emp.id,
          duty_id: dutyId,
          start_date: row.start_date || '',
          end_date: row.end_date || '',
          payment_type: row.payment_type || 'regular',
          tagmul: row.tagmul || 0,
          compensation_20: row.compensation_20 || 0,
          supplement_40: row.supplement_40 || 0,
          total_to_employee: row.total_to_employee || 0,
          batch_number: row.batch_number || '',
          payment_date: row.payment_date || '',
          source_file: row.source_file || ''
        });
        imported++;
      } catch (err) {
        errors.push(`Row ${i + 1}: ${err.message}`);
      }
    });

    return { imported, errors };
  }

  // ===== RESET =====

  isEmpty() {
    return this.data.employees.length === 0;
  }

  reset() {
    this.data = JSON.parse(JSON.stringify(DEFAULT_DATA));
    this._save();
  }

  // Bulk load (for seed)
  bulkLoad(data) {
    if (data.employees) this.data.employees = data.employees;
    if (data.salary_history) this.data.salary_history = data.salary_history;
    if (data.duties) this.data.duties = data.duties;
    if (data.bl_payments) this.data.bl_payments = data.bl_payments;
    if (data.payment_batches) this.data.payment_batches = data.payment_batches;
    this._save();
  }
}

module.exports = new Database();
