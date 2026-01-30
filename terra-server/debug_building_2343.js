
const db = require('./database');

const id = 2343;
const b = db.prepare('SELECT * FROM user_buildings WHERE id = ?').get(id);
console.log(`Building ${id}:`, b);

if (!b) {
    console.log("Building not found.");
} else {
    console.log(`X: ${b.x}, Y: ${b.y}`);
    if (b.x === undefined || b.y === undefined || b.x === null || b.y === null) {
        console.log("FATAL: Coordinates missing!");
    }
}
