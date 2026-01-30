
const db = require('./database');

try {
    const rows = db.prepare('SELECT * FROM internal_building_layouts ORDER BY id DESC LIMIT 5').all();
    console.log("=== Last 5 Internal Layouts ===");
    rows.forEach(row => {
        console.log(`ID: ${row.id}, UserBuildingID: ${row.user_building_id}`);
        console.log(`Data Length: ${row.layout_data.length}`);
        console.log(`Data Preview: ${row.layout_data.substring(0, 100)}...`);
        if (row.layout_data === '[]') console.log("WARNING: Empty Array");
    });

} catch (e) {
    console.error(e);
}
