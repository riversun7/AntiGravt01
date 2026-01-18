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
            this.checkArrivalAndBuild(npc); // Check if arrived and build beacon
            this.attemptExpansion(npc);     // Plan next expansion movement
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
        // 1. Find all territory centers (Area Beacons/Command Centers)
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

    checkArrivalAndBuild(npc) {
        const now = new Date();

        // Check if NPC is traveling
        if (!npc.arrival_time || !npc.destination_pos) return;

        const arrivalTime = new Date(npc.arrival_time);
        if (now < arrivalTime) return; // Still traveling

        // Parse destination
        const [destLat, destLng] = npc.destination_pos.split('_').map(Number);
        const destWorldX = Math.round((destLat - 36.0) / 0.1);
        const destWorldY = Math.round((destLng - 127.0) / 0.1);

        // Build AREA_BEACON at destination
        const cost = 500;
        const resources = db.prepare('SELECT gold FROM user_resources WHERE user_id = ?').get(npc.id);

        if (resources.gold >= cost) {
            db.transaction(() => {
                db.prepare('UPDATE user_resources SET gold = gold - ? WHERE user_id = ?').run(cost, npc.id);

                db.prepare(`
                    INSERT INTO user_buildings (user_id, type, x, y, world_x, world_y, is_territory_center, territory_radius)
                    VALUES (?, 'AREA_BEACON', ?, ?, ?, ?, 1, 5)
                `).run(npc.id, destLat, destLng, destWorldX, destWorldY);

                // Update current position and clear movement
                db.prepare(`
                    UPDATE users 
                    SET current_pos = ?, destination_pos = NULL, start_pos = NULL, arrival_time = NULL, departure_time = NULL
                    WHERE id = ?
                `).run(`${destLat}_${destLng}`, npc.id);

                console.log(`[FreeNPC] ${npc.faction_name} arrived and built AREA_BEACON at ${destLat.toFixed(4)}, ${destLng.toFixed(4)}`);
            })();
        }
    }

    attemptExpansion(npc) {
        // Skip if already moving
        if (npc.destination_pos) {
            return;
        }

        // 1. Get Cyborg Character
        const cyborg = db.prepare('SELECT * FROM character_cyborg WHERE user_id = ?').get(npc.id);
        if (!cyborg) {
            console.warn(`[FreeNPC] ${npc.faction_name} has no cyborg character!`);
            return;
        }

        // 2. Parse current GPS position (format: "lat_lng")
        const currentPos = npc.current_pos ? npc.current_pos.split('_').map(Number) : [36.0, 127.0];
        const [currentLat, currentLng] = currentPos;

        // 3. Check expansion limit (max 10 territory centers)
        const territoryCount = db.prepare(
            'SELECT COUNT(*) as count FROM user_buildings WHERE user_id = ? AND is_territory_center = 1'
        ).get(npc.id);

        if (territoryCount.count >= 10) {
            // console.log(`[FreeNPC] ${npc.faction_name} reached expansion limit (10 territories)`);
            return;
        }

        // 4. Generate random movement within 5km radius
        // 1 degree latitude ≈ 111km, so 5km ≈ 0.045 degrees
        const maxRadiusKm = 5;
        const maxRadiusDeg = maxRadiusKm / 111;

        // Random angle and distance
        const angle = Math.random() * 2 * Math.PI;
        const distance = Math.sqrt(Math.random()) * maxRadiusDeg; // Uniform distribution in circle

        const targetLat = currentLat + (distance * Math.cos(angle));
        const targetLng = currentLng + (distance * Math.sin(angle));

        // Convert to world grid for collision check
        const targetWorldX = Math.round((targetLat - 36.0) / 0.1);
        const targetWorldY = Math.round((targetLng - 127.0) / 0.1);

        // 5. Check if target location is occupied
        const occupied = db.prepare(
            'SELECT id FROM user_buildings WHERE world_x = ? AND world_y = ?'
        ).get(targetWorldX, targetWorldY);

        if (occupied) {
            // Location occupied, will try again next tick
            return;
        }

        // 6. Check funds for expansion
        const cost = 500;
        const resources = db.prepare('SELECT gold FROM user_resources WHERE user_id = ?').get(npc.id);

        if (resources.gold < cost) {
            // Not enough funds
            return;
        }

        // 7. Calculate travel time
        // Distance in km (approximate)
        const distanceKm = Math.sqrt(
            Math.pow((targetLat - currentLat) * 111, 2) +
            Math.pow((targetLng - currentLng) * 111, 2)
        );

        // Speed: configurable, default 50 m/s = 0.05 km/s
        // TODO: Make this configurable per NPC or via admin settings
        const speedKmPerSec = 0.05; // 50 m/s
        const travelTimeSec = distanceKm / speedKmPerSec;
        const travelTimeMs = travelTimeSec * 1000;

        // 8. Set movement destination
        const now = new Date();
        const arrivalTime = new Date(now.getTime() + travelTimeMs);

        db.prepare(`
            UPDATE users 
            SET start_pos = ?, destination_pos = ?, departure_time = ?, arrival_time = ?
            WHERE id = ?
        `).run(
            `${currentLat}_${currentLng}`,
            `${targetLat}_${targetLng}`,
            now.toISOString(),
            arrivalTime.toISOString(),
            npc.id
        );

        console.log(`[FreeNPC] ${npc.faction_name} cyborg moving to ${targetLat.toFixed(4)}, ${targetLng.toFixed(4)} (${distanceKm.toFixed(2)}km, ETA: ${travelTimeSec.toFixed(0)}s)`);
    }
}

module.exports = new FreeNpcManager();
