/**
 * @file FreeNpcManager.js
 * @description '자유(Free)' 세력의 AI 로직을 관리하는 매니저입니다.
 * @role 자원 채집, 영토 확장, 비전투적 경제 활동
 * @dependencies database
 * @referenced_by server.js (NPC Loop)
 * @status Active
 * @analysis 
 * - 자유 세력은 자원을 찾아 영토를 확장하고 건물을 건설하는 데 초점을 맞춥니다.
 * - `developTerritory`에서 무작위 확장을 시도하며, 충돌 시 다른 곳을 찾습니다.
 */

const db = require('../database');

class FreeNpcManager {
    constructor() {
        this.lastPositionUpdate = null;
    }

    run() {
        console.log('[FreeNPC] Running Free Faction Logic...');

        // Update traveling NPC positions periodically
        this.updateTravelingPositions();

        // Join users with factions to get only Free Faction Leaders (Rank 2)
        const npcs = db.prepare(`
            SELECT u.*, f.name as faction_name 
            FROM users u
            JOIN factions f ON u.faction_id = f.id
            WHERE f.type = 'FREE' AND u.faction_rank = 2
        `).all();

        console.log(`[FreeNPC] Found ${npcs.length} Free Faction NPCs`);

        npcs.forEach(npc => {
            console.log(`[FreeNPC] Processing ${npc.faction_name} (ID: ${npc.id})`);
            this.collectResources(npc);
            this.developTerritory(npc);
            this.checkArrivalAndBuild(npc); // Check if arrived and build beacon

            // AI 의사결정: 이동 중이 아닐 때만 다음 행동 결정
            console.log(`[FreeNPC] ${npc.faction_name} destination_pos: ${npc.destination_pos}`);
            if (!npc.destination_pos) {
                console.log(`[FreeNPC] ${npc.faction_name} is not moving, calling decideNextAction`);
                this.decideNextAction(npc);
            } else {
                console.log(`[FreeNPC] ${npc.faction_name} is already moving to ${npc.destination_pos}`);
            }
        });
    }

    updateTravelingPositions() {
        const now = Date.now();

        // Get update interval from server config (in seconds)
        const updateInterval = (global.SYSTEM_CONFIG?.npc_position_update_interval || 30) * 1000;

        if (this.lastPositionUpdate && (now - this.lastPositionUpdate) < updateInterval) {
            return; // Not time yet
        }

        this.lastPositionUpdate = now;

        // Get all traveling NPCs
        const traveling = db.prepare(`
            SELECT id, current_pos, start_pos, destination_pos, departure_time, arrival_time
            FROM users 
            WHERE destination_pos IS NOT NULL 
            AND arrival_time > datetime('now')
            AND npc_type = 'FREE'
        `).all();

        if (traveling.length === 0) return;

        console.log(`[FreeNPC] Updating positions for ${traveling.length} traveling NPCs`);

        traveling.forEach(npc => {
            try {
                const start = new Date(npc.departure_time).getTime();
                const end = new Date(npc.arrival_time).getTime();
                const progress = Math.min(Math.max((now - start) / (end - start), 0), 1);

                const [startLat, startLng] = npc.start_pos.split('_').map(Number);
                const [destLat, destLng] = npc.destination_pos.split('_').map(Number);

                const currentLat = startLat + (destLat - startLat) * progress;
                const currentLng = startLng + (destLng - startLng) * progress;

                // Update current position
                db.prepare('UPDATE users SET current_pos = ? WHERE id = ?')
                    .run(`${currentLat}_${currentLng}`, npc.id);
            } catch (err) {
                console.error(`[FreeNPC] Error updating position for NPC ${npc.id}:`, err);
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

    /**
     * @function developTerritory
     * @description 영토 내 빈 공간에 자원 건물을 건설하여 영토를 개발합니다.
     * @param {Object} npc - NPC 사용자 객체
     * @analysis 
     * - 랜덤한 위치를 선정하고 자원(Gold)을 소비하여 광산(MINE)이나 농장(FARM)을 건설합니다.
     * - 건물 겹침 방지 로직이 포함되어 있습니다.
     */
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
                const beaconType = db.prepare('SELECT territory_radius FROM building_types WHERE code = ?').get('AREA_BEACON');
                const beaconRadius = beaconType ? beaconType.territory_radius : 1.0;

                db.prepare(`
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
                this.logAction(npc, 'BUILD', `Built AREA_BEACON at ${destLat.toFixed(4)}, ${destLng.toFixed(4)}`);
            })();
        } else {
            // 2026-01-20 Fix: Clear movement even if funds are insufficient to prevent infinite loop
            db.prepare(`
                UPDATE users 
                SET current_pos = ?, destination_pos = NULL, start_pos = NULL, arrival_time = NULL, departure_time = NULL
                WHERE id = ?
            `).run(`${destLat}_${destLng}`, npc.id);
            console.log(`[FreeNPC] ${npc.faction_name} arrived at ${destLat.toFixed(4)}, ${destLng.toFixed(4)} but failed to build (Insufficient Gold: ${resources.gold}/${cost})`);
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
            return false;
        }

        // 6. Check funds for restriction
        const cost = 500;
        const resources = db.prepare('SELECT gold FROM user_resources WHERE user_id = ?').get(npc.id);

        if (!resources || resources.gold < cost) {
            // Not enough funds
            // console.log(`[FreeNPC] ${npc.faction_name} not enough gold for expansion`);
            return false;
        }

        // 7. Move to target using setDestination
        console.log(`[FreeNPC] ${npc.faction_name} expanding territory - Moving to (${targetLat.toFixed(4)}, ${targetLng.toFixed(4)})`);
        this.setDestination(npc, targetLat, targetLng);
        return true;
    }

    // ========== AI 의사결정 시스템 ==========
    /**
     * @function decideNextAction
     * @description NPC의 다음 행동(이동, 확장, 순찰)을 결정하는 함수
     * @param {Object} npc - NPC 사용자 객체
     * @analysis 
     * - 우선순위: 자원 발견 > 영토 확장 > 순찰
     * - `findNearbyResource`: 시야(Vision Range) 내의 자원 발견 시 이동
     * - `shouldExpandTerritory`: 조건 충족 시 영토 확장 시도
     */
    decideNextAction(npc) {
        console.log(`[FreeNPC] ${npc.faction_name} AI 의사결정 시작...`);

        // 1. 자원 탐지 (최고 우선순위)
        const nearbyResource = this.findNearbyResource(npc);
        if (nearbyResource) {
            console.log(`[FreeNPC] ${npc.faction_name} 자원 발견 at (${nearbyResource.x}, ${nearbyResource.y})`);
            this.setDestination(npc, nearbyResource.x, nearbyResource.y);
            return;
        }

        // 2. 영토 확장
        if (this.shouldExpandTerritory(npc)) {
            console.log(`[FreeNPC] ${npc.faction_name} 영토 확장 시도`);
            if (this.attemptExpansion(npc)) {
                return;
            }
            console.log(`[FreeNPC] ${npc.faction_name} 영토 확장 실패 (위치 점유 등), 순찰로 전환`);
        }

        // 3. 순찰 (기본 행동)
        this.logAction(npc, 'DECISION', 'Starting Patrol');
        this.patrolAroundBase(npc);
    }

    findNearbyResource(npc) {
        const cc = this.getCommandCenter(npc.id);
        if (!cc) return null;

        const visionRange = cc.vision_range_km || 10.0;
        const resources = db.prepare('SELECT * FROM resource_nodes WHERE current_amount > 0').all();

        if (!resources || !resources.length) return null;

        const currentPos = npc.current_pos ? npc.current_pos.split('_').map(Number) : null;
        if (!currentPos) return null;

        const [currentLat, currentLng] = currentPos;
        for (const r of resources) {
            if (this.getDistanceFromLatLonInKm(currentLat, currentLng, r.x, r.y) <= visionRange) {
                return r;
            }
        }
        return null;
    }

    shouldExpandTerritory(npc) {
        const beaconType = db.prepare('SELECT * FROM building_types WHERE code = ?').get('AREA_BEACON');
        if (!beaconType) return false;

        const cost = JSON.parse(beaconType.construction_cost || '{}');
        const resources = db.prepare('SELECT * FROM user_resources WHERE user_id = ?').get(npc.id);

        if (!resources || resources.gold < (cost.gold || 0)) {
            return false;
        }

        const cc = this.getCommandCenter(npc.id);
        if (!cc) return false;

        const beaconCount = db.prepare(
            'SELECT COUNT(*) as count FROM user_buildings WHERE user_id = ? AND type = ?'
        ).get(npc.id, 'AREA_BEACON');

        return beaconCount.count < cc.max_beacons;
    }

    patrolAroundBase(npc) {
        const cc = this.getCommandCenter(npc.id);
        if (!cc) {
            console.warn(`[FreeNPC] ${npc.faction_name} has no command center!`);
            return;
        }

        const r = cc.patrol_radius_km || 20.0;
        const angle = Math.random() * 2 * Math.PI;
        const dist = Math.random() * r;

        const latO = (dist * Math.cos(angle)) / 111;
        const lngO = (dist * Math.sin(angle)) / (111 * Math.cos(cc.x * Math.PI / 180));

        this.setDestination(npc, cc.x + latO, cc.y + lngO);
        console.log(`[FreeNPC] ${npc.faction_name} 순찰 시작 - 목적지: (${(cc.x + latO).toFixed(4)}, ${(cc.y + lngO).toFixed(4)}), 반경: ${r}km`);
    }

    getCommandCenter(userId) {
        // 2026-01-20 Fix: Use LEFT JOIN to ensure CC is found even if building_type join fails (fallback)
        const cc = db.prepare(`
            SELECT ub.*, 
                   COALESCE(bt.patrol_radius_km, 20.0) as patrol_radius_km, 
                   COALESCE(bt.vision_range_km, 30.0) as vision_range_km
            FROM user_buildings ub 
            LEFT JOIN building_types bt ON ub.type = bt.code 
            WHERE ub.user_id = ? AND ub.type IN ('COMMAND_CENTER', 'CENTRAL_CONTROL_HUB') 
            ORDER BY ub.type DESC 
            LIMIT 1
        `).get(userId);

        if (!cc) {
            // Debug log to check why CC is missing
            const bldgs = db.prepare('SELECT type FROM user_buildings WHERE user_id = ?').all(userId);
            // console.warn(`[FreeNPC] Debug: User ${userId} buildings: ${bldgs.map(b => b.type).join(', ')}`);
        }
        return cc;
    }

    // Helper: Log NPC Actions to DB
    logAction(npc, type, details) {
        try {
            db.prepare(`
                INSERT INTO npc_action_logs (npc_id, faction_name, action_type, details)
                VALUES (?, ?, ?, ?)
            `).run(npc.id, npc.faction_name, type, details);

            // Auto-cleanup: Keep last 10000 records
            db.prepare(`
                DELETE FROM npc_action_logs 
                WHERE id <= (
                    SELECT id FROM npc_action_logs ORDER BY id DESC LIMIT 1 OFFSET 10000
                )
            `).run();
        } catch (err) {
            console.error('[FreeNPC] Failed to log action:', err);
        }
    }

    setDestination(npc, destLat, destLng) {
        const currentPos = npc.current_pos ? npc.current_pos.split('_').map(Number) : null;
        if (!currentPos) {
            console.warn(`[FreeNPC] ${npc.faction_name} has no current_pos!`);
            return;
        }

        // Get movement speed from DB (km/h)
        const cyborg = db.prepare('SELECT movement_speed FROM character_cyborg WHERE user_id = ?').get(npc.id);
        const speedKmh = (cyborg && cyborg.movement_speed) ? cyborg.movement_speed : 180; // Default 180 km/h
        const speedKms = speedKmh / 3600;

        const [currentLat, currentLng] = currentPos;
        const distanceKm = this.getDistanceFromLatLonInKm(currentLat, currentLng, destLat, destLng);

        let travelTimeSec = distanceKm / speedKms;
        if (travelTimeSec < 1) travelTimeSec = 1; // Minimum 1 second

        const arrivalTime = new Date(Date.now() + travelTimeSec * 1000);

        db.prepare(`
            UPDATE users 
            SET start_pos = ?, destination_pos = ?, departure_time = ?, arrival_time = ? 
            WHERE id = ?
        `).run(
            `${currentLat}_${currentLng}`,
            `${destLat}_${destLng}`,
            new Date().toISOString(),
            arrivalTime.toISOString(),
            npc.id
        );

        const msg = `Moving to (${destLat.toFixed(4)}, ${destLng.toFixed(4)}) - Dist: ${distanceKm.toFixed(2)}km, Speed: ${speedKmh}km/h, ETA: ${travelTimeSec.toFixed(0)}s`;
        console.log(`[FreeNPC] ${npc.faction_name} ${msg}`);
        this.logAction(npc, 'MOVE', msg);
    }
}

module.exports = new FreeNpcManager();
