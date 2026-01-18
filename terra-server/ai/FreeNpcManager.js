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

            // AI 의사결정: 이동 중이 아닐 때만 다음 행동 결정
            if (!npc.destination_pos) {
                this.decideNextAction(npc);
            }
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

        // Check beacon limits BEFORE building
        const canBuild = this.canBuildBeaconAt(npc.id, destLat, destLng);
        if (!canBuild.allowed) {
            console.log(`[FreeNPC] ${npc.faction_name} cannot build beacon: ${canBuild.reason}`);
            // Clear movement and try again later
            db.prepare(`
                UPDATE users 
                SET destination_pos = NULL, start_pos = NULL, arrival_time = NULL, departure_time = NULL
                WHERE id = ?
            `).run(npc.id);
            return;
        }

        // Build AREA_BEACON at destination
        const cost = 500;
        const resources = db.prepare('SELECT gold FROM user_resources WHERE user_id = ?').get(npc.id);

        if (resources.gold >= cost) {
            db.transaction(() => {
                db.prepare('UPDATE user_resources SET gold = gold - ? WHERE user_id = ?').run(cost, npc.id);

                // Get AREA_BEACON radius from building_types
                const beaconType = this.db.prepare('SELECT territory_radius FROM building_types WHERE code = ?').get('AREA_BEACON');
                const beaconRadius = beaconType ? beaconType.territory_radius : 1.0;

                this.db.prepare(`
                    INSERT INTO user_buildings (user_id, type, x, y, world_x, world_y, is_territory_center, territory_radius)
                    VALUES (?, 'AREA_BEACON', ?, ?, ?, ?, 1, ?)
                `).run(npc.id, destLat, destLng, destWorldX, destWorldY, beaconRadius);

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

    // Helper function to check if a beacon can be built at the target location
    canBuildBeaconAt(userId, targetLat, targetLng) {
        // Get all parent buildings (COMMAND_CENTER or CENTRAL_CONTROL_HUB) for this user
        const parents = db.prepare(`
            SELECT ub.id, ub.type, ub.x, ub.y, bt.max_beacons, bt.beacon_range_km
            FROM user_buildings ub
            JOIN building_types bt ON ub.type = bt.code
            WHERE ub.user_id = ? 
            AND bt.max_beacons > 0
            AND ub.is_territory_center = 1
        `).all(userId);

        if (parents.length === 0) {
            return { allowed: false, reason: 'No parent building (COMMAND_CENTER) found' };
        }

        // Find a suitable parent within range and below beacon limit
        for (const parent of parents) {
            // Calculate distance from parent to target
            const distanceKm = this.getDistanceFromLatLonInKm(parent.x, parent.y, targetLat, targetLng);

            // Check if within range
            if (distanceKm > parent.beacon_range_km) {
                continue; // Try next parent
            }

            // Count existing beacons for this parent
            const beaconCount = db.prepare(`
                SELECT COUNT(*) as count
                FROM user_buildings
                WHERE user_id = ?
                AND type = 'AREA_BEACON'
            `).get(userId);

            // For now, count ALL beacons for the user
            // TODO: In the future, track which beacon belongs to which parent
            if (beaconCount.count >= parent.max_beacons) {
                continue; // Try next parent
            }

            // Found a valid parent
            return { allowed: true, parent: parent };
        }

        return {
            allowed: false,
            reason: `No parent building within range (max ${parents[0].beacon_range_km}km) or beacon limit reached (max ${parents[0].max_beacons})`
        };
    }

    getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
        const R = 6371; // Radius of the earth in km
        const dLat = this.deg2rad(lat2 - lat1);
        const dLon = this.deg2rad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const d = R * c; // Distance in km
        return d;
    }

    deg2rad(deg) {
        return deg * (Math.PI / 180);
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

    // ========== AI 의사결정 시스템 ==========
    decideNextAction(npc) { const nearbyResource = this.findNearbyResource(npc); if (nearbyResource) { console.log(`[FreeNPC] ${npc.faction_name} 자원 발견`); this.setDestination(npc, nearbyResource.x, nearbyResource.y); return; } if (this.shouldExpandTerritory(npc)) { this.attemptExpansion(npc); return; } this.patrolAroundBase(npc); }
    findNearbyResource(npc) { const cc = this.getCommandCenter(npc.id); if (!cc) return null; const visionRange = cc.vision_range_km || 10.0; const resources = db.prepare('SELECT * FROM resource_nodes WHERE current_amount > 0').all(); if (!resources || !resources.length) return null; const currentPos = npc.current_pos ? npc.current_pos.split('_').map(Number) : null; if (!currentPos) return null; const [currentLat, currentLng] = currentPos; for (const r of resources) { if (this.getDistanceFromLatLonInKm(currentLat, currentLng, r.x, r.y) <= visionRange) return r; } return null; }
    shouldExpandTerritory(npc) { const beaconType = db.prepare('SELECT * FROM building_types WHERE code = ?').get('AREA_BEACON'); if (!beaconType) return false; const cost = JSON.parse(beaconType.construction_cost || '{}'); const resources = db.prepare('SELECT * FROM user_resources WHERE user_id = ?').get(npc.id); if (!resources || resources.gold < (cost.gold || 0)) return false; const cc = this.getCommandCenter(npc.id); if (!cc) return false; const beaconCount = db.prepare('SELECT COUNT(*) as count FROM user_buildings WHERE user_id = ? AND type = ?').get(npc.id, 'AREA_BEACON'); return beaconCount.count < cc.max_beacons; }
    patrolAroundBase(npc) { const cc = this.getCommandCenter(npc.id); if (!cc) return; const r = cc.patrol_radius_km || 20.0; const angle = Math.random() * 2 * Math.PI; const dist = Math.random() * r; const latO = (dist * Math.cos(angle)) / 111; const lngO = (dist * Math.sin(angle)) / (111 * Math.cos(cc.x * Math.PI / 180)); this.setDestination(npc, cc.x + latO, cc.y + lngO); console.log(`[FreeNPC] ${npc.faction_name} 순찰 중 (반경 ${r}km)`); }
    getCommandCenter(userId) { return db.prepare('SELECT ub.*, bt.patrol_radius_km, bt.vision_range_km, bt.max_beacons, bt.beacon_range_km FROM user_buildings ub JOIN building_types bt ON ub.type = bt.code WHERE ub.user_id = ? AND ub.type IN (?, ?) ORDER BY ub.type DESC LIMIT 1').get(userId, 'COMMAND_CENTER', 'CENTRAL_CONTROL_HUB'); }
    setDestination(npc, destLat, destLng) { const currentPos = npc.current_pos ? npc.current_pos.split('_').map(Number) : null; if (!currentPos) return; const [currentLat, currentLng] = currentPos; const distanceKm = this.getDistanceFromLatLonInKm(currentLat, currentLng, destLat, destLng); const travelTimeSec = distanceKm / 0.05; const arrivalTime = new Date(Date.now() + travelTimeSec * 1000); db.prepare('UPDATE users SET start_pos = ?, destination_pos = ?, departure_time = ?, arrival_time = ? WHERE id = ?').run(`${currentLat}_${currentLng}`, `${destLat}_${destLng}`, new Date().toISOString(), arrivalTime.toISOString(), npc.id); }
}

module.exports = new FreeNpcManager();
