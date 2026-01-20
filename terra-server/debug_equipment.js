const db = require('./database');

try {
    console.log("Checking 'user_equipment' table info:");
    const ueInfo = db.prepare("PRAGMA table_info(user_equipment)").all();
    console.table(ueInfo);

    console.log("\nChecking 'market_items' table info:");
    const miInfo = db.prepare("PRAGMA table_info(market_items)").all();
    console.table(miInfo);

    console.log("\nTrying to fetch equipment for user 1:");
    const equipment = db.prepare(`
        SELECT ue.*, mi.name as item_name, mi.type as item_type, mi.effect
        FROM user_equipment ue
        JOIN market_items mi ON ue.item_id = mi.id
        WHERE ue.user_id = 1
    `).all();
    console.log("Equipment:", equipment);

} catch (e) {
    console.error("Error:", e);
}
