const db = require('./database');

try {
    console.log("Resetting NPC movement data...");

    const result = db.prepare(`
        UPDATE users 
        SET destination_pos = NULL, start_pos = NULL, arrival_time = NULL, departure_time = NULL
        WHERE id IN (
            SELECT u.id 
            FROM users u
            JOIN factions f ON u.faction_id = f.id
            WHERE f.type IN ('FREE', 'ABSOLUTE')
        )
    `).run();

    console.log(`Reset movement for ${result.changes} NPCs.`);

} catch (e) {
    console.error("Error:", e);
}
