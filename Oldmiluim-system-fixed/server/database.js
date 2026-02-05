import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const db = new Database(join(__dirname, 'miluim.db'));

// יצירת טבלאות
db.exec(`
  -- טבלת עובדים
  CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    id_number TEXT UNIQUE,
    department TEXT,
    daily_rate REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- טבלת ימי מילואים
  CREATE TABLE IF NOT EXISTS reserve_duty (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    duty_date DATE NOT NULL,
    department TEXT,
    days INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id)
  );

  -- טבלת תשלומים
  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    month TEXT NOT NULL,
    expected_amount REAL DEFAULT 0,
    received_amount REAL DEFAULT 0,
    difference REAL DEFAULT 0,
    payment_date DATE,
    status TEXT DEFAULT 'pending',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id)
  );

  -- אינדקסים לחיפוש מהיר
  CREATE INDEX IF NOT EXISTS idx_reserve_duty_employee ON reserve_duty(employee_id);
  CREATE INDEX IF NOT EXISTS idx_reserve_duty_date ON reserve_duty(duty_date);
  CREATE INDEX IF NOT EXISTS idx_payments_employee ON payments(employee_id);
  CREATE INDEX IF NOT EXISTS idx_payments_month ON payments(month);
`);

console.log('✅ בסיס נתונים הוקם בהצלחה!');

export default db;
