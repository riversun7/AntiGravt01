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
