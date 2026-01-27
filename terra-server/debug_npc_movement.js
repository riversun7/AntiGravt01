const db = require('./database');

try {
    console.log("Current Server Time:", new Date().toISOString());

    const npcs = db.prepare(`
        SELECT u.id, u.username, f.name as faction_name, u.destination_pos, u.arrival_time, u.start_pos, u.departure_time
        FROM users u
        JOIN factions f ON u.faction_id = f.id
        WHERE f.type = 'FREE' AND u.faction_rank = 2 AND u.destination_pos IS NOT NULL
    `).all();

    console.log(`Found ${npcs.length} moving Free NPCs:`);
    npcs.forEach(npc => {
        const arrival = new Date(npc.arrival_time);
        const now = new Date();
        const timeLeft = (arrival - now) / 1000;

        console.log(`- [${npc.faction_name}] Dest: ${npc.destination_pos}`);
        console.log(`  Departure: ${npc.departure_time}`);
        console.log(`  Arrival:   ${npc.arrival_time} (${timeLeft.toFixed(1)}s left)`);

        if (timeLeft < 0) {
            console.log("  => SHOULD HAVE ARRIVED!");
        }
    });

} catch (e) {
    console.error("Error:", e);
}
