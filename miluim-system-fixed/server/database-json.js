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
      console.error('❌ שגיאה בטעינת נתונים:', err.message);
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
      console.error('❌ שגיאה בשמירת נתונים:', err.message);
      return false;
    }
  }

  generateId(table) {
    const items = this.data[table];
    if (!items || items.length === 0) return 1;
    const maxId = Math.max(...items.map(item => item.id || 0));
    return maxId + 1;
  }

  prepare(sql) {
    const self = this;
    
    return {
      run: function(...params) {
        try {
          if (sql.includes('INSERT INTO employees')) {
            const [tz, lastName, firstName, dailyRate, monthlyRate, department] = params;
            
            // בדוק אם העובד כבר קיים
            const existing = self.data.employees.find(e => e.tz === tz);
            if (existing) {
              return { lastInsertRowid: existing.id };
            }
            
            const newEmployee = {
              id: self.generateId('employees'),
              tz,
              last_name: lastName,
              first_name: firstName,
              daily_rate: dailyRate,
              monthly_rate: monthlyRate,
              department,
              status: 'active',
              created_date: new Date().toISOString()
            };
            
            self.data.employees.push(newEmployee);
            self.saveData();
            
            console.log(`✅ עובד נוסף: ${firstName} ${lastName} (ID: ${newEmployee.id})`);
            return { lastInsertRowid: newEmployee.id };
          }
          
          else if (sql.includes('INSERT INTO reserve_duty')) {
            const [employeeId, dutyDate, days, calculatedAmount] = params;
            
            const newDuty = {
              id: self.generateId('reserve_duty'),
              employee_id: employeeId,
              duty_date: dutyDate,
              days: days,
              calculated_amount: calculatedAmount,
              submission_status: 'submitted',
              created_date: new Date().toISOString()
            };
            
            self.data.reserve_duty.push(newDuty);
            self.saveData();
            
            return { lastInsertRowid: newDuty.id };
          }
          
          else if (sql.includes('INSERT INTO payments')) {
            const [employeeId, dutyDate, amount, paymentDate] = params;
            
            const newPayment = {
              id: self.generateId('payments'),
              employee_id: employeeId,
              duty_date: dutyDate,
              amount: amount,
              payment_date: paymentDate,
              status: 'received',
              created_date: new Date().toISOString()
            };
            
            self.data.payments.push(newPayment);
            self.saveData();
            
            return { lastInsertRowid: newPayment.id };
          }
          
        } catch (err) {
          console.error('❌ שגיאה ב-run:', err.message);
          throw err;
        }
      },
      
      get: function(...params) {
        try {
          // SELECT COUNT
          if (sql.includes('COUNT(*)') && sql.includes('FROM employees')) {
            return { count: self.data.employees.length };
          }
          
          if (sql.includes('SUM(days)') && sql.includes('FROM reserve_duty')) {
            const totalDays = self.data.reserve_duty.reduce((sum, duty) => sum + (duty.days || 0), 0);
            return { count: totalDays };
          }
          
          if (sql.includes('COUNT(*)') && sql.includes('FROM payments')) {
            const pendingPayments = self.data.payments.filter(p => p.status !== 'paid').length;
            return { count: pendingPayments };
          }
          
          // SELECT employee by tz
          if (sql.includes('SELECT id FROM employees WHERE tz = ?')) {
            const [tz] = params;
            const employee = self.data.employees.find(e => e.tz === tz);
            return employee ? { id: employee.id } : null;
          }
          
          return null;
        } catch (err) {
          console.error('❌ שגיאה ב-get:', err.message);
          return null;
        }
      },
      
      all: function() {
        try {
          if (sql.includes('SELECT * FROM employees')) {
            return self.data.employees.map(emp => {
              const totalDays = self.data.reserve_duty
                .filter(d => d.employee_id === emp.id)
                .reduce((sum, d) => sum + (d.days || 0), 0);
              
              return {
                ...emp,
                total_days: totalDays
              };
            });
          }
          
          if (sql.includes('SELECT * FROM reserve_duty')) {
            return self.data.reserve_duty;
          }
          
          if (sql.includes('SELECT * FROM payments')) {
            return self.data.payments;
          }
          
          return [];
        } catch (err) {
          console.error('❌ שגיאה ב-all:', err.message);
          return [];
        }
      }
    };
  }

  // מחיקת כל הנתונים
  reset() {
    this.data = {
      employees: [],
      reserve_duty: [],
      payments: []
    };
    this.saveData();
    console.log('🗑️ כל הנתונים נמחקו');
  }
}

module.exports = new JSONDatabase();
