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
}

module.exports = new AbsoluteNpcManager();
