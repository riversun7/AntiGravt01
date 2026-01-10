const db = require('../database');

class FreeNpcManager {
    run() {
        console.log('[FreeNPC] Running Free Faction Logic...');
        // Join users with factions to get only Free Faction Leaders (Rank 2)
        const npcs = db.prepare(`
            SELECT u.*, f.name as faction_name 
            FROM users u
            JOIN factions f ON u.faction_id = f.id
            WHERE f.type = 'FREE' AND u.faction_rank = 2
        `).all();

        npcs.forEach(npc => {
            this.collectResources(npc);
            this.developTerritory(npc);
            this.attemptExpansion(npc);
        });
    }

    collectResources(npc) {
        // Find all buildings and collect
        const buildings = db.prepare('SELECT * FROM user_buildings WHERE user_id = ?').all(npc.id);
        const now = new Date();
        let collectedGold = 0;

        const tx = db.transaction(() => {
            buildings.forEach(b => {
                const lastCollected = new Date(b.last_collected_at);
                const diffMs = now - lastCollected;
                const diffMins = Math.floor(diffMs / 60000);

                if (diffMins > 0) {
                    // Logic similar to server.js /collect
                    // Simplified for NPC: Just add Gold + fake items
                    if (b.type === 'HOUSE') collectedGold += 10 * diffMins;
                    else if (b.type === 'FACTORY') collectedGold += 50 * diffMins;
                    else if (b.type === 'MINE') collectedGold += 30 * diffMins;
                    else if (b.type === 'FARM') collectedGold += 20 * diffMins;

                    db.prepare('UPDATE user_buildings SET last_collected_at = ? WHERE id = ?').run(now.toISOString(), b.id);
                }
            });

            if (collectedGold > 0) {
                db.prepare('UPDATE user_resources SET gold = gold + ? WHERE user_id = ?').run(collectedGold, npc.id);
                // console.log(`[FreeNPC] ${npc.username} collected ${collectedGold} Gold`);
            }
        });
        tx();
    }

    developTerritory(npc) {
        // 1. Find all territory centers (Outposts/Command Centers)
        const territories = db.prepare('SELECT * FROM user_buildings WHERE user_id = ? AND is_territory_center = 1').all(npc.id);
        if (territories.length === 0) return;

        // 2. Pick one random territory to develop this tick
        const targetTerritory = territories[Math.floor(Math.random() * territories.length)];

        // 3. Check funds
        const buildCost = 100;
        const resources = db.prepare('SELECT gold FROM user_resources WHERE user_id = ?').get(npc.id);
        if (resources.gold < buildCost) return;

        // 4. Generate random location within radius
        // Approx: 1 deg = 111km. 
        const rKm = targetTerritory.territory_radius || 2;
        const rDeg = rKm / 111;

        // Random angle & distance
        const angle = Math.random() * 2 * Math.PI;
        const dist = Math.sqrt(Math.random()) * rDeg; // Square root for uniform distribution in circle

        const newX = targetTerritory.x + (dist * Math.cos(angle));
        const newY = targetTerritory.y + (dist * Math.sin(angle));

        // 5. Check collision (Simple radius check against all buildings)
        // Optimization: Just check proximity to any building in this territory?
        // Using a somewhat large exclusion zone to prevent stacking
        const overlap = db.prepare(`
            SELECT id FROM user_buildings 
            WHERE user_id = ? 
            AND ABS(x - ?) < 0.005 
            AND ABS(y - ?) < 0.005
        `).get(npc.id, newX, newY);

        if (!overlap) {
            // 6. Build Random Resource Building
            const buildingType = Math.random() > 0.5 ? 'MINE' : 'FARM';

            db.transaction(() => {
                db.prepare('UPDATE user_resources SET gold = gold - ? WHERE user_id = ?').run(buildCost, npc.id);
                db.prepare(`
                    INSERT INTO user_buildings (user_id, type, x, y, last_collected_at, territory_radius, world_x, world_y) 
                    VALUES (?, ?, ?, ?, ?, 0, ?, ?)
                `).run(npc.id, buildingType, newX, newY, new Date().toISOString(), targetTerritory.world_x, targetTerritory.world_y);
            })();

            console.log(`[FreeNPC] ${npc.faction_name} developed territory: Built ${buildingType} at ${newX.toFixed(4)}, ${newY.toFixed(4)}`);
        }
    }

    attemptExpansion(npc) {
        // 1. Get current territory edges
        // Find all buildings
        const buildings = db.prepare('SELECT world_x, world_y FROM user_buildings WHERE user_id = ?').all(npc.id);
        if (buildings.length === 0) return; // Should have at least one base

        // 2. Check neighbors (Simple 4-direction check)
        const candidates = [];
        buildings.forEach(b => {
            const neighbors = [
                { x: b.world_x + 1, y: b.world_y },
                { x: b.world_x - 1, y: b.world_y },
                { x: b.world_x, y: b.world_y + 1 },
                { x: b.world_x, y: b.world_y - 1 }
            ];
            candidates.push(...neighbors);
        });

        // 3. Filter valid candidates (Start simple: Just one)
        for (const pos of candidates) {
            // Check if occupied
            const occupied = db.prepare('SELECT id FROM user_buildings WHERE world_x = ? AND world_y = ?').get(pos.x, pos.y);
            if (occupied) continue;

            // Check funds for expansion
            const cost = 500; // Expansion is more expensive
            const resources = db.prepare('SELECT gold FROM user_resources WHERE user_id = ?').get(npc.id);

            if (resources.gold >= cost) {
                // Build!
                db.transaction(() => {
                    db.prepare('UPDATE user_resources SET gold = gold - ? WHERE user_id = ?').run(cost, npc.id);

                    // Convert Grid to Real Coords (Base: 36.0, 127.0 roughly central Korea/Sea)
                    // Grid step 0.1 deg (~11km). Radius 5km.
                    const realX = 36.0 + (pos.x * 0.1);
                    const realY = 127.0 + (pos.y * 0.1);

                    // Expansion always builds OUTPOST (Territory Center)
                    db.prepare(`
                        INSERT INTO user_buildings (user_id, type, x, y, world_x, world_y, is_territory_center, territory_radius) 
                        VALUES (?, 'OUTPOST', ?, ?, ?, ?, 1, 5)
                    `).run(npc.id, realX, realY, pos.x, pos.y);
                })();

                console.log(`[FreeNPC] ${npc.faction_name} EXPANDED to ${pos.x}, ${pos.y}`);
                break; // Only one expansion per tick
            }
        }
    }
}

module.exports = new FreeNpcManager();
