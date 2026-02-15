const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'miluim-data.json');

class JSONDatabase {
  constructor() {
    this.data = this.loadData();
  }

  loadData() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.error('שגיאה בטעינת נתונים:', err.message);
    }

    return {
      employees: [],
      reserve_duty: [],
      payments: []
    };
  }

  saveData() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf8');
      return true;
    } catch (err) {
      console.error('שגיאה בשמירת נתונים:', err.message);
      return false;
    }
  }

  generateId(table) {
    const items = this.data[table];
    if (!items || items.length === 0) return 1;
    const maxId = Math.max(...items.map(item => item.id || 0));
    return maxId + 1;
  }

  // ===== Direct Methods =====

  // Employees
  getEmployees() {
    return this.data.employees.map(emp => {
      const totalDays = this.data.reserve_duty
        .filter(d => d.employee_id === emp.id)
        .reduce((sum, d) => sum + (d.days || 0), 0);
      return { ...emp, total_days: totalDays };
    });
  }

  getEmployeeById(id) {
    const emp = this.data.employees.find(e => e.id === id);
    if (!emp) return null;
    const totalDays = this.data.reserve_duty
      .filter(d => d.employee_id === emp.id)
      .reduce((sum, d) => sum + (d.days || 0), 0);
    return { ...emp, total_days: totalDays };
  }

  findEmployeeByTz(tz) {
    return this.data.employees.find(e => e.tz === tz) || null;
  }

  addEmployee(employee) {
    const existing = this.data.employees.find(e => e.tz === employee.tz);
    if (existing) {
      // Update existing employee if new data is more complete
      if (employee.department && !existing.department) existing.department = employee.department;
      if (employee.daily_rate && existing.daily_rate === 500) existing.daily_rate = employee.daily_rate;
      this.saveData();
      return existing;
    }
    const newEmployee = {
      id: this.generateId('employees'),
      tz: employee.tz,
      last_name: employee.last_name,
      first_name: employee.first_name,
      daily_rate: employee.daily_rate || 500,
      monthly_rate: employee.monthly_rate || (employee.daily_rate || 500) * 22,
      department: employee.department || '',
      status: 'active',
      created_date: new Date().toISOString()
    };
    this.data.employees.push(newEmployee);
    this.saveData();
    return newEmployee;
  }

  updateEmployee(id, updates) {
    const index = this.data.employees.findIndex(e => e.id === id);
    if (index === -1) return null;
    this.data.employees[index] = { ...this.data.employees[index], ...updates };
    this.saveData();
    return this.data.employees[index];
  }

  deleteEmployee(id) {
    const index = this.data.employees.findIndex(e => e.id === id);
    if (index === -1) return false;
    this.data.employees.splice(index, 1);
    // Also delete related reserve_duty and payments
    this.data.reserve_duty = this.data.reserve_duty.filter(d => d.employee_id !== id);
    this.data.payments = this.data.payments.filter(p => p.employee_id !== id);
    this.saveData();
    return true;
  }

  // Reserve Duty
  getReserveDuties() {
    return this.data.reserve_duty;
  }

  addReserveDuty(duty) {
    const newDuty = {
      id: this.generateId('reserve_duty'),
      employee_id: duty.employee_id,
      duty_date: duty.duty_date,
      days: duty.days,
      calculated_amount: duty.calculated_amount || 0,
      submission_status: duty.submission_status || 'submitted',
      created_date: new Date().toISOString()
    };
    this.data.reserve_duty.push(newDuty);
    this.saveData();
    return newDuty;
  }

  // Payments
  getPayments() {
    return this.data.payments;
  }

  getPaymentsByEmployee(employeeId) {
    return this.data.payments.filter(p => p.employee_id === employeeId);
  }

  addPayment(payment) {
    const newPayment = {
      id: this.generateId('payments'),
      employee_id: payment.employee_id,
      month: payment.month || '',
      amount: payment.amount,
      payment_date: payment.payment_date,
      reference: payment.reference || '',
      notes: payment.notes || '',
      status: payment.status || 'received',
      created_date: new Date().toISOString()
    };
    this.data.payments.push(newPayment);
    this.saveData();
    return newPayment;
  }

  updatePayment(id, updates) {
    const index = this.data.payments.findIndex(p => p.id === id);
    if (index === -1) return null;
    this.data.payments[index] = { ...this.data.payments[index], ...updates };
    this.saveData();
    return this.data.payments[index];
  }

  deletePayment(id) {
    const index = this.data.payments.findIndex(p => p.id === id);
    if (index === -1) return false;
    this.data.payments.splice(index, 1);
    this.saveData();
    return true;
  }

  // Stats
  getStats() {
    const totalEmployees = this.data.employees.length;
    const totalDays = this.data.reserve_duty.reduce((sum, d) => sum + (d.days || 0), 0);
    const totalExpected = this.data.reserve_duty.reduce((sum, d) => sum + (d.calculated_amount || 0), 0);
    const totalReceived = this.data.payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const pendingPayments = this.data.payments.filter(p => p.status !== 'paid').length;

    return {
      totalEmployees,
      totalDays,
      avgDaysPerEmployee: totalEmployees > 0 ? Math.round(totalDays / totalEmployees) : 0,
      pendingPayments,
      totalExpected,
      totalReceived,
      totalDifference: totalExpected - totalReceived
    };
  }

  // Available months
  getAvailableMonths() {
    const months = [...new Set(this.data.reserve_duty.map(d => d.duty_date.substring(0, 7)))];
    months.sort((a, b) => b.localeCompare(a));
    return months;
  }

  // Monthly report
  getMonthlyReport(month) {
    const monthlyDuties = this.data.reserve_duty.filter(d => d.duty_date.substring(0, 7) === month);
    return monthlyDuties.map(duty => {
      const employee = this.data.employees.find(e => e.id === duty.employee_id);
      return {
        ...duty,
        employee_name: employee ? `${employee.first_name} ${employee.last_name}` : 'לא ידוע',
        tz: employee ? employee.tz : '',
        department: employee ? employee.department : ''
      };
    });
  }

  // Daily report
  getDailyReport(dateFrom, dateTo) {
    let duties = this.data.reserve_duty;
    if (dateFrom) duties = duties.filter(d => d.duty_date >= dateFrom);
    if (dateTo) duties = duties.filter(d => d.duty_date <= dateTo);

    duties.sort((a, b) => a.duty_date.localeCompare(b.duty_date));

    return duties.map(duty => {
      const employee = this.data.employees.find(e => e.id === duty.employee_id);
      return {
        ...duty,
        employee_name: employee ? `${employee.first_name} ${employee.last_name}` : 'לא ידוע',
        tz: employee ? employee.tz : '',
        department: employee ? employee.department : '',
        daily_rate: employee ? employee.daily_rate : 0
      };
    });
  }

  // Comprehensive report
  getComprehensiveReport(filters = {}) {
    const employees = this.getEmployees();

    return employees
      .filter(emp => {
        if (filters.employeeId && emp.id !== filters.employeeId) return false;
        if (filters.department && emp.department !== filters.department) return false;
        return true;
      })
      .map(emp => {
        let duties = this.data.reserve_duty.filter(d => d.employee_id === emp.id);
        if (filters.monthFrom) duties = duties.filter(d => d.duty_date.substring(0, 7) >= filters.monthFrom);
        if (filters.monthTo) duties = duties.filter(d => d.duty_date.substring(0, 7) <= filters.monthTo);

        const totalDays = duties.reduce((sum, d) => sum + (d.days || 0), 0);
        const totalExpected = duties.reduce((sum, d) => sum + (d.calculated_amount || 0), 0);

        const payments = this.data.payments.filter(p => p.employee_id === emp.id);
        const totalReceived = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

        let status = 'pending';
        if (totalReceived >= totalExpected && totalExpected > 0) status = 'paid';
        else if (totalReceived > 0) status = 'partial';

        if (filters.status && status !== filters.status) return null;

        return {
          employee_id: emp.id,
          employee_name: `${emp.first_name} ${emp.last_name}`,
          tz: emp.tz,
          department: emp.department,
          total_days: totalDays,
          total_expected: totalExpected,
          total_received: totalReceived,
          difference: totalExpected - totalReceived,
          status,
          payments_count: payments.length
        };
      })
      .filter(Boolean);
  }

  // Get all departments
  getDepartments() {
    return [...new Set(this.data.employees.map(e => e.department).filter(Boolean))];
  }

  // Reset
  reset() {
    this.data = { employees: [], reserve_duty: [], payments: [] };
    this.saveData();
  }

  // Backward-compatible prepare interface
  prepare(sql) {
    const self = this;
    return {
      run: function(...params) {
        if (sql.includes('INSERT INTO employees')) {
          const [tz, lastName, firstName, dailyRate, monthlyRate, department] = params;
          const emp = self.addEmployee({ tz, last_name: lastName, first_name: firstName, daily_rate: dailyRate, monthly_rate: monthlyRate, department });
          return { lastInsertRowid: emp.id };
        }
        if (sql.includes('INSERT INTO reserve_duty')) {
          const [employeeId, dutyDate, days, calculatedAmount] = params;
          const duty = self.addReserveDuty({ employee_id: employeeId, duty_date: dutyDate, days, calculated_amount: calculatedAmount });
          return { lastInsertRowid: duty.id };
        }
        if (sql.includes('INSERT INTO payments')) {
          const [employeeId, dutyDate, amount, paymentDate] = params;
          const payment = self.addPayment({ employee_id: employeeId, month: dutyDate, amount, payment_date: paymentDate });
          return { lastInsertRowid: payment.id };
        }
      },
      get: function(...params) {
        if (sql.includes('COUNT(*)') && sql.includes('FROM employees')) {
          return { count: self.data.employees.length };
        }
        if (sql.includes('SUM(days)') && sql.includes('FROM reserve_duty')) {
          const totalDays = self.data.reserve_duty.reduce((sum, d) => sum + (d.days || 0), 0);
          return { count: totalDays };
        }
        if (sql.includes('COUNT(*)') && sql.includes('FROM payments')) {
          const pending = self.data.payments.filter(p => p.status !== 'paid').length;
          return { count: pending };
        }
        if (sql.includes('SELECT id FROM employees WHERE tz = ?')) {
          const [tz] = params;
          const employee = self.data.employees.find(e => e.tz === tz);
          return employee ? { id: employee.id } : null;
        }
        return null;
      },
      all: function() {
        if (sql.includes('SELECT * FROM employees')) return self.getEmployees();
        if (sql.includes('SELECT * FROM reserve_duty')) return self.getReserveDuties();
        if (sql.includes('SELECT * FROM payments')) return self.getPayments();
        return [];
      }
    };
  }
}

module.exports = new JSONDatabase();
