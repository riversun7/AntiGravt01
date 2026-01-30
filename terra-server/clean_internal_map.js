
const db = require('./database');

// Delete entries with empty array data
const result = db.prepare("DELETE FROM internal_building_layouts WHERE layout_data = '[]'").run();
console.log(`Deleted ${result.changes} bad internal map layouts.`);
