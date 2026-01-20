const db = require('./database');

console.log("=== Debugging NPC Buildings ===");

const users = [17, 18]; // 충청, 전주

users.forEach(userId => {
    const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(userId);
    console.log(`\nUser: ${user ? user.username : 'Unknown'} (ID: ${userId})`);

    const buildings = db.prepare('SELECT id, type, x, y FROM user_buildings WHERE user_id = ?').all(userId);
    console.log(`Buildings (${buildings.length}):`);
    buildings.forEach(b => console.log(` - [${b.type}] at ${b.x}, ${b.y}`));

    const cc = db.prepare(`
        SELECT ub.*, bt.code as bt_code 
        FROM user_buildings ub 
        LEFT JOIN building_types bt ON ub.type = bt.code 
        WHERE ub.user_id = ? AND ub.type = 'COMMAND_CENTER'
    `).get(userId);

    if (cc) {
        console.log(`Command Center Found: ID ${cc.id}, Join Result: ${cc.bt_code ? 'Success' : 'FAIL (No matching building_type)'}`);
    } else {
        console.log("Command Center NOT found via direct query.");
    }
});

console.log("\n=== Checking Building Types ===");
const bt = db.prepare("SELECT * FROM building_types WHERE code = 'COMMAND_CENTER'").get();
console.log(bt ? "COMMAND_CENTER type exists in DB." : "COMMAND_CENTER type MISSING in DB!");
