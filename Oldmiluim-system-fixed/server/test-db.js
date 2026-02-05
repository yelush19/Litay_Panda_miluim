import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🧪 Testing database connection...\n');

// Try SQLite
console.log('1️⃣ Testing SQLite...');
try {
  const { default: dbSqlite } = await import('./database.js');
  console.log('   ✅ SQLite loaded successfully');
  
  const result = dbSqlite.prepare('SELECT COUNT(*) as count FROM employees').get();
  console.log('   ✅ SQLite query works! Employees:', result.count);
} catch (error) {
  console.log('   ❌ SQLite failed:', error.message);
}

console.log('\n2️⃣ Testing JSON database...');
try {
  const { default: dbJson } = await import('./database-json.js');
  console.log('   ✅ JSON database loaded successfully');
  
  const result = dbJson.prepare('SELECT COUNT(*) as count FROM employees').get();
  console.log('   ✅ JSON query works! Employees:', result.count);
} catch (error) {
  console.log('   ❌ JSON database failed:', error.message);
  console.log('   📋 Full error:', error);
}

console.log('\n✅ Database test complete!');
