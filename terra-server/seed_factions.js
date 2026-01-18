const path = require('path');
const db = require('./database');

console.log('Connected to database via module');
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
    { faction: 'eu_npc', name: 'London Beacon', x: 51.5074, y: -0.1278, radius: 15.0 },
    { faction: 'eu_npc', name: 'Paris Bastion', x: 48.8566, y: 2.3522, radius: 15.0 },
    { faction: 'eu_npc', name: 'Berlin Bunker', x: 52.5200, y: 13.4050, radius: 15.0 },
    { faction: 'ru_npc', name: 'Moscow Kremlin', x: 55.7558, y: 37.6173, radius: 30.0 },
    { faction: 'empire_npc', name: 'Antarctica Base', x: -82.8628, y: 135.0000, radius: 50.0 }
];

db.transaction(() => {
    // 1. Seed Factions & Capital Users (Absolute)
    for (const f of factions) {
        // Check/Create Faction
        let faction = db.prepare('SELECT id FROM factions WHERE name = ?').get(f.name);
        if (!faction) {
            const info = db.prepare('INSERT INTO factions (name, tag, description, color, type) VALUES (?, ?, ?, ?, ?)')
                .run(f.name, f.username.slice(0, 3).toUpperCase(), f.desc, f.color, 'ABSOLUTE');
            faction = { id: info.lastInsertRowid };
            console.log(`Created Absolute Faction: ${f.name}`);
        }

        // Check/Create Leader User
        let user = db.prepare('SELECT id FROM users WHERE username = ?').get(f.username);
        const personality = f.personality || 'Balanced';
        const tech = f.tech || 'Balanced';

        if (!user) {
            const info = db.prepare('INSERT INTO users (username, password, npc_type, personality, tech_focus, faction_id, faction_rank) VALUES (?, ?, ?, ?, ?, ?, ?)')
                .run(f.username, 'npc_password', 'ABSOLUTE', personality, tech, faction.id, 2); // Rank 2 = Leader
            user = { id: info.lastInsertRowid };
            console.log(`Created Leader User: ${f.username}`);
            db.prepare('INSERT INTO user_resources (user_id, gold, gem) VALUES (?, ?, ?)').run(user.id, 999999, 999999);
        } else {
            // Update existing NPC
            db.prepare('UPDATE users SET faction_id = ?, faction_rank = 2, npc_type = \'ABSOLUTE\' WHERE id = ?').run(faction.id, user.id);
        }

        // Link Leader to Faction
        db.prepare('UPDATE factions SET leader_id = ? WHERE id = ?').run(user.id, faction.id);
        f.id = user.id; // Keep user ID for building ownership
    }

    // 2. Seed Free Factions (Wanderers/Warlords)
    const freeFactions = [
        { name: 'Red Scorpions', username: 'free_scorpion', npc_type: 'FREE', personality: 'Aggressive', tech: 'Military', color: '#FF8800' },
        { name: 'Trade Convoy Alpha', username: 'free_merchant', npc_type: 'FREE', personality: 'Merchant', tech: 'Industrial', color: '#00CCFF' },
        { name: 'Lost Battalion', username: 'free_battalion', npc_type: 'FREE', personality: 'Defensive', tech: 'Military', color: '#555555' }
    ];

    for (const f of freeFactions) {
        // Faction
        let faction = db.prepare('SELECT id FROM factions WHERE name = ?').get(f.name);
        if (!faction) {
            const info = db.prepare('INSERT INTO factions (name, tag, description, color, type) VALUES (?, ?, ?, ?, ?)')
                .run(f.name, f.username.slice(0, 3).toUpperCase(), 'Free Roaming Faction', f.color, 'FREE');
            faction = { id: info.lastInsertRowid };
            console.log(`Created Free Faction: ${f.name}`);
        }

        // Leader User
        let user = db.prepare('SELECT id FROM users WHERE username = ?').get(f.username);
        if (!user) {
            const info = db.prepare('INSERT INTO users (username, password, npc_type, personality, tech_focus, faction_id, faction_rank) VALUES (?, ?, ?, ?, ?, ?, ?)')
                .run(f.username, 'npc_password', 'FREE', f.personality, f.tech, faction.id, 2);
            user = { id: info.lastInsertRowid };

            // Give resources & Outpost
            db.prepare('INSERT INTO user_resources (user_id, gold, gem) VALUES (?, ?, ?)').run(user.id, 3000, 100);

            // Random location (converted to ~Korea region)
            const wx = Math.floor(Math.random() * 20) - 10;
            const wy = Math.floor(Math.random() * 20) - 10;
            const realX = 36.0 + (wx * 0.1);
            const realY = 127.0 + (wy * 0.1);

            // Create COMMAND_CENTER (get radius from building_types)
            const ccType = db.prepare('SELECT territory_radius FROM building_types WHERE code = ?').get('COMMAND_CENTER');
            const ccRadius = ccType ? ccType.territory_radius : 3.0;

            db.prepare(`
                 INSERT INTO user_buildings (user_id, type, x, y, world_x, world_y, is_territory_center, territory_radius, level)
                 VALUES (?, 'COMMAND_CENTER', ?, ?, ?, ?, 1, ?, 1)
             `).run(user.id, realX, realY, wx, wy, ccRadius);
            console.log(`- Established Command Center for ${f.name} at (${realX.toFixed(4)}, ${realY.toFixed(4)})`);

            // Create Cyborg Character
            db.prepare(`
                INSERT INTO character_cyborg (user_id, name, level, strength, dexterity, constitution, agility, intelligence, wisdom, hp, mp)
                VALUES (?, ?, 1, 15, 15, 15, 15, 15, 15, 225, 210)
            `).run(user.id, `${f.name} Commander`);
            console.log(`- Created Cyborg Commander for ${f.name}`);

            // Set initial GPS position to match command center
            db.prepare('UPDATE users SET current_pos = ? WHERE id = ?')
                .run(`${realX}_${realY}`, user.id);
            console.log(`- Set initial GPS to ${realX.toFixed(4)}, ${realY.toFixed(4)}`);

        } else {
            db.prepare('UPDATE users SET faction_id = ?, faction_rank = 2, npc_type = \'FREE\' WHERE id = ?').run(faction.id, user.id);
        }

        db.prepare('UPDATE factions SET leader_id = ? WHERE id = ?').run(user.id, faction.id);
    }

    // 3. Update Capitals (Command Centers)
    const checkBldg = db.prepare('SELECT id FROM user_buildings WHERE user_id = ? AND type = ? AND x = ? AND y = ?');
    const insertBldg = db.prepare(`
        INSERT INTO user_buildings (user_id, type, x, y, world_x, world_y, is_territory_center, territory_radius, level, custom_boundary)
        VALUES (?, 'COMMAND_CENTER', ?, ?, 0, 0, 1, ?, 5, ?)
    `);

    // Polygon for Seoul (Octagon) - Reused
    const seoulBoundary = JSON.stringify([
        [[37.7165, 126.9780], [37.6726, 127.0841], [37.5665, 127.1280], [37.4604, 127.0841],
        [37.4165, 126.9780], [37.4604, 126.8719], [37.5665, 126.8280], [37.6726, 126.8719]]
    ]);

    for (const c of capitals) {
        // Find User ID map
        // Usernames match c.faction (rok_npc, etc)
        const u = db.prepare('SELECT id FROM users WHERE username = ?').get(c.faction);
        if (!u) continue;

        let boundary = (c.faction === 'rok_npc') ? seoulBoundary : null;
        const exists = checkBldg.get(u.id, 'COMMAND_CENTER', c.x, c.y);

        if (!exists) {
            insertBldg.run(u.id, c.x, c.y, c.radius, boundary);
            console.log(`Established ${c.name}`);
        } else {
            // Ensure radius/boundary updates
            if (boundary) db.prepare('UPDATE user_buildings SET custom_boundary = ? WHERE id = ?').run(boundary, exists.id);
        }
    }
})();

console.log('Seeding complete.');
