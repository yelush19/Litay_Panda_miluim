const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

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
  console.log('✅ Using JSON database');
} catch (err) {
  console.error('❌ שגיאה בטעינת database:', err.message);
  process.exit(1);
}

console.log('📊 JSON-based database ready!');
console.log('📁 Data file:', path.join(__dirname, 'miluim-data.json'));
console.log('💾 Database type: JSON');

// ===== API ENDPOINTS =====

// סטטיסטיקות לדשבורד
app.get('/api/stats', (req, res) => {
  try {
    const totalEmployees = db.prepare('SELECT COUNT(*) as count FROM employees').get();
    const totalDays = db.prepare('SELECT SUM(days) as count FROM reserve_duty').get();
    const pendingPayments = db.prepare('SELECT COUNT(*) as count FROM payments WHERE status != ?').get('paid');
    
    res.json({
      totalEmployees: totalEmployees?.count || 0,
      totalDays: totalDays?.count || 0,
      pendingPayments: pendingPayments?.count || 0,
      avgDaysPerEmployee: totalEmployees?.count > 0 
        ? Math.round((totalDays?.count || 0) / totalEmployees.count) 
        : 0
    });
  } catch (err) {
    console.error('❌ שגיאה ב-/api/stats:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// קבלת כל העובדים
app.get('/api/employees', (req, res) => {
  try {
    const employees = db.prepare('SELECT * FROM employees').all();
    res.json(employees);
  } catch (err) {
    console.error('❌ שגיאה ב-/api/employees:', err.message);
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

    console.log(`\n📥 מייבא ${data.length} רשומות מקאנו...`);
    
    let importedEmployees = 0;
    let importedDuties = 0;

    data.forEach((row, index) => {
      try {
        // חילוץ נתונים מהשורה
        const tz = row.tz || row['ת.ז.'] || '';
        const lastName = row.last_name || row['שם משפחה'] || '';
        const firstName = row.first_name || row['שם פרטי'] || '';
        const dutyDate = row.duty_date || row['תאריך'] || '';
        const days = parseInt(row.days || row['ימים'] || 0);
        const dailyRate = parseFloat(row.daily_rate || row['תעריף יומי'] || 500);
        const department = row.department || row['מחלקה'] || '';

        if (!tz || !firstName || !lastName) {
          console.log(`⚠️ שורה ${index + 1}: חסרים נתונים בסיסיים`);
          return;
        }

        // בדוק אם העובד קיים
        let employeeResult = db.prepare('SELECT id FROM employees WHERE tz = ?').get(tz);
        let employeeId;

        if (!employeeResult) {
          // הוסף עובד חדש
          const result = db.prepare(
            'INSERT INTO employees (tz, last_name, first_name, daily_rate, monthly_rate, department) VALUES (?, ?, ?, ?, ?, ?)'
          ).run(tz, lastName, firstName, dailyRate, dailyRate * 22, department);
          
          employeeId = result.lastInsertRowid;
          importedEmployees++;
        } else {
          employeeId = employeeResult.id;
        }

        // הוסף רשומת מילואים
        if (dutyDate && days > 0) {
          const calculatedAmount = days * dailyRate;
          db.prepare(
            'INSERT INTO reserve_duty (employee_id, duty_date, days, calculated_amount) VALUES (?, ?, ?, ?)'
          ).run(employeeId, dutyDate, days, calculatedAmount);
          
          importedDuties++;
        }

      } catch (rowErr) {
        console.error(`❌ שגיאה בשורה ${index + 1}:`, rowErr.message);
      }
    });

    console.log(`✅ ייבוא הושלם: ${importedEmployees} עובדים, ${importedDuties} רשומות מילואים`);

    res.json({
      success: true,
      message: `✅ יובאו ${importedEmployees} עובדים ו-${importedDuties} רשומות מילואים`,
      importedEmployees,
      importedDuties
    });

  } catch (err) {
    console.error('❌ שגיאה בייבוא:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// דוח חודשי
app.get('/api/monthly-report/:month', (req, res) => {
  try {
    const { month } = req.params;
    
    const duties = db.prepare('SELECT * FROM reserve_duty').all();
    const monthlyDuties = duties.filter(d => {
      const dutyMonth = d.duty_date.substring(0, 7); // YYYY-MM
      return dutyMonth === month;
    });

    const employees = db.prepare('SELECT * FROM employees').all();
    
    const report = monthlyDuties.map(duty => {
      const employee = employees.find(e => e.id === duty.employee_id);
      return {
        ...duty,
        employee_name: employee ? `${employee.first_name} ${employee.last_name}` : 'לא ידוע',
        tz: employee?.tz || ''
      };
    });

    res.json(report);
  } catch (err) {
    console.error('❌ שגיאה ב-/api/monthly-report:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// קבלת רשימת חודשים זמינים
app.get('/api/available-months', (req, res) => {
  try {
    const duties = db.prepare('SELECT * FROM reserve_duty').all();
    const months = [...new Set(duties.map(d => d.duty_date.substring(0, 7)))];
    months.sort((a, b) => b.localeCompare(a));
    res.json(months);
  } catch (err) {
    console.error('❌ שגיאה ב-/api/available-months:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ===== START SERVER =====
app.listen(PORT, () => {
  console.log('\n┌────────────────────────────────────────┐');
  console.log('│  🎖️  מערכת ניהול תשלומי מילואים      │');
  console.log('│     מיוחדת לרואה חשבון ליתאי אשטר    │');
  console.log('└────────────────────────────────────────┘');
  console.log('');
  console.log('✅ לנו לעופן תרגום:');
  console.log(`🌐 http://localhost:${PORT}`);
  console.log('');
  console.log('📊 API זכויי!');
  console.log('');
});
