const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, '../public')));

// Database
let db;
try {
  db = require('./database-json');
  console.log('Using JSON database');
} catch (err) {
  console.error('שגיאה בטעינת database:', err.message);
  process.exit(1);
}

// ===== API ENDPOINTS =====

// סטטיסטיקות לדשבורד
app.get('/api/stats', (req, res) => {
  try {
    const stats = db.getStats();
    res.json(stats);
  } catch (err) {
    console.error('שגיאה ב-/api/stats:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// קבלת כל העובדים
app.get('/api/employees', (req, res) => {
  try {
    const employees = db.getEmployees();
    res.json(employees);
  } catch (err) {
    console.error('שגיאה ב-/api/employees:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// קבלת עובד בודד
app.get('/api/employees/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const employee = db.getEmployeeById(id);
    if (!employee) return res.status(404).json({ error: 'עובד לא נמצא' });

    const payments = db.getPaymentsByEmployee(id);
    const duties = db.getReserveDuties().filter(d => d.employee_id === id);

    res.json({ ...employee, payments, duties });
  } catch (err) {
    console.error('שגיאה ב-/api/employees/:id:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// עדכון עובד
app.put('/api/employees/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updated = db.updateEmployee(id, req.body);
    if (!updated) return res.status(404).json({ error: 'עובד לא נמצא' });
    res.json({ success: true, employee: updated });
  } catch (err) {
    console.error('שגיאה בעדכון עובד:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// מחיקת עובד
app.delete('/api/employees/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const deleted = db.deleteEmployee(id);
    if (!deleted) return res.status(404).json({ error: 'עובד לא נמצא' });
    res.json({ success: true });
  } catch (err) {
    console.error('שגיאה במחיקת עובד:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ייבוא נתוני קאנו
app.post('/api/import-kano', (req, res) => {
  try {
    const { data } = req.body;

    if (!data || !Array.isArray(data)) {
      return res.status(400).json({ error: 'נתונים לא תקינים' });
    }

    console.log(`\nמייבא ${data.length} רשומות מקאנו...`);

    let importedEmployees = 0;
    let importedDuties = 0;

    data.forEach((row, index) => {
      try {
        const tz = row.tz || row['ת.ז.'] || '';
        const lastName = row.last_name || row['שם משפחה'] || '';
        const firstName = row.first_name || row['שם פרטי'] || '';
        const dutyDate = row.duty_date || row['תאריך'] || '';
        const days = parseInt(row.days || row['ימים'] || 0);
        const dailyRate = parseFloat(row.daily_rate || row['תעריף יומי'] || 500);
        const department = row.department || row['מחלקה'] || '';

        if (!tz || !firstName || !lastName) {
          console.log(`שורה ${index + 1}: חסרים נתונים בסיסיים - מדלג`);
          return;
        }

        // Find or create employee
        let employee = db.findEmployeeByTz(tz);
        let employeeId;

        if (!employee) {
          employee = db.addEmployee({
            tz, last_name: lastName, first_name: firstName,
            daily_rate: dailyRate, department
          });
          importedEmployees++;
        }
        employeeId = employee.id;

        // Add reserve duty record
        if (dutyDate && days > 0) {
          const calculatedAmount = days * dailyRate;
          db.addReserveDuty({
            employee_id: employeeId,
            duty_date: dutyDate,
            days,
            calculated_amount: calculatedAmount
          });
          importedDuties++;
        }

      } catch (rowErr) {
        console.error(`שגיאה בשורה ${index + 1}:`, rowErr.message);
      }
    });

    console.log(`ייבוא הושלם: ${importedEmployees} עובדים חדשים, ${importedDuties} רשומות מילואים`);

    res.json({
      success: true,
      message: `יובאו ${importedEmployees} עובדים חדשים ו-${importedDuties} רשומות מילואים`,
      importedEmployees,
      importedDuties
    });

  } catch (err) {
    console.error('שגיאה בייבוא:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// חודשים זמינים
app.get('/api/available-months', (req, res) => {
  try {
    const months = db.getAvailableMonths();
    res.json(months);
  } catch (err) {
    console.error('שגיאה ב-/api/available-months:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// דוח חודשי
app.get('/api/monthly-report/:month', (req, res) => {
  try {
    const report = db.getMonthlyReport(req.params.month);
    res.json(report);
  } catch (err) {
    console.error('שגיאה ב-/api/monthly-report:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// דוח יומי
app.get('/api/daily-report', (req, res) => {
  try {
    const { from, to } = req.query;
    const report = db.getDailyReport(from, to);
    res.json(report);
  } catch (err) {
    console.error('שגיאה ב-/api/daily-report:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// דוח כולל עם פילטרים
app.get('/api/comprehensive-report', (req, res) => {
  try {
    const filters = {
      employeeId: req.query.employeeId ? parseInt(req.query.employeeId) : null,
      department: req.query.department || null,
      monthFrom: req.query.monthFrom || null,
      monthTo: req.query.monthTo || null,
      status: req.query.status || null
    };
    const report = db.getComprehensiveReport(filters);
    res.json(report);
  } catch (err) {
    console.error('שגיאה ב-/api/comprehensive-report:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// רשימת מחלקות
app.get('/api/departments', (req, res) => {
  try {
    const departments = db.getDepartments();
    res.json(departments);
  } catch (err) {
    console.error('שגיאה ב-/api/departments:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ===== תשלומים =====

// כל התשלומים
app.get('/api/payments', (req, res) => {
  try {
    const payments = db.getPayments();
    const employees = db.getEmployees();

    const enriched = payments.map(p => {
      const emp = employees.find(e => e.id === p.employee_id);
      return {
        ...p,
        employee_name: emp ? `${emp.first_name} ${emp.last_name}` : 'לא ידוע'
      };
    });
    res.json(enriched);
  } catch (err) {
    console.error('שגיאה ב-/api/payments:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// תשלומים לעובד ספציפי
app.get('/api/payments/employee/:employeeId', (req, res) => {
  try {
    const employeeId = parseInt(req.params.employeeId);
    const payments = db.getPaymentsByEmployee(employeeId);
    res.json(payments);
  } catch (err) {
    console.error('שגיאה ב-/api/payments/employee:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// הוספת תשלום
app.post('/api/payments', (req, res) => {
  try {
    const { employee_id, month, amount, payment_date, reference, notes } = req.body;

    if (!employee_id || !amount || !payment_date) {
      return res.status(400).json({ error: 'חסרים שדות חובה: עובד, סכום, תאריך' });
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
    console.error('שגיאה בהוספת תשלום:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// עדכון תשלום
app.put('/api/payments/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updated = db.updatePayment(id, req.body);
    if (!updated) return res.status(404).json({ error: 'תשלום לא נמצא' });
    res.json({ success: true, payment: updated });
  } catch (err) {
    console.error('שגיאה בעדכון תשלום:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// מחיקת תשלום
app.delete('/api/payments/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const deleted = db.deletePayment(id);
    if (!deleted) return res.status(404).json({ error: 'תשלום לא נמצא' });
    res.json({ success: true });
  } catch (err) {
    console.error('שגיאה במחיקת תשלום:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// איפוס מערכת
app.post('/api/reset', (req, res) => {
  try {
    db.reset();
    res.json({ success: true, message: 'המערכת אופסה בהצלחה' });
  } catch (err) {
    console.error('שגיאה באיפוס:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ===== START SERVER =====
app.listen(PORT, () => {
  console.log('');
  console.log('========================================');
  console.log('  מערכת ניהול תשלומי מילואים - ליטאי');
  console.log('========================================');
  console.log('');
  console.log(`השרת פועל: http://localhost:${PORT}`);
  console.log('');
});
