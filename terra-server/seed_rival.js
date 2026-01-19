
const db = require('./database');
const UserFactory = require('./src/factories/UserFactory');

function seedRival() {
    console.log('Seeding Rival User and Territory via Factory...');

    try {
        const rivalName = 'Rival_Faction';

        // 1. Check if user exists
        let rival = db.prepare('SELECT * FROM users WHERE username = ?').get(rivalName);

        if (!rival) {
            // Calculated Location
            // Default spawn is Seoul ~37.5665, 126.9780.
            // Place rival 6km away (Lat/Lng approx). 
            const rivalLat = 37.5665 + 0.05; // ~5.5km North
            const rivalLng = 126.9780 + 0.05; // ~4.5km East
            const gridX = Math.floor((rivalLng + 180) / 360 * 160);
            const gridY = Math.floor((90 - rivalLat) / 180 * 80);

            // Create via Factory
            rival = UserFactory.create({
                username: rivalName,
                npcType: 'NONE', // Or ABSOLUTE if it's an NPC
                location: { x: rivalLat, y: rivalLng, world_x: gridX, world_y: gridY },
                resources: { gold: 3000, gem: 100 },
                initialBuilding: { code: 'COMMAND_CENTER' }
            });

            console.log(`Created rival user: ${rivalName} (ID: ${rival.id})`);

            // 2. Create some other buildings (Factory doesn't handle secondary buildings yet, do manual safely)
            // Use 'building_type_code' strictly!
            const buildings = [
                { code: 'BARRACKS', dLat: 0.005, dLng: 0.005 },
                { code: 'MINE', dLat: -0.005, dLng: 0.005 },
                { code: 'WAREHOUSE', dLat: 0, dLng: -0.005 }
            ];

            const insertBldg = db.prepare(`
                INSERT INTO user_buildings (
                    user_id, building_type_code, type, 
                    x, y, world_x, world_y, 
                    is_territory_center, territory_radius, hp
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            buildings.forEach(b => {
                // Fetch default radius from type definition intended? Or just 0 for non-territory?
                insertBldg.run(
                    rival.id,
                    b.code,
                    b.code, // Legacy type fallack
                    rivalLat + b.dLat,
                    rivalLng + b.dLng,
                    gridX, gridY,
                    0, 0, 100
                );
            });
            console.log(`Created ${buildings.length} additional rival buildings.`);

        } else {
            console.log(`Rival user exists: ${rivalName} (ID: ${rival.id}) - Skipping creation.`);
            // Optional: Check/Repair if cyborg missing?
            const cyborg = db.prepare('SELECT id FROM character_cyborg WHERE user_id = ?').get(rival.id);
            if (!cyborg) {
                console.warn(`[WARNING] Rival user exists but has NO CYBORG! Creating fallback...`);
                // This logic mirrors Factory's cyborg creation
                db.prepare(`
                    INSERT INTO character_cyborg (user_id, name, strength, dexterity, constitution, intelligence, wisdom, hp, mp)
                    VALUES (?, ?, 10, 10, 10, 10, 10, 150, 140)
                `).run(rival.id, 'Rival Cyborg');
                console.log("Repaired missing cyborg.");
            }
        }

    } catch (err) {
        console.error('Seed error:', err);
    }
}

seedRival();
