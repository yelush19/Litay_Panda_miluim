const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data', 'miluim.json');

const DEFAULT_DATA = {
  employees: [],
  duties: [],
  payments: [],
  _meta: {
    version: 2,
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
        // Ensure all tables exist
        return {
          employees: parsed.employees || [],
          duties: parsed.duties || [],
          payments: parsed.payments || [],
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
    return this.data.employees.map(emp => {
      const empDuties = this.data.duties.filter(d => d.employee_id === emp.id);
      const empPayments = this.data.payments.filter(p => p.employee_id === emp.id);
      const totalDays = empDuties.reduce((sum, d) => sum + (d.total_days || 0), 0);
      const totalExpected = empDuties.reduce((sum, d) => sum + (d.expected_amount || 0), 0);
      const totalPaid = empPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
      return {
        ...emp,
        total_days: totalDays,
        total_expected: totalExpected,
        total_paid: totalPaid,
        balance: totalExpected - totalPaid
      };
    });
  }

  getEmployeesByYear(year) {
    return this.data.employees.map(emp => {
      const empDuties = this.data.duties.filter(d => d.employee_id === emp.id && d.year === year);
      const empPayments = this.data.payments.filter(p => {
        const duty = this.data.duties.find(d => d.id === p.duty_id);
        return p.employee_id === emp.id && duty && duty.year === year;
      });
      const totalDays = empDuties.reduce((sum, d) => sum + (d.total_days || 0), 0);
      const totalExpected = empDuties.reduce((sum, d) => sum + (d.expected_amount || 0), 0);
      const totalPaid = empPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

      if (totalDays === 0 && totalExpected === 0) return null;

      return {
        ...emp,
        total_days: totalDays,
        total_expected: totalExpected,
        total_paid: totalPaid,
        balance: totalExpected - totalPaid
      };
    }).filter(Boolean);
  }

  findEmployeeByTz(tz) {
    return this.data.employees.find(e => e.tz === tz) || null;
  }

  addEmployee(employee) {
    const existing = this.findEmployeeByTz(employee.tz);
    if (existing) return existing;

    const newEmp = {
      id: this._nextId('employees'),
      tz: employee.tz,
      first_name: employee.first_name,
      last_name: employee.last_name,
      department: employee.department || '',
      daily_rate: employee.daily_rate || 0,
      status: 'active',
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
    this.data.payments = this.data.payments.filter(p => p.employee_id !== id);
    this._save();
  }

  // ===== DUTIES =====

  getDuties(filters = {}) {
    let duties = this.data.duties;
    if (filters.year) duties = duties.filter(d => d.year === filters.year);
    if (filters.month) duties = duties.filter(d => d.month === filters.month);
    if (filters.employee_id) duties = duties.filter(d => d.employee_id === filters.employee_id);

    return duties.map(duty => {
      const emp = this.data.employees.find(e => e.id === duty.employee_id);
      const payments = this.data.payments.filter(p => p.duty_id === duty.id);
      const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
      return {
        ...duty,
        employee_name: emp ? `${emp.first_name} ${emp.last_name}` : '',
        employee_tz: emp ? emp.tz : '',
        department: emp ? emp.department : '',
        total_paid: totalPaid,
        balance: (duty.expected_amount || 0) - totalPaid,
        payment_status: totalPaid === 0 ? 'pending'
          : totalPaid >= (duty.expected_amount || 0) ? 'paid'
          : 'partial'
      };
    });
  }

  addDuty(duty) {
    // Check for existing duty for same employee/year/month
    const existing = this.data.duties.find(d =>
      d.employee_id === duty.employee_id &&
      d.year === duty.year &&
      d.month === duty.month
    );

    if (existing) {
      // Merge: add days, update amount
      const newDates = [...new Set([...(existing.dates || []), ...(duty.dates || [])])].sort();
      existing.dates = newDates;
      existing.total_days = newDates.length;
      existing.expected_amount = newDates.length * (duty.daily_rate || existing.expected_amount / existing.total_days || 0);
      this._save();
      return existing;
    }

    const newDuty = {
      id: this._nextId('duties'),
      employee_id: duty.employee_id,
      year: duty.year,
      month: duty.month,
      dates: duty.dates || [],
      total_days: duty.total_days || (duty.dates || []).length,
      expected_amount: duty.expected_amount || 0,
      status: duty.status || 'submitted',
      notes: duty.notes || '',
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
    this.data.payments = this.data.payments.filter(p => p.duty_id !== id);
    this._save();
  }

  // ===== PAYMENTS =====

  getPayments(filters = {}) {
    let payments = this.data.payments;
    if (filters.employee_id) payments = payments.filter(p => p.employee_id === filters.employee_id);
    if (filters.duty_id) payments = payments.filter(p => p.duty_id === filters.duty_id);

    return payments.map(payment => {
      const emp = this.data.employees.find(e => e.id === payment.employee_id);
      const duty = this.data.duties.find(d => d.id === payment.duty_id);
      return {
        ...payment,
        employee_name: emp ? `${emp.first_name} ${emp.last_name}` : '',
        duty_month: duty ? `${duty.year}-${String(duty.month).padStart(2, '0')}` : '',
        duty_expected: duty ? duty.expected_amount : 0
      };
    });
  }

  addPayment(payment) {
    const newPayment = {
      id: this._nextId('payments'),
      employee_id: payment.employee_id,
      duty_id: payment.duty_id,
      amount: payment.amount,
      payment_date: payment.payment_date,
      reference: payment.reference || '',
      notes: payment.notes || '',
      created: new Date().toISOString()
    };
    this.data.payments.push(newPayment);
    this._save();
    return newPayment;
  }

  deletePayment(id) {
    this.data.payments = this.data.payments.filter(p => p.id !== id);
    this._save();
  }

  // ===== STATS =====

  getStats(year) {
    const employees = year ? this.getEmployeesByYear(year) : this.getEmployees();
    const duties = year ? this.data.duties.filter(d => d.year === year) : this.data.duties;
    const dutyIds = new Set(duties.map(d => d.id));
    const payments = this.data.payments.filter(p => !year || dutyIds.has(p.duty_id));

    const totalDays = duties.reduce((sum, d) => sum + (d.total_days || 0), 0);
    const totalExpected = duties.reduce((sum, d) => sum + (d.expected_amount || 0), 0);
    const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

    const pendingDuties = duties.filter(d => {
      const dutyPayments = payments.filter(p => p.duty_id === d.id);
      const paid = dutyPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
      return paid < (d.expected_amount || 0);
    });

    return {
      totalEmployees: employees.length,
      totalDays,
      totalExpected,
      totalPaid,
      balance: totalExpected - totalPaid,
      pendingCount: pendingDuties.length,
      avgDaysPerEmployee: employees.length > 0 ? Math.round(totalDays / employees.length) : 0
    };
  }

  getAvailableYears() {
    const years = [...new Set(this.data.duties.map(d => d.year))].sort((a, b) => b - a);
    if (years.length === 0) {
      return [new Date().getFullYear()];
    }
    return years;
  }

  getAvailableMonths(year) {
    const months = [...new Set(
      this.data.duties
        .filter(d => d.year === year)
        .map(d => d.month)
    )].sort((a, b) => a - b);
    return months;
  }

  // ===== IMPORT =====

  importKanoData(rows) {
    let importedEmployees = 0;
    let importedDuties = 0;
    let errors = [];

    rows.forEach((row, index) => {
      try {
        const { tz, first_name, last_name, department, daily_rate, duty_date, days, year, month, dates } = row;

        if (!tz || !first_name) {
          errors.push(`Row ${index + 1}: missing basic data`);
          return;
        }

        // Add or find employee
        let emp = this.findEmployeeByTz(tz);
        if (!emp) {
          emp = this.addEmployee({ tz, first_name, last_name, department, daily_rate: daily_rate || 500 });
          importedEmployees++;
        }

        // Add duty record
        if (dates && dates.length > 0) {
          this.addDuty({
            employee_id: emp.id,
            year: year || new Date().getFullYear(),
            month: month || new Date().getMonth() + 1,
            dates: dates,
            total_days: dates.length,
            expected_amount: dates.length * (daily_rate || emp.daily_rate || 500),
            daily_rate: daily_rate || emp.daily_rate || 500,
            status: 'submitted'
          });
          importedDuties++;
        }
      } catch (err) {
        errors.push(`Row ${index + 1}: ${err.message}`);
      }
    });

    return { importedEmployees, importedDuties, errors };
  }

  // ===== RESET =====

  reset() {
    this.data = JSON.parse(JSON.stringify(DEFAULT_DATA));
    this._save();
  }
}

module.exports = new Database();
