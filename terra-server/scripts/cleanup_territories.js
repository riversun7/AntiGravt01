/**
 * @file cleanup_territories.js
 * @description 중복되거나 너무 가까운 커맨드 센터(영토 중심)를 정리하는 유틸리티 스크립트
 * @role 데이터 무결성 유지, 버그 수정 (중복 생성된 영토 제거)
 * @dependencies database.js
 * @status Maintenance (수동 실행용)
 * 
 * @analysis
 * - 5km 반경 내에 다른 유저의 커맨드 센터가 있으면 나중에 생성된 것을 제거합니다.
 * - 초기 개발 단계에서 중복 생성 버그로 인해 발생한 데이터를 정리할 때 사용합니다.
 */

const db = require('./database');

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

// db.close(); // Database module manages connection

