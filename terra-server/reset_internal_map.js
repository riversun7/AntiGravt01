
const db = require('./database');

const buildingId = 2344;
// Also checking 2343 just in case, but logs say 2344 is active
const ids = [2343, 2344];

console.log(`Resetting layouts for: ${ids.join(', ')}`);

const stmt = db.prepare('DELETE FROM internal_building_layouts WHERE user_building_id = ?');

let count = 0;
ids.forEach(id => {
    const info = stmt.run(id);
    count += info.changes;
});

console.log(`Deleted ${count} internal map layouts.`);
