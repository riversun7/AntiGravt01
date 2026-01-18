const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'terra-server', 'db', 'terra.db');
console.log('Opening DB at:', dbPath);

try {
    const db = new Database(dbPath);
    const info = db.pragma('table_info(user_buildings)');
    console.log('Columns in user_buildings:');
    info.forEach(col => console.log(`- ${col.name} (${col.type})`));

    // Check building_types as well
    const btInfo = db.pragma('table_info(building_types)');
    console.log('\nColumns in building_types:');
    btInfo.forEach(col => console.log(`- ${col.name} (${col.type})`));

} catch (e) {
    console.error('Error:', e);
}
