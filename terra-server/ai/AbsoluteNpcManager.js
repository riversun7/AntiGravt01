const db = require('../database');

class AbsoluteNpcManager {
    constructor() {
        this.recipes = [
            { input: { code: 'IRON_ORE', qty: 2 }, output: { code: 'STEEL_INGOT', qty: 1 } },
            { input: { code: 'WOOD', qty: 3 }, output: { code: 'LUMBER', qty: 2 } },
            { input: { code: 'FOOD', qty: 5 }, output: { code: 'RATIONS', qty: 5 } }
        ];
    }

    run() {
        console.log('[AbsoluteNPC] Running Absolute Faction Logic...');
        const npcs = db.prepare(`
            SELECT u.*, f.name as faction_name 
            FROM users u
            JOIN factions f ON u.faction_id = f.id
            WHERE f.type = 'ABSOLUTE' AND u.faction_rank = 2
        `).all();

        npcs.forEach(npc => {
            this.manageDefense(npc);
            this.manageEconomy(npc);
            this.processMovement(npc);
        });
    }

    manageDefense(npc) {
        // Absolute types maintain high defense. 
        // Logic: Repair all buildings, ensure max minions in defense duty.
        // For MVP: Just log.
        // console.log(`[AbsoluteNPC] ${npc.username} checking defenses.`);
    }

    manageEconomy(npc) {
        this.scanMarketAndBuy(npc);
        this.processProduction(npc);
        this.sellGoods(npc);
    }

    scanMarketAndBuy(npc) {
        // 1. Check Resources with Low Price (Demand < Supply)
        const cheapItems = db.prepare(`
            SELECT * FROM market_items 
            WHERE type = 'RESOURCE' AND current_price < base_price * 0.9
        `).all();

        cheapItems.forEach(item => {
            // Buy logic
            const quantityToBuy = 100; // Fixed batch for now
            const cost = item.current_price * quantityToBuy;

            // Check Gold
            const resources = db.prepare('SELECT gold FROM user_resources WHERE user_id = ?').get(npc.id);
            if (resources.gold >= cost) {
                const buyTx = db.transaction(() => {
                    db.prepare('UPDATE user_resources SET gold = gold - ? WHERE user_id = ?').run(cost, npc.id);

                    const existing = db.prepare('SELECT * FROM user_inventory WHERE user_id = ? AND item_id = ?').get(npc.id, item.id);
                    if (existing) {
                        db.prepare('UPDATE user_inventory SET quantity = quantity + ? WHERE user_id = ? AND item_id = ?').run(quantityToBuy, npc.id, item.id);
                    } else {
                        db.prepare('INSERT INTO user_inventory (user_id, item_id, quantity) VALUES (?, ?, ?)').run(npc.id, item.id, quantityToBuy);
                    }

                    // Update Market Price (Simulate demand increase)
                    // Simple logic: Buying increases price slightly
                    const newPrice = Math.floor(item.current_price * 1.05);
                    db.prepare('UPDATE market_items SET current_price = ? WHERE id = ?').run(newPrice, item.id);
                });
                buyTx();
                console.log(`[AbsoluteNPC] ${npc.username} BOUGHT ${quantityToBuy} ${item.name} @ ${item.current_price}`);
            }
        });
    }

    processProduction(npc) {
        // Convert Raw -> Processed (Logic placeholder)
        // In real impl, checking inventory and converting
    }

    sellGoods(npc) {
        // Sell high-tier items if price is high
    }

    // AI Logic for Movement
    processMovement(npc) {
        if (npc.destination_pos) {
            // Already moving
            return;
        }

        // Simple Patrol Logic
        this.patrolAroundBase(npc);
    }

    patrolAroundBase(npc) {
        // Get Command Center
        const cc = db.prepare(`
            SELECT ub.*, bt.patrol_radius_km
            FROM user_buildings ub 
            JOIN building_types bt ON ub.type = bt.code 
            WHERE ub.user_id = ? AND ub.type IN ('COMMAND_CENTER', 'CENTRAL_CONTROL_HUB') 
            ORDER BY ub.type DESC 
            LIMIT 1
        `).get(npc.id);

        if (!cc) return;

        const r = cc.patrol_radius_km || 20.0;
        const angle = Math.random() * 2 * Math.PI;
        const dist = Math.random() * r;

        const latO = (dist * Math.cos(angle)) / 111;
        const lngO = (dist * Math.sin(angle)) / (111 * Math.cos(cc.x * Math.PI / 180));

        this.setDestination(npc, cc.x + latO, cc.y + lngO);
        console.log(`[AbsoluteNPC] ${npc.username} 순찰 시작 - 목적지: (${(cc.x + latO).toFixed(4)}, ${(cc.y + lngO).toFixed(4)})`);
        this.logAction(npc, 'DECISION', 'Starting Patrol');
    }

    setDestination(npc, destLat, destLng) {
        const currentPos = npc.current_pos ? npc.current_pos.split('_').map(Number) : null;
        if (!currentPos) return;

        const [currentLat, currentLng] = currentPos;
        const distanceKm = this.getDistanceFromLatLonInKm(currentLat, currentLng, destLat, destLng);

        // Dynamic speed from DB
        const cyborg = db.prepare('SELECT movement_speed FROM character_cyborg WHERE user_id = ?').get(npc.id);
        const speedKmPerSec = cyborg ? (cyborg.movement_speed || 0.1) : 0.1; // Default 0.1 km/s if not set

        const travelTimeSec = distanceKm / speedKmPerSec;
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

        const msg = `Moving to (${destLat.toFixed(4)}, ${destLng.toFixed(4)}) - Dist: ${distanceKm.toFixed(2)}km`;
        this.logAction(npc, 'MOVE', msg);
    }

    getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const dLat = (lat2 - lat1) * (Math.PI / 180);
        const dLon = (lon2 - lon1) * (Math.PI / 180);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    logAction(npc, type, details) {
        try {
            db.prepare(`
                INSERT INTO npc_action_logs (npc_id, faction_name, action_type, details)
                VALUES (?, ?, ?, ?)
            `).run(npc.id, npc.faction_name, type, details);
            // Cleanup
            db.prepare(`DELETE FROM npc_action_logs WHERE id <= (SELECT id FROM npc_action_logs ORDER BY id DESC LIMIT 1 OFFSET 10000)`).run();
        } catch (e) {
            console.error(e);
        }
    }
}

module.exports = new AbsoluteNpcManager();
