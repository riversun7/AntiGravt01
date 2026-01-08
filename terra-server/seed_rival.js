
const db = require('./database');

function seedRival() {
    console.log('Seeding Rival User and Territory...');

    try {
        // 1. Create Rival User (if not exists)
        const rivalName = 'Rival_Faction';
        let rival = db.prepare('SELECT * FROM users WHERE username = ?').get(rivalName);

        if (!rival) {
            const info = db.prepare("INSERT INTO users (username, password, role) VALUES (?, ?, ?)").run(rivalName, '1234', 'user');
            rival = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
            console.log(`Created rival user: ${rivalName} (ID: ${rival.id})`);

            // Init resources
            db.prepare('INSERT INTO user_resources (user_id, gold, gem) VALUES (?, ?, ?)').run(rival.id, 10000, 1000);
        } else {
            console.log(`Rival user exists: ${rivalName} (ID: ${rival.id})`);
        }

        // 2. Clear existing buildings for rival (to avoid duplicates/clutter)
        db.prepare('DELETE FROM user_buildings WHERE user_id = ?').run(rival.id);

        // 3. Create Command Center (Territory)
        // Default spawn is Seoul ~37.5665, 126.9780.
        // Place rival 6km away (Lat/Lng approx). 
        // 1 degree lat ~ 111km. 0.05 degree ~ 5.5km.
        const rivalLat = 37.5665 + 0.05; // ~5.5km North
        const rivalLng = 126.9780 + 0.05; // ~4.5km East

        // Grid coords
        const gridX = Math.floor((rivalLng + 180) / 360 * 160);
        const gridY = Math.floor((90 - rivalLat) / 180 * 80);

        const cc = db.prepare(`
            INSERT INTO user_buildings (
                user_id, type, x, y, world_x, world_y, is_territory_center, territory_radius
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(rival.id, 'COMMAND_CENTER', rivalLat, rivalLng, gridX, gridY, 1, 5.0);

        console.log(`Created Rival Command Center at [${rivalLat.toFixed(4)}, ${rivalLng.toFixed(4)}]`);

        // 4. Create some other buildings inside their territory
        const buildings = [
            { type: 'BARRACKS', dLat: 0.005, dLng: 0.005 },
            { type: 'MINE', dLat: -0.005, dLng: 0.005 },
            { type: 'WAREHOUSE', dLat: 0, dLng: -0.005 }
        ];

        buildings.forEach(b => {
            db.prepare(`
                INSERT INTO user_buildings (
                    user_id, type, x, y, world_x, world_y, is_territory_center, territory_radius
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run(rival.id, b.type, rivalLat + b.dLat, rivalLng + b.dLng, gridX, gridY, 0, 0);
        });

        console.log(`Created ${buildings.length} rival buildings.`);

    } catch (err) {
        console.error('Seed error:', err);
    }
}

seedRival();
