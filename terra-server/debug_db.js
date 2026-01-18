const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'db', 'terra.db');
console.log('Opening DB at:', dbPath);

try {
    const db = new Database(dbPath);
    const info = db.pragma('table_info(user_buildings)');
    console.log('Columns in user_buildings:');
    info.forEach(col => console.log(`- ${col.name} (${col.type})`));
} catch (e) {
    console.error('Error:', e);
}
