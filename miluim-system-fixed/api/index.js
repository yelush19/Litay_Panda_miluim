const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Database
const db = require('../server/database-json');

// ===== API ENDPOINTS =====

app.get('/api/stats', (req, res) => {
  try {
    res.json(db.getStats());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/employees', (req, res) => {
  try {
    res.json(db.getEmployees());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/employees/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const employee = db.getEmployeeById(id);
    if (!employee) return res.status(404).json({ error: 'עובד לא נמצא' });
    const payments = db.getPaymentsByEmployee(id);
    const duties = db.getReserveDuties().filter(d => d.employee_id === id);
    res.json({ ...employee, payments, duties });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/employees/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updated = db.updateEmployee(id, req.body);
    if (!updated) return res.status(404).json({ error: 'עובד לא נמצא' });
    res.json({ success: true, employee: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/employees/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const deleted = db.deleteEmployee(id);
    if (!deleted) return res.status(404).json({ error: 'עובד לא נמצא' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/import-kano', (req, res) => {
  try {
    const { data } = req.body;
    if (!data || !Array.isArray(data)) {
      return res.status(400).json({ error: 'נתונים לא תקינים' });
    }

    let importedEmployees = 0;
    let importedDuties = 0;

    data.forEach((row) => {
      try {
        const tz = row.tz || row['ת.ז.'] || '';
        const lastName = row.last_name || row['שם משפחה'] || '';
        const firstName = row.first_name || row['שם פרטי'] || '';
        const dutyDate = row.duty_date || row['תאריך'] || '';
        const days = parseInt(row.days || row['ימים'] || 0);
        const dailyRate = parseFloat(row.daily_rate || row['תעריף יומי'] || 500);
        const department = row.department || row['מחלקה'] || '';

        if (!tz || !firstName || !lastName) return;

        let employee = db.findEmployeeByTz(tz);
        if (!employee) {
          employee = db.addEmployee({ tz, last_name: lastName, first_name: firstName, daily_rate: dailyRate, department });
          importedEmployees++;
        }

        if (dutyDate && days > 0) {
          db.addReserveDuty({ employee_id: employee.id, duty_date: dutyDate, days, calculated_amount: days * dailyRate });
          importedDuties++;
        }
      } catch (rowErr) {
        // skip bad rows
      }
    });

    res.json({
      success: true,
      message: `יובאו ${importedEmployees} עובדים חדשים ו-${importedDuties} רשומות מילואים`,
      importedEmployees,
      importedDuties
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/available-months', (req, res) => {
  try {
    res.json(db.getAvailableMonths());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/monthly-report/:month', (req, res) => {
  try {
    res.json(db.getMonthlyReport(req.params.month));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/daily-report', (req, res) => {
  try {
    const { from, to } = req.query;
    res.json(db.getDailyReport(from, to));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/comprehensive-report', (req, res) => {
  try {
    const filters = {
      employeeId: req.query.employeeId ? parseInt(req.query.employeeId) : null,
      department: req.query.department || null,
      monthFrom: req.query.monthFrom || null,
      monthTo: req.query.monthTo || null,
      status: req.query.status || null
    };
    res.json(db.getComprehensiveReport(filters));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/departments', (req, res) => {
  try {
    res.json(db.getDepartments());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/payments', (req, res) => {
  try {
    const payments = db.getPayments();
    const employees = db.getEmployees();
    const enriched = payments.map(p => {
      const emp = employees.find(e => e.id === p.employee_id);
      return { ...p, employee_name: emp ? `${emp.first_name} ${emp.last_name}` : 'לא ידוע' };
    });
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/payments/employee/:employeeId', (req, res) => {
  try {
    res.json(db.getPaymentsByEmployee(parseInt(req.params.employeeId)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/payments', (req, res) => {
  try {
    const { employee_id, month, amount, payment_date, reference, notes } = req.body;
    if (!employee_id || !amount || !payment_date) {
      return res.status(400).json({ error: 'חסרים שדות חובה' });
    }
    const payment = db.addPayment({
      employee_id: parseInt(employee_id),
      month: month || '',
      amount: parseFloat(amount),
      payment_date,
      reference: reference || '',
      notes: notes || ''
    });
    res.json({ success: true, payment });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/payments/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updated = db.updatePayment(id, req.body);
    if (!updated) return res.status(404).json({ error: 'תשלום לא נמצא' });
    res.json({ success: true, payment: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/payments/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const deleted = db.deletePayment(id);
    if (!deleted) return res.status(404).json({ error: 'תשלום לא נמצא' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/reset', (req, res) => {
  try {
    db.reset();
    res.json({ success: true, message: 'המערכת אופסה בהצלחה' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = app;
