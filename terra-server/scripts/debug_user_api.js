const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, '../../terra-data/db/terra.db');
console.log('Opening DB at:', dbPath);
const db = new Database(dbPath);

try {
    console.log('--- Table List ---');
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log(tables.map(t => t.name));

    console.log('\n--- Checking Tables for /api/user/:id ---');

    // Check users
    const user = db.prepare('SELECT * FROM users WHERE id = 1').get();
    console.log('User 1:', user ? 'Found' : 'Not Found');

    // Check user_resources
    const resources = db.prepare('SELECT * FROM user_resources WHERE user_id = 1').get();
    console.log('Resources:', resources ? 'Found' : 'Not Found');

    // Check character_cyborg
    const cyborg = db.prepare('SELECT * FROM character_cyborg WHERE user_id = 1').get();
    console.log('Cyborg:', cyborg ? 'Found' : 'Not Found');

    // Check user_equipment & market_items JOIN
    console.log('Testing Equipment Join...');
    const equipment = db.prepare(`
        SELECT ue.*, mi.name as item_name, mi.type as item_type, mi.effect
        FROM user_equipment ue
        JOIN market_items mi ON ue.item_id = mi.id
        WHERE ue.user_id = 1
    `).all();
    console.log('Equipment Join:', 'Success', `(Count: ${equipment.length})`);

} catch (e) {
    console.error('SQL Error:', e.message);
}
