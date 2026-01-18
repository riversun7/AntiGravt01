const Database = require('better-sqlite3');
const path = require('path');

// Open the database
const dbPath = path.join(__dirname, 'db', 'terra.db');
const db = new Database(dbPath);

console.log('=== Territory Cleanup Script ===\n');

// Helper function to calculate distance
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function deg2rad(deg) {
    return deg * (Math.PI / 180);
}

// Find and remove overlapping command centers (within 5km of each other)
console.log('Step: Removing overlapping command centers...');
const commandCenters = db.prepare(`
    SELECT id, user_id, x, y, territory_radius, type, building_type_code
    FROM user_buildings
    WHERE (type = 'COMMAND_CENTER' OR building_type_code = 'COMMAND_CENTER')
    AND is_territory_center = 1
    ORDER BY id ASC
`).all();

console.log(`Found ${commandCenters.length} command centers`);

const toRemove = new Set();
const kept = [];

for (let i = 0; i < commandCenters.length; i++) {
    if (toRemove.has(commandCenters[i].id)) continue;

    const cc1 = commandCenters[i];
    kept.push(cc1);

    for (let j = i + 1; j < commandCenters.length; j++) {
        if (toRemove.has(commandCenters[j].id)) continue;

        const cc2 = commandCenters[j];
        const dist = getDistanceFromLatLonInKm(cc1.x, cc1.y, cc2.x, cc2.y);

        // If within 5km and different users, mark the later one for removal
        if (dist < 5.0 && String(cc1.user_id) !== String(cc2.user_id)) {
            console.log(`  - Found overlap: CC ${cc1.id} (User ${cc1.user_id}) and CC ${cc2.id} (User ${cc2.user_id}) - Distance: ${dist.toFixed(2)}km`);
            console.log(`    Removing CC ${cc2.id} (later)`);
            toRemove.add(cc2.id);
        }
    }
}

if (toRemove.size > 0) {
    const deleteCC = db.prepare('DELETE FROM user_buildings WHERE id = ?');
    toRemove.forEach(id => {
        deleteCC.run(id);
    });
    console.log(`Removed ${toRemove.size} overlapping command centers.\n`);
} else {
    console.log('No overlapping command centers found.\n');
}

// Summary
console.log('=== Cleanup Summary ===');
console.log(`- Overlapping CCs removed: ${toRemove.size}`);
console.log(`- Remaining command centers: ${kept.length}`);

const finalCount = db.prepare(`
    SELECT COUNT(*) as count 
    FROM user_buildings 
    WHERE (type = 'COMMAND_CENTER' OR building_type_code = 'COMMAND_CENTER')
    AND is_territory_center = 1
`).get();

console.log(`- Final CC count in DB: ${finalCount.count}`);
console.log('\n=== Cleanup Complete ===');

db.close();

