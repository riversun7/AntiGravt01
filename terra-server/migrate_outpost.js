const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'db', 'terra.db');
const db = new Database(dbPath);

console.log('Migrating OUTPOST buildings to AREA_BEACON...');

try {
    const result = db.prepare(`
        UPDATE user_buildings 
        SET type = 'AREA_BEACON', building_type_code = 'AREA_BEACON' 
        WHERE type = 'OUTPOST' OR building_type_code = 'OUTPOST'
    `).run();

    console.log(`Migrated ${result.changes} buildings.`);

    // Validate
    const remaining = db.prepare("SELECT count(*) as count FROM user_buildings WHERE type = 'OUTPOST'").get();
    console.log(`Remaining OUTPOSTs: ${remaining.count}`);

} catch (err) {
    console.error('Migration error:', err);
}

db.close();
