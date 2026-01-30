
const db = require('./database');

const cc = db.prepare("SELECT * FROM building_types WHERE code = 'COMMAND_CENTER'").get();
console.log("COMMAND_CENTER Config:", cc);

const latest = db.prepare('SELECT * FROM internal_building_layouts ORDER BY id DESC LIMIT 1').get();
if (latest) {
    console.log(`Latest UserBuildingID: ${latest.user_building_id}`);
    console.log(`Data Length: ${latest.layout_data.length}`);
    if (latest.layout_data === '[]') console.log("WARNING: Empty Array");
} else {
    console.log("No internal layouts found.");
}
