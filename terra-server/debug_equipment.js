const db = require('./database');

try {
    console.log("Checking 'market_items' table info:");
    const miInfo = db.prepare("PRAGMA table_info(market_items)").all();
    console.table(miInfo);

    console.log("\nChecking 'user_equipment' table info:");
    const ueInfo = db.prepare("PRAGMA table_info(user_equipment)").all();
    console.table(ueInfo);

} catch (e) {
    console.error("Error:", e);
}
