const Database = require('better-sqlite3');
const path = require('path');

// Match database.js path logic
const dbPath = path.join(__dirname, '..', 'terra-data', 'db', 'terra.db');
const db = new Database(dbPath);

console.log('Connected to:', dbPath);
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('Tables:', tables.map(t => t.name));

console.log('Seeding NPC Factions and Capitals...');

const factions = [
    { name: 'The Empire (NPC)', username: 'empire_npc', desc: 'Global Hegemony', color: '#FF0000' },
    { name: 'Republic of Korea (NPC)', username: 'rok_npc', desc: 'Peninsula Defenders', color: '#0000FF' },
    { name: 'Neo Tokyo (NPC)', username: 'japan_npc', desc: 'Tech Giants', color: '#FFFF00' },
    { name: 'Dragon Dynasty (NPC)', username: 'china_npc', desc: 'Eastern Power', color: '#FF0000' },
    { name: 'Liberty Union (NPC)', username: 'usa_npc', desc: 'Western Alliance', color: '#0000FF' },
    { name: 'European Federation (NPC)', username: 'eu_npc', desc: 'Old World Coalition', color: '#00FF00' },
    { name: 'Slavic Bloc (NPC)', username: 'ru_npc', desc: 'Northern Bears', color: '#FF00FF' }
];

const capitals = [
    { faction: 'rok_npc', name: 'Seoul Command', x: 37.5665, y: 126.9780, radius: 25.0 }, // Larger radius for capitals
    { faction: 'japan_npc', name: 'Tokyo Fortress', x: 35.6762, y: 139.6503, radius: 25.0 },
    { faction: 'china_npc', name: 'Beijing Citadel', x: 39.9042, y: 116.4074, radius: 30.0 },
    { faction: 'usa_npc', name: 'Washington HQ', x: 38.9072, y: -77.0369, radius: 30.0 },
    { faction: 'eu_npc', name: 'London Outpost', x: 51.5074, y: -0.1278, radius: 15.0 },
    { faction: 'eu_npc', name: 'Paris Bastion', x: 48.8566, y: 2.3522, radius: 15.0 },
    { faction: 'eu_npc', name: 'Berlin Bunker', x: 52.5200, y: 13.4050, radius: 15.0 },
    { faction: 'ru_npc', name: 'Moscow Kremlin', x: 55.7558, y: 37.6173, radius: 30.0 },
    { faction: 'empire_npc', name: 'Antarctica Base', x: -82.8628, y: 135.0000, radius: 50.0 }
];

db.transaction(() => {
    // 1. Update/Create Users with NPC Type
    for (const f of factions) {
        let user = db.prepare('SELECT id FROM users WHERE username = ?').get(f.username);
        if (!user) {
            const info = db.prepare('INSERT INTO users (username, password, npc_type) VALUES (?, ?, ?)')
                .run(f.username, 'npc_password', 'ABSOLUTE');
            user = { id: info.lastInsertRowid };
            console.log(`Created faction user: ${f.name}`);
            db.prepare('INSERT INTO user_resources (user_id, gold, gem) VALUES (?, ?, ?)').run(user.id, 999999, 999999);
        } else {
            // Update existing NPC to ABSOLUTE
            db.prepare('UPDATE users SET npc_type = \'ABSOLUTE\' WHERE id = ?').run(user.id);
            console.log(`Updated faction user type: ${f.name}`);
        }
        f.id = user.id;
    }

    // 2. Update Capitals (Command Centers)
    const checkBldg = db.prepare('SELECT id FROM user_buildings WHERE user_id = ? AND type = ? AND x = ? AND y = ?');
    const insertBldg = db.prepare(`
        INSERT INTO user_buildings (user_id, type, x, y, world_x, world_y, is_territory_center, territory_radius, level, custom_boundary)
        VALUES (?, 'COMMAND_CENTER', ?, ?, 0, 0, 1, ?, 5, ?)
    `);
    const updateBoundary = db.prepare('UPDATE user_buildings SET custom_boundary = ? WHERE id = ?');

    // Polygon for Seoul (Octagon)
    // Center: 37.5665, 126.9780, Radius ~0.15
    const seoulBoundary = JSON.stringify([
        [
            [37.7165, 126.9780], // N
            [37.6726, 127.0841], // NE
            [37.5665, 127.1280], // E
            [37.4604, 127.0841], // SE
            [37.4165, 126.9780], // S
            [37.4604, 126.8719], // SW
            [37.5665, 126.8280], // W
            [37.6726, 126.8719]  // NW
        ]
    ]);

    for (const c of capitals) {
        const faction = factions.find(f => f.username === c.faction);
        if (!faction) {
            console.log("Faction not found for", c.faction);
            continue;
        }

        let boundary = null;
        if (c.faction === 'rok_npc') boundary = seoulBoundary;

        const exists = checkBldg.get(faction.id, 'COMMAND_CENTER', c.x, c.y);
        // console.log(`Checking ${c.name}: Exists? ${!!exists}`);

        if (!exists) {
            insertBldg.run(faction.id, c.x, c.y, c.radius, boundary);
            console.log(`Established ${c.name} at ${c.x}, ${c.y}`);
        } else {
            // Update boundary if specific city
            if (boundary) {
                console.log(`Updating boundary for ${c.name}, ID: ${exists.id}`);
                const res = updateBoundary.run(boundary, exists.id);
                console.log(`Changes: ${res.changes}`);
            } else {
                // Ensure radius is set even if not boundary
                db.prepare('UPDATE user_buildings SET territory_radius = ? WHERE id = ?').run(c.radius, exists.id);
            }
        }
    }
})();

console.log('Seeding complete.');
