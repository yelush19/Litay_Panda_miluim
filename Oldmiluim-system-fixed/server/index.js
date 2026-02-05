import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Try SQLite first, fallback to JSON
let db;
let dbType = 'unknown';
try {
  const dbModule = await import('./database.js');
  db = dbModule.default;
  dbType = 'SQLite';
  console.log('✅ Using SQLite database');
} catch (error) {
  console.log('⚠️  SQLite not available:', error.message);
  console.log('📦 Using JSON database instead');
  const dbModule = await import('./database-json.js');
  db = dbModule.default;
  dbType = 'JSON';
}

console.log('🗄️  Database type:', dbType);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, '../public')));

// ============ API Routes ============

// קבלת כל העובדים
app.get('/api/employees', (req, res) => {
  try {
    const employees = db.prepare(`
      SELECT 
        e.*,
        COALESCE(SUM(rd.days), 0) as total_days,
        COALESCE(SUM(rd.days) * e.daily_rate, 0) as expected_amount
      FROM employees e
      LEFT JOIN reserve_duty rd ON e.id = rd.employee_id
      GROUP BY e.id
      ORDER BY e.name
    `).all();
    
    res.json(employees);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// הוספת עובד חדש
app.post('/api/employees', (req, res) => {
  try {
    const { name, id_number, department, daily_rate } = req.body;
    
    const stmt = db.prepare(`
      INSERT INTO employees (name, id_number, department, daily_rate)
      VALUES (?, ?, ?, ?)
    `);
    
    const result = stmt.run(name, id_number, department, daily_rate || 0);
    
    res.json({ id: result.lastInsertRowid, message: 'עובד נוסף בהצלחה' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// עדכון עובד
app.put('/api/employees/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, id_number, department, daily_rate } = req.body;
    
    const stmt = db.prepare(`
      UPDATE employees 
      SET name = ?, id_number = ?, department = ?, daily_rate = ?
      WHERE id = ?
    `);
    
    stmt.run(name, id_number, department, daily_rate, id);
    
    res.json({ message: 'עובד עודכן בהצלחה' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// מחיקת עובד
app.delete('/api/employees/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    // מחיקת נתוני מילואים
    db.prepare('DELETE FROM reserve_duty WHERE employee_id = ?').run(id);
    
    // מחיקת תשלומים
    db.prepare('DELETE FROM payments WHERE employee_id = ?').run(id);
    
    // מחיקת עובד
    db.prepare('DELETE FROM employees WHERE id = ?').run(id);
    
    res.json({ message: 'עובד נמחק בהצלחה' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ייבוא נתוני מילואים מקאנו
app.post('/api/import-kano', (req, res) => {
  try {
    const { data } = req.body; // מערך של רשומות
    
    if (!data || !Array.isArray(data)) {
      return res.status(400).json({ error: 'Invalid data format' });
    }
    
    const insertEmployee = db.prepare(`
      INSERT OR IGNORE INTO employees (name, department, daily_rate)
      VALUES (?, ?, 0)
    `);
    
    const getEmployee = db.prepare('SELECT id FROM employees WHERE name = ?');
    
    const insertDuty = db.prepare(`
      INSERT INTO reserve_duty (employee_id, duty_date, department, days)
      VALUES (?, ?, ?, ?)
    `);
    
    let imported = 0;
    let newEmployees = 0;
    
    // יצירת transaction
    const transaction = db.transaction ? db.transaction((records) => {
      for (const record of records) {
        if (!record.employee || !record.date) continue;
        
        // הוספת עובד אם לא קיים
        const result = insertEmployee.run(record.employee, record.department);
        if (result.changes > 0) newEmployees++;
        
        // קבלת ID עובד
        const employee = getEmployee.get(record.employee);
        if (!employee) continue;
        
        // הוספת יום מילואים
        insertDuty.run(employee.id, record.date, record.department, record.days || 1);
        imported++;
      }
    }) : null;
    
    // הרצת transaction או לולאה רגילה
    if (transaction) {
      transaction(data);
    } else {
      // Fallback ללא transaction
      for (const record of data) {
        if (!record.employee || !record.date) continue;
        
        const result = insertEmployee.run(record.employee, record.department);
        if (result.changes > 0) newEmployees++;
        
        const employee = getEmployee.get(record.employee);
        if (!employee) continue;
        
        insertDuty.run(employee.id, record.date, record.department, record.days || 1);
        imported++;
      }
    }
    
    res.json({ 
      message: 'ייבוא הושלם בהצלחה',
      imported,
      newEmployees
    });
  } catch (error) {
    console.error('שגיאה בייבוא:', error);
    res.status(500).json({ error: error.message });
  }
});

// דוח חודשי
app.get('/api/monthly-report/:month', (req, res) => {
  try {
    const { month } = req.params; // פורמט: YYYY-MM
    
    const report = db.prepare(`
      SELECT 
        e.id,
        e.name,
        e.department,
        e.daily_rate,
        MIN(rd.duty_date) as start_date,
        MAX(rd.duty_date) as end_date,
        SUM(rd.days) as total_days,
        SUM(rd.days) as work_days,
        SUM(rd.days) * e.daily_rate as expected_amount
      FROM employees e
      JOIN reserve_duty rd ON e.id = rd.employee_id
      WHERE strftime('%Y-%m', rd.duty_date) = ?
      GROUP BY e.id
      ORDER BY e.name
    `).all(month);
    
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// רשימת חודשים זמינים
app.get('/api/available-months', (req, res) => {
  try {
    const months = db.prepare(`
      SELECT DISTINCT strftime('%Y-%m', duty_date) as month
      FROM reserve_duty
      ORDER BY month DESC
    `).all();
    
    res.json(months.map(m => m.month));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// קבלת תשלומים
app.get('/api/payments', (req, res) => {
  try {
    const payments = db.prepare(`
      SELECT 
        p.*,
        e.name as employee_name
      FROM payments p
      JOIN employees e ON p.employee_id = e.id
      ORDER BY p.month DESC, e.name
    `).all();
    
    res.json(payments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// הוספת/עדכון תשלום
app.post('/api/payments', (req, res) => {
  try {
    const { employee_id, month, received_amount, payment_date, notes } = req.body;
    
    // חישוב סכום צפוי
    const expected = db.prepare(`
      SELECT SUM(rd.days) * e.daily_rate as expected
      FROM reserve_duty rd
      JOIN employees e ON rd.employee_id = e.id
      WHERE e.id = ? AND strftime('%Y-%m', rd.duty_date) = ?
    `).get(employee_id, month);
    
    const expectedAmount = expected?.expected || 0;
    const difference = expectedAmount - (received_amount || 0);
    
    let status = 'pending';
    if (received_amount >= expectedAmount) status = 'paid';
    else if (received_amount > 0) status = 'partial';
    
    const stmt = db.prepare(`
      INSERT INTO payments (employee_id, month, expected_amount, received_amount, difference, payment_date, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(employee_id, month) DO UPDATE SET
        received_amount = ?,
        difference = ?,
        payment_date = ?,
        status = ?,
        notes = ?
    `);
    
    stmt.run(
      employee_id, month, expectedAmount, received_amount, difference, payment_date, status, notes,
      received_amount, difference, payment_date, status, notes
    );
    
    res.json({ message: 'תשלום עודכן בהצלחה', difference });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// סטטיסטיקות לדשבורד
app.get('/api/stats', (req, res) => {
  try {
    const totalEmployees = db.prepare('SELECT COUNT(*) as count FROM employees').get().count;
    const totalDaysResult = db.prepare('SELECT COALESCE(SUM(days), 0) as count FROM reserve_duty').get();
    const totalDays = totalDaysResult ? totalDaysResult.count : 0;
    const pendingPaymentsResult = db.prepare("SELECT COUNT(*) as count FROM payments WHERE status != 'paid'").get();
    const pendingPayments = pendingPaymentsResult ? pendingPaymentsResult.count : 0;
    const totalPendingResult = db.prepare("SELECT COALESCE(SUM(difference), 0) as amount FROM payments WHERE status != 'paid'").get();
    const totalPending = totalPendingResult ? totalPendingResult.amount : 0;
    
    const stats = {
      totalEmployees,
      totalDays,
      pendingPayments,
      totalPending
    };
    
    res.json(stats);
  } catch (error) {
    console.error('שגיאה בטעינת סטטיסטיקות:', error);
    res.status(500).json({ error: error.message });
  }
});

// ניקוי כל הנתונים (לפיתוח)
app.delete('/api/reset', (req, res) => {
  try {
    db.exec(`
      DELETE FROM payments;
      DELETE FROM reserve_duty;
      DELETE FROM employees;
    `);
    res.json({ message: 'כל הנתונים נמחקו' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// הגשת index.html
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, '../public/index.html'));
});

// הפעלת שרת
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║   🎖️  מערכת ניהול תשלומי מילואים      ║
║   ליטאי ניהול שירותים                 ║
╠════════════════════════════════════════╣
║   ✅ השרת פועל על:                    ║
║   🌐 http://localhost:${PORT}            ║
║                                        ║
║   📊 API מוכן!                         ║
╚════════════════════════════════════════╝
  `);
});
