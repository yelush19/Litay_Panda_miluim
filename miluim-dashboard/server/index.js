const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, '../public')));

// ===== STATS =====

app.get('/api/stats', (req, res) => {
  try {
    const year = req.query.year ? parseInt(req.query.year) : null;
    res.json(db.getStats(year));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/years', (req, res) => {
  try {
    res.json(db.getAvailableYears());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/months/:year', (req, res) => {
  try {
    const year = parseInt(req.params.year);
    res.json(db.getAvailableMonths(year));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== EMPLOYEES =====

app.get('/api/employees', (req, res) => {
  try {
    const year = req.query.year ? parseInt(req.query.year) : null;
    const employees = year ? db.getEmployeesByYear(year) : db.getEmployees();
    res.json(employees);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/employees', (req, res) => {
  try {
    const emp = db.addEmployee(req.body);
    res.json(emp);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/employees/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updated = db.updateEmployee(id, req.body);
    if (!updated) return res.status(404).json({ error: 'Employee not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/employees/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    db.deleteEmployee(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== DUTIES =====

app.get('/api/duties', (req, res) => {
  try {
    const filters = {};
    if (req.query.year) filters.year = parseInt(req.query.year);
    if (req.query.month) filters.month = parseInt(req.query.month);
    if (req.query.employee_id) filters.employee_id = parseInt(req.query.employee_id);
    res.json(db.getDuties(filters));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/duties', (req, res) => {
  try {
    const duty = db.addDuty(req.body);
    res.json(duty);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/duties/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updated = db.updateDuty(id, req.body);
    if (!updated) return res.status(404).json({ error: 'Duty not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/duties/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    db.deleteDuty(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== PAYMENTS =====

app.get('/api/payments', (req, res) => {
  try {
    const filters = {};
    if (req.query.employee_id) filters.employee_id = parseInt(req.query.employee_id);
    if (req.query.duty_id) filters.duty_id = parseInt(req.query.duty_id);
    res.json(db.getPayments(filters));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/payments', (req, res) => {
  try {
    const payment = db.addPayment(req.body);
    res.json(payment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/payments/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    db.deletePayment(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== IMPORT =====

app.post('/api/import', (req, res) => {
  try {
    const { data } = req.body;
    if (!data || !Array.isArray(data)) {
      return res.status(400).json({ error: 'Invalid data' });
    }
    const result = db.importKanoData(data);
    res.json({
      success: true,
      ...result
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== RESET =====

app.post('/api/reset', (req, res) => {
  try {
    db.reset();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== START =====

app.listen(PORT, () => {
  console.log('');
  console.log('  Litay Miluim Dashboard');
  console.log(`  http://localhost:${PORT}`);
  console.log('');
});
