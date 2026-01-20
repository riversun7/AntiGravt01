const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, '../../terra-data/db/terra.db');
console.log('Migrating DB at:', dbPath);
const db = new Database(dbPath);

try {
    // Check if column exists
    const tableInfo = db.pragma('table_info(market_items)');
    const hasEffect = tableInfo.some(col => col.name === 'effect');

    if (hasEffect) {
        console.log('Column "effect" already exists in market_items.');
    } else {
        console.log('Adding "effect" column...');
        db.prepare('ALTER TABLE market_items ADD COLUMN effect TEXT').run();
        console.log('Success: Column added.');
    }
} catch (e) {
    console.error('Migration Failed:', e.message);
}
