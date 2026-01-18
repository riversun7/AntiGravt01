const db = require('./database');

try {
    const info = db.pragma('table_info(user_buildings)');
    console.log('Columns in user_buildings:');
    info.forEach(col => console.log(`- ${col.name} (${col.type})`));
} catch (e) {
    console.error('Error:', e);
}
