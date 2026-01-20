/**
 * @file check_prereq.js
 * @description 특정 건물 타입(AREA_BEACON, CENTRAL_CONTROL_HUB)이 DB에 존재하는지 확인하는 스크립트.
 * @role 데이터 검증 (건물 타입 테이블)
 * @dependencies database.js
 * @status Maintenance (디버깅용)
 */

const db = require('./database');

console.log('Checking AREA_BEACON...');
try {
    const beacon = db.prepare("SELECT * FROM building_types WHERE code = 'AREA_BEACON'").get();
    if (beacon) {
        console.log('AREA_BEACON found:');
        console.log(beacon);
    } else {
        console.log('AREA_BEACON not found in DB.');
    }

    const hub = db.prepare("SELECT * FROM building_types WHERE code = 'CENTRAL_CONTROL_HUB'").get();
    if (hub) {
        console.log('\nCENTRAL_CONTROL_HUB found:');
        console.log(hub);
    }

} catch (e) {
    console.error('Error:', e);
}
