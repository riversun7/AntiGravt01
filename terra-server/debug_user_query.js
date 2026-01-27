const db = require('./database');

try {
    const userId = 1;
    console.log(`Fetching data for user ${userId}...`);

    // 1. User Basic Info
    let user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    console.log("User:", user ? "Found" : "Not Found");

    if (!user) {
        console.error("User not found!");
        process.exit(1);
    }

    // 2. Resources
    try {
        const resources = db.prepare('SELECT * FROM user_resources WHERE user_id = ?').get(user.id);
        console.log("Resources:", resources ? "Found" : "Not Found");
    } catch (err) {
        console.error("Error fetching resources:", err.message);
    }

    // 3. Stats
    try {
        const stats = db.prepare('SELECT * FROM character_cyborg WHERE user_id = ?').get(user.id);
        console.log("Stats:", stats ? "Found" : "Not Found");
    } catch (err) {
        console.error("Error fetching stats:", err.message);
    }

    // 4. Equipment - THIS IS LIKELY THE PROBLEM
    console.log("Attempting to fetch equipment...");
    try {
        const equipment = db.prepare(`
            SELECT ue.*, mi.name as item_name, mi.category as item_type
            FROM user_equipment ue
            JOIN market_items mi ON ue.item_id = mi.id
            WHERE ue.user_id = ?
        `).all(user.id);
        console.log("Equipment:", equipment.length, "items found");
    } catch (err) {
        console.error("Error fetching equipment:", err);

        // Detailed check if query failed
        console.log("--- Debugging Market Items Schema ---");
        const miInfo = db.prepare("PRAGMA table_info(market_items)").all();
        console.table(miInfo);
    }

} catch (e) {
    console.error("Global Error:", e);
}
