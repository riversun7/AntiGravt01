const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'db', 'terra.db');
const db = new Database(dbPath);

console.log('Adding last_maintenance_at column...');
try {
    // SQLite doesn't support dynamic defaults in ALTER TABLE
    db.prepare('ALTER TABLE user_buildings ADD COLUMN last_maintenance_at DATETIME DEFAULT NULL').run();
    console.log('Success: Added last_maintenance_at column.');
} catch (e) {
    console.error('Error:', e);
}
