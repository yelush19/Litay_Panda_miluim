const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');
const seed = require('./seed');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, '../public')));

// ===== AUTO-SEED on first run =====
if (db.isEmpty()) {
  console.log('Database is empty - running seed from 2025 data...');
  const data = seed.run();
  if (data) {
    db.bulkLoad(data);
    console.log('Seed complete!');
  }
}

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
    res.json(db.getAvailableMonths(parseInt(req.params.year)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== EMPLOYEES =====

app.get('/api/employees', (req, res) => {
  try {
    const year = req.query.year ? parseInt(req.query.year) : null;
    res.json(year ? db.getEmployeesByYear(year) : db.getEmployees());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/employees', (req, res) => {
  try {
    res.json(db.addEmployee(req.body));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/employees/:id', (req, res) => {
  try {
    const updated = db.updateEmployee(parseInt(req.params.id), req.body);
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/employees/:id', (req, res) => {
  try {
    db.deleteEmployee(parseInt(req.params.id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== SALARY HISTORY =====

app.get('/api/salary-history/:employeeId', (req, res) => {
  try {
    res.json(db.getSalaryHistory(parseInt(req.params.employeeId)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/salary-history', (req, res) => {
  try {
    res.json(db.addSalaryRecord(req.body));
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
    res.json(db.addDuty(req.body));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/duties/:id', (req, res) => {
  try {
    const updated = db.updateDuty(parseInt(req.params.id), req.body);
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/duties/:id', (req, res) => {
  try {
    db.deleteDuty(parseInt(req.params.id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== BL PAYMENTS =====

app.get('/api/bl-payments', (req, res) => {
  try {
    const filters = {};
    if (req.query.employee_id) filters.employee_id = parseInt(req.query.employee_id);
    if (req.query.batch_number) filters.batch_number = req.query.batch_number;
    res.json(db.getBLPayments(filters));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/bl-payments', (req, res) => {
  try {
    res.json(db.addBLPayment(req.body));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/bl-payments/:id', (req, res) => {
  try {
    db.deleteBLPayment(parseInt(req.params.id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== IMPORT =====

// Import Mecano attendance file
app.post('/api/import/mecano', (req, res) => {
  try {
    const { data } = req.body;
    if (!data || !Array.isArray(data)) {
      return res.status(400).json({ error: 'Invalid data' });
    }
    res.json(db.importMecano(data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Import BL payments file
app.post('/api/import/bl', (req, res) => {
  try {
    const { data } = req.body;
    if (!data || !Array.isArray(data)) {
      return res.status(400).json({ error: 'Invalid data' });
    }
    res.json(db.importBLPayments(data));
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

// Re-seed
app.post('/api/reseed', (req, res) => {
  try {
    db.reset();
    const data = seed.run();
    if (data) {
      db.bulkLoad(data);
      res.json({ success: true, message: 'Re-seeded from 2025 data' });
    } else {
      res.json({ success: false, message: '2025 file not found' });
    }
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
