const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./database');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(bodyParser.json());

// Routes
// 1. Login (Simple User Creation/Retrieval)
app.post('/api/login', (req, res) => {
    const { username } = req.body;
    if (!username) {
        return res.status(400).json({ error: 'Username is required' });
    }

    try {
        // Try to find user
        let user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

        if (!user) {
            // Create new user
            const info = db.prepare('INSERT INTO users (username) VALUES (?)').run(username);
            const userId = info.lastInsertRowid;

            // Initialize resources
            db.prepare('INSERT INTO user_resources (user_id, gold, gem) VALUES (?, ?, ?)').run(userId, 1000, 10);
            // Initialize defaults stats
            db.prepare('INSERT INTO user_stats (user_id) VALUES (?)').run(userId);

            user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
            console.log(`New user created: ${username}`);
        } else {
            // Check password if admin
            if (user.role === 'admin') {
                const { password } = req.body;
                if (password !== user.password) {
                    return res.status(401).json({ error: 'Invalid Password' });
                }
            } else if (username === 'admin' && !user) {
                // Auto-create admin if trying to login as admin for the first time? No, seeded manually or via script usually.
            }

            // Update last login
            db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);
            console.log(`User logged in: ${username}`);
        }

        res.json({ user });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 2. Get User Info (with resources & equipment)
app.get('/api/user/:id', (req, res) => {
    try {
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
        if (!user) return res.status(404).json({ error: 'User not found' });

        const resources = db.prepare('SELECT * FROM user_resources WHERE user_id = ?').get(req.params.id);
        const stats = db.prepare('SELECT * FROM user_stats WHERE user_id = ?').get(req.params.id);

        // Fetch Equipment with Item Details
        const equipment = db.prepare(`
            SELECT ue.*, mi.name, mi.code, mi.description, mi.stats, mi.type 
            FROM user_equipment ue
            JOIN market_items mi ON ue.item_id = mi.id
            WHERE ue.user_id = ?
        `).all(req.params.id);

        res.json({ ...user, resources, stats, equipment });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 3. Update User (Cyborg Init)
app.put('/api/user/:id', (req, res) => {
    const { cyborg_model } = req.body;
    try {
        const result = db.prepare('UPDATE users SET cyborg_model = ? WHERE id = ?').run(cyborg_model, req.params.id);
        if (result.changes === 0) return res.status(404).json({ error: 'User not found' });

        // Define base stats based on Model (Ref Notion: STR, DEX, CON, AGI, INT, WIS)
        let stats = { strength: 5, dexterity: 5, constitution: 5, agility: 5, intelligence: 5, wisdom: 5 };

        if (cyborg_model === 'COMMANDER') {
            stats = { strength: 4, dexterity: 4, constitution: 5, agility: 4, intelligence: 9, wisdom: 8 };
        } else if (cyborg_model === 'EXPLORER') {
            stats = { strength: 4, dexterity: 9, constitution: 3, agility: 9, intelligence: 5, wisdom: 7 };
        } else if (cyborg_model === 'BUILDER') {
            stats = { strength: 9, dexterity: 4, constitution: 8, agility: 4, intelligence: 7, wisdom: 3 };
        }

        db.prepare(`UPDATE user_stats SET strength = ?, dexterity = ?, constitution = ?, agility = ?, intelligence = ?, wisdom = ? WHERE user_id = ?`)
            .run(stats.strength, stats.dexterity, stats.constitution, stats.agility, stats.intelligence, stats.wisdom, req.params.id);

        res.json({ success: true, stats });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 4. Equipment APIs
app.post('/api/equipment/equip', (req, res) => {
    const { userId, itemId, slot } = req.body;
    try {
        const equipTx = db.transaction(() => {
            // 1. Check Inventory
            const invItem = db.prepare('SELECT * FROM user_inventory WHERE user_id = ? AND item_id = ?').get(userId, itemId);
            if (!invItem || invItem.quantity < 1) throw new Error("Item not in inventory");

            // 2. Check Item Validity
            const item = db.prepare('SELECT * FROM market_items WHERE id = ?').get(itemId);
            if (!item || item.type !== 'EQUIPMENT' || item.slot !== slot) throw new Error("Invalid item for this slot");

            // 3. Check Slot (Unequip existing if any)
            const existing = db.prepare('SELECT * FROM user_equipment WHERE user_id = ? AND slot = ?').get(userId, slot);
            if (existing) {
                // Return to inventory
                const existsInInv = db.prepare('SELECT * FROM user_inventory WHERE user_id = ? AND item_id = ?').get(userId, existing.item_id);
                if (existsInInv) {
                    db.prepare('UPDATE user_inventory SET quantity = quantity + 1 WHERE user_id = ? AND item_id = ?').run(userId, existing.item_id);
                } else {
                    db.prepare('INSERT INTO user_inventory (user_id, item_id, quantity) VALUES (?, ?, 1)').run(userId, existing.item_id);
                }
                // Remove from equip
                db.prepare('DELETE FROM user_equipment WHERE user_id = ? AND slot = ?').run(userId, slot);
            }

            // 4. Equip New Item
            db.prepare('INSERT INTO user_equipment (user_id, slot, item_id) VALUES (?, ?, ?)').run(userId, slot, itemId);

            // 5. Remove from Inventory
            db.prepare('UPDATE user_inventory SET quantity = quantity - 1 WHERE user_id = ? AND item_id = ?').run(userId, itemId);
        });

        equipTx();
        res.json({ success: true });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

app.post('/api/equipment/unequip', (req, res) => {
    const { userId, slot } = req.body;
    try {
        const unequipTx = db.transaction(() => {
            const existing = db.prepare('SELECT * FROM user_equipment WHERE user_id = ? AND slot = ?').get(userId, slot);
            if (!existing) throw new Error("Slot empty");

            // Return to inventory
            const existsInInv = db.prepare('SELECT * FROM user_inventory WHERE user_id = ? AND item_id = ?').get(userId, existing.item_id);
            if (existsInInv) {
                db.prepare('UPDATE user_inventory SET quantity = quantity + 1 WHERE user_id = ? AND item_id = ?').run(userId, existing.item_id);
            } else {
                db.prepare('INSERT INTO user_inventory (user_id, item_id, quantity) VALUES (?, ?, 1)').run(userId, existing.item_id);
            }

            // Remove from equip
            db.prepare('DELETE FROM user_equipment WHERE user_id = ? AND slot = ?').run(userId, slot);
        });

        unequipTx();
        res.json({ success: true });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

// 5. Character System API (Cyborg & Minions)

// --- Cyborg Endpoints ---
app.get('/api/character/:userId/cyborg', (req, res) => {
    try {
        const userId = req.params.userId;
        let cyborg = db.prepare('SELECT * FROM character_cyborg WHERE user_id = ?').get(userId);

        // Auto-create if missing (fallback)
        if (!cyborg) {
            const user = db.prepare('SELECT username FROM users WHERE id = ?').get(userId);
            if (user) {
                db.prepare('INSERT INTO character_cyborg (user_id, name) VALUES (?, ?)').run(userId, 'Cyborg');
                cyborg = db.prepare('SELECT * FROM character_cyborg WHERE user_id = ?').get(userId);
            }
        }

        if (!cyborg) return res.status(404).json({ error: 'User not found' });

        // Get equipment (Main character uses user_equipment)
        const equipment = db.prepare(`
            SELECT ue.*, mi.name, mi.type, mi.rarity, mi.image, mi.stats 
            FROM user_equipment ue 
            JOIN market_items mi ON ue.item_id = mi.id 
            WHERE ue.user_id = ?
        `).all(userId);

        res.json({ cyborg, equipment });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.put('/api/character/:userId/cyborg', (req, res) => {
    try {
        const userId = req.params.userId;
        const { name } = req.body;

        if (name) {
            db.prepare('UPDATE character_cyborg SET name = ? WHERE user_id = ?').run(name, userId);
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Minion Endpoints ---
app.get('/api/character/:userId/minions', (req, res) => {
    try {
        const userId = req.params.userId;
        const minions = db.prepare('SELECT * FROM character_minion WHERE user_id = ?').all(userId);
        res.json({ minions });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/character/:userId/minion/:minionId', (req, res) => {
    try {
        const { userId, minionId } = req.params;
        const minion = db.prepare('SELECT * FROM character_minion WHERE id = ? AND user_id = ?').get(minionId, userId);

        if (!minion) return res.status(404).json({ error: 'Minion not found' });

        const equipment = db.prepare(`
            SELECT me.*, mi.name, mi.type, mi.rarity, mi.image, mi.stats 
            FROM minion_equipment me 
            JOIN market_items mi ON me.item_id = mi.id 
            WHERE me.minion_id = ?
        `).all(minionId);

        const skills = db.prepare('SELECT * FROM minion_skills WHERE minion_id = ?').all(minionId);

        res.json({ minion, equipment, skills });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create Minion (Production/Gacha)
app.post('/api/character/:userId/minion', (req, res) => {
    try {
        const userId = req.params.userId;
        const { type, name, species } = req.body; // type: human, android, creature

        if (!['human', 'android', 'creature'].includes(type)) {
            return res.status(400).json({ error: 'Invalid minion type' });
        }

        // Production Logic (Simplified)
        let stats = {
            str: 5, dex: 5, con: 5, agi: 5, int: 5, wis: 5,
            lifespan: null, battery: 100, fuel: 100
        };

        if (type === 'human') {
            stats.lifespan = 80; // Years? Or game ticks? Let's say game units.
            stats.str = 3; stats.int = 7; // Humans smart?
        } else if (type === 'creature') {
            stats.lifespan = 50;
            stats.str = 8; stats.con = 8; // Creatures strong
        } else if (type === 'android') {
            stats.lifespan = null; // Immortal
            stats.str = 10; stats.defense = 10; // Androids tough
        }

        const result = db.prepare(`
            INSERT INTO character_minion 
            (user_id, type, name, strength, dexterity, constitution, agility, intelligence, wisdom, lifespan, battery, fuel, species)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(userId, type, name, stats.str, stats.dex, stats.con, stats.agi, stats.int, stats.wis, stats.lifespan, stats.battery, stats.fuel, species);

        res.json({ success: true, minionId: result.lastInsertRowid });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/character/:userId/minion/:minionId', (req, res) => {
    try {
        const { userId, minionId } = req.params;
        const result = db.prepare('DELETE FROM character_minion WHERE id = ? AND user_id = ?').run(minionId, userId);
        if (result.changes === 0) return res.status(404).json({ error: 'Minion not found' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Minion Actions
app.post('/api/character/:userId/minion/:minionId/rest', (req, res) => {
    try {
        const { minionId } = req.params;
        // Reset fatigue
        db.prepare('UPDATE character_minion SET fatigue = 0 WHERE id = ?').run(minionId);
        res.json({ success: true, message: "Minion fully rested" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/character/:userId/minion/:minionId/charge', (req, res) => { // Android only
    try {
        const { minionId } = req.params;
        // Reset battery
        db.prepare('UPDATE character_minion SET battery = 100 WHERE id = ?').run(minionId);
        res.json({ success: true, message: "Android battery charged" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/character/:userId/minion/:minionId/feed', (req, res) => { // Organic only
    try {
        const { minionId } = req.params;
        // Improve loyalty?
        db.prepare('UPDATE character_minion SET loyalty = MIN(100, loyalty + 10) WHERE id = ?').run(minionId);
        res.json({ success: true, message: "Minion fed, loyalty increased" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Economy: Market Ticker & APIs
// Economy: Market Ticker & APIs
const MARKET_UPDATE_INTERVAL = 60000; // 1 minute

// Global System Configuration
let SYSTEM_CONFIG = {
    market_fluctuation: true,
    npc_activity: true,
    client_polling_rate: 'NORMAL' // Reserved for future client-sync
};

function updateMarketPrices() {
    if (!SYSTEM_CONFIG.market_fluctuation) return; // Skip if disabled

    try {
        const items = db.prepare('SELECT * FROM market_items').all();
        const updateStmt = db.prepare('UPDATE market_items SET current_price = ?, previous_price = ? WHERE id = ?');

        items.forEach(item => {
            // Simple random fluctuation: -volatility% to +volatility%
            const changePercent = (Math.random() * (item.volatility * 2) - item.volatility) / 100;
            let newPrice = Math.floor(item.current_price * (1 + changePercent));

            // Bounds check (e.g., minimum 10% of base price, max 500% ?)
            if (newPrice < item.base_price * 0.1) newPrice = Math.floor(item.base_price * 0.1);

            updateStmt.run(newPrice, item.current_price, item.id);
        });
        console.log(`[Market] Prices updated at ${new Date().toLocaleTimeString()}`);
    } catch (e) {
        console.error("Market Update Error:", e);
    }
}

// Start Ticker
setInterval(updateMarketPrices, MARKET_UPDATE_INTERVAL);

// API: System Configuration
app.get('/api/admin/system/config', (req, res) => {
    res.json(SYSTEM_CONFIG);
});

app.post('/api/admin/system/config', (req, res) => {
    const { market_fluctuation, npc_activity } = req.body;
    if (market_fluctuation !== undefined) SYSTEM_CONFIG.market_fluctuation = market_fluctuation;
    if (npc_activity !== undefined) SYSTEM_CONFIG.npc_activity = npc_activity;

    console.log('[System] Config Updated:', SYSTEM_CONFIG);
    res.json({ success: true, config: SYSTEM_CONFIG });
});

// API: Get Market Items
app.get('/api/market', (req, res) => {
    try {
        const items = db.prepare('SELECT * FROM market_items').all();
        res.json(items);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API: Get Inventory
app.get('/api/inventory/:userId', (req, res) => {
    try {
        const inventory = db.prepare(`
            SELECT ui.*, mi.id as id, mi.name, mi.code, mi.description, mi.type, mi.slot, mi.stats 
            FROM user_inventory ui 
            JOIN market_items mi ON ui.item_id = mi.id 
            WHERE ui.user_id = ?
        `).all(req.params.userId);
        res.json(inventory);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API: Trade (Buy/Sell)
app.post('/api/market/trade', (req, res) => {
    const { user_id, item_id, type, quantity } = req.body; // type: 'BUY' or 'SELL'

    if (quantity <= 0) return res.status(400).json({ error: 'Invalid quantity' });

    try {
        const item = db.prepare('SELECT * FROM market_items WHERE id = ?').get(item_id);
        const userRes = db.prepare('SELECT * FROM user_resources WHERE user_id = ?').get(user_id);

        if (!item || !userRes) return res.status(404).json({ error: 'Item or User not found' });

        const totalCost = item.current_price * quantity;

        if (type === 'BUY') {
            if (userRes.gold < totalCost) {
                return res.status(400).json({ error: 'Insufficient Gold' });
            }

            // Transaction
            const buyTx = db.transaction(() => {
                // Deduct Gold
                db.prepare('UPDATE user_resources SET gold = gold - ? WHERE user_id = ?').run(totalCost, user_id);
                // Add Item
                const limit = db.prepare('SELECT * FROM user_inventory WHERE user_id = ? AND item_id = ?').get(user_id, item_id);
                if (limit) {
                    db.prepare('UPDATE user_inventory SET quantity = quantity + ? WHERE user_id = ? AND item_id = ?').run(quantity, user_id, item_id);
                } else {
                    db.prepare('INSERT INTO user_inventory (user_id, item_id, quantity) VALUES (?, ?, ?)').run(user_id, item_id, quantity);
                }
            });
            buyTx();
            res.json({ success: true, message: `Bought ${quantity} ${item.name}` });

        } else if (type === 'SELL') {
            const inventory = db.prepare('SELECT * FROM user_inventory WHERE user_id = ? AND item_id = ?').get(user_id, item_id);
            if (!inventory || inventory.quantity < quantity) {
                return res.status(400).json({ error: 'Insufficient Items' });
            }

            // Transaction
            const sellTx = db.transaction(() => {
                // Add Gold
                db.prepare('UPDATE user_resources SET gold = gold + ? WHERE user_id = ?').run(totalCost, user_id);
                // Deduct Item
                db.prepare('UPDATE user_inventory SET quantity = quantity - ? WHERE user_id = ? AND item_id = ?').run(quantity, user_id, item_id);
            });
            sellTx();
            res.json({ success: true, message: `Sold ${quantity} ${item.name}` });

        } else {
            res.status(400).json({ error: 'Invalid trade type' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Map APIs
app.get('/api/world-map', (req, res) => {
    try {
        const map = db.prepare('SELECT * FROM world_map').all();
        res.json(map);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update User Position (Move)
app.post('/api/map/move', (req, res) => {
    const { userId, targetId } = req.body;
    try {
        // Validate targetId format "x_y"
        if (!/^\d+_\d+$/.test(targetId)) throw new Error("Invalid Format");

        db.prepare('UPDATE users SET current_pos = ? WHERE id = ?').run(targetId, userId);
        res.json({ success: true, current_pos: targetId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Build API
app.post('/api/build', (req, res) => {
    const { user_id, type, x, y, world_x, world_y } = req.body;

    // Define Costs (Hardcoded for MVP)
    const COSTS = {
        'HOUSE': { gold: 100, gem: 0 },
        'FACTORY': { gold: 500, gem: 0 },
        'MINE': { gold: 300, gem: 0 },
        'TURRET': { gold: 200, gem: 0 }
    };

    const cost = COSTS[type];
    if (!cost) return res.status(400).json({ error: "Invalid Building Type" });

    try {
        const userRes = db.prepare('SELECT * FROM user_resources WHERE user_id = ?').get(user_id);
        if (!userRes || userRes.gold < cost.gold || userRes.gem < cost.gem) {
            return res.status(400).json({ error: "Insufficient Resources" });
        }

        // Check if space is occupied
        const existing = db.prepare('SELECT * FROM user_buildings WHERE world_x = ? AND world_y = ? AND x = ? AND y = ?')
            .get(world_x, world_y, x, y);
        if (existing) return res.status(400).json({ error: "Space Occupied" });

        // Transaction
        const buildTx = db.transaction(() => {
            // Deduct Resources
            db.prepare('UPDATE user_resources SET gold = gold - ?, gem = gem - ? WHERE user_id = ?').run(cost.gold, cost.gem, user_id);
            // Create Building
            db.prepare('INSERT INTO user_buildings (user_id, type, x, y, world_x, world_y) VALUES (?, ?, ?, ?, ?, ?)')
                .run(user_id, type, x, y, world_x, world_y);
        });

        buildTx();
        res.json({ success: true, message: `Built ${type}` });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Production APIs
app.get('/api/production/pending', (req, res) => {
    const { user_id } = req.query;
    if (!user_id) return res.status(400).json({ error: 'User ID required' });

    try {
        const buildings = db.prepare('SELECT * FROM user_buildings WHERE user_id = ?').all(user_id);
        const now = new Date();
        let totalGold = 0;
        let totalItems = [];

        buildings.forEach(b => {
            const lastCollected = new Date(b.last_collected_at);
            const diffMs = now - lastCollected;
            const diffMins = Math.floor(diffMs / 60000);

            if (diffMins > 0) {
                if (b.type === 'HOUSE') {
                    totalGold += 10 * diffMins;
                } else if (b.type === 'FACTORY') {
                    totalGold += 50 * diffMins;
                } else if (b.type === 'MINE') {
                    // 1 Iron Ore per min
                    totalItems.push({ code: 'IRON_ORE', qty: 1 * diffMins });
                }
            }
        });

        // Consolidate Items
        const consolidatedItems = totalItems.reduce((acc, curr) => {
            const existing = acc.find(i => i.code === curr.code);
            if (existing) existing.qty += curr.qty;
            else acc.push(curr);
            return acc;
        }, []);

        res.json({ gold: totalGold, items: consolidatedItems });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/production/collect', (req, res) => {
    const { user_id } = req.body;
    try {
        const buildings = db.prepare('SELECT * FROM user_buildings WHERE user_id = ?').all(user_id);
        const now = new Date();
        const nowStr = now.toISOString();
        let totalGold = 0;
        let totalItems = [];

        const collectTx = db.transaction(() => {
            buildings.forEach(b => {
                const lastCollected = new Date(b.last_collected_at);
                const diffMs = now - lastCollected;
                const diffMins = Math.floor(diffMs / 60000);

                if (diffMins > 0) {
                    if (b.type === 'HOUSE') {
                        totalGold += 10 * diffMins;
                    } else if (b.type === 'FACTORY') {
                        totalGold += 50 * diffMins;
                    } else if (b.type === 'MINE') {
                        totalItems.push({ code: 'IRON_ORE', qty: 1 * diffMins });
                    }

                    // Update timestamp
                    db.prepare('UPDATE user_buildings SET last_collected_at = ? WHERE id = ?').run(nowStr, b.id);
                }
            });

            // Credit Gold
            if (totalGold > 0) {
                db.prepare('UPDATE user_resources SET gold = gold + ? WHERE user_id = ?').run(totalGold, user_id);
            }

            // Credit Items
            totalItems.forEach(item => {
                const itemDb = db.prepare('SELECT id FROM market_items WHERE code = ?').get(item.code);
                if (itemDb) {
                    const existing = db.prepare('SELECT * FROM user_inventory WHERE user_id = ? AND item_id = ?').get(user_id, itemDb.id);
                    if (existing) {
                        db.prepare('UPDATE user_inventory SET quantity = quantity + ? WHERE user_id = ? AND item_id = ?').run(item.qty, user_id, itemDb.id);
                    } else {
                        db.prepare('INSERT INTO user_inventory (user_id, item_id, quantity) VALUES (?, ?, ?)').run(user_id, itemDb.id, item.qty);
                    }
                }
            });
        });

        collectTx();
        res.json({ success: true, gold: totalGold, items: totalItems.length });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/local-map/:id', (req, res) => {
    const tileId = req.params.id; // e.g., "5_5"

    // Get Biome
    const worldTile = db.prepare('SELECT type FROM world_map WHERE id = ?').get(tileId);
    const biome = worldTile ? worldTile.type : 'PLAIN';

    const [worldX, worldY] = tileId.split('_').map(Number);

    // Generate Clustered Terrain
    const grid = [];
    const size = 10;

    // 1. Initialize Base
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            grid.push({ x, y, type: 'BASE' }); // Placeholder
        }
    }

    // 2. Apply Biome Logic with Noise Clustering
    // Fetch User Buildings for this World Tile
    const buildings = db.prepare('SELECT * FROM user_buildings WHERE world_x = ? AND world_y = ?').all(worldX, worldY);

    grid.forEach(tile => {
        const seed = (worldX * 100 + worldY) * 1000 + (tile.x * 10 + tile.y);
        const noise = Math.abs(Math.sin(seed) * 10000) % 1; // 0-1

        let type = 'DIRT';

        // Check if building exists here
        const building = buildings.find(b => b.x === tile.x && b.y === tile.y);
        if (building) {
            tile.type = building.type;
            tile.building = building; // Pass full info
        } else {
            // Natural Terrain Logic
            if (biome === 'DESERT') {
                type = 'SAND';
                if (noise > 0.85) type = 'ROCK';
                if (noise > 0.96) type = 'OIL_RIG';
            } else if (biome === 'FOREST') {
                type = 'GRASS';
                if (noise > 0.4) type = 'TREE';
                if (noise > 0.9) type = 'Ruins'; // New!
            } else if (biome === 'ICE') {
                type = 'SNOW';
                if (noise > 0.7) type = 'ICE_WALL';
            } else if (biome === 'CITY') {
                type = 'CONCRETE';
                if (noise > 0.5) type = 'BUILDING';
                if (noise > 0.9) type = 'FACTORY';
            } else if (biome === 'MOUNTAIN') {
                type = 'ROCK';
                if (noise > 0.8) type = 'ORE'; // Future resource
            } else {
                // Plain
                type = 'GRASS';
                if (noise > 0.8) type = 'TREE';
            }

            tile.type = type;
        }
    });

    // 3. Cellular Automata Smoothing (Optional - for now just Return Grid)
    // A simple smoothing pass could make it look more organic:
    // ... logic omitted for MVP speed ...

    res.json({ id: tileId, grid: grid, biome });
});

// Admin APIs
const fs = require('fs');
const path = require('path');

app.get('/api/admin/users', (req, res) => {
    try {
        const users = db.prepare(`
            SELECT u.*, 
                   ur.gold, ur.gem,
                   us.strength, us.dexterity, us.constitution, us.agility, us.intelligence, us.wisdom
            FROM users u
            LEFT JOIN user_resources ur ON u.id = ur.user_id
            LEFT JOIN user_stats us ON u.id = us.user_id
        `).all();
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/admin/files', (req, res) => {
    const dbDir = path.join(__dirname, 'db');
    // For now scanning db dir, add more if needed
    try {
        const files = [];
        if (fs.existsSync(dbDir)) {
            const items = fs.readdirSync(dbDir);
            items.forEach(item => {
                if (item.endsWith('.db') || item.endsWith('.sql')) {
                    files.push({ name: item, path: 'db/' + item });
                }
            });
        }
        res.json(files);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Inspect Tables in a DB
app.get('/api/admin/db/:filename', (req, res) => {
    const dbPath = path.join(__dirname, 'db', req.params.filename);
    if (!fs.existsSync(dbPath)) return res.status(404).json({ error: 'File not found' });

    try {
        const tempDb = new db.constructor(dbPath);
        const tables = tempDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
        tempDb.close();
        res.json(tables.map(t => t.name));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Inspect Data in a Table
app.get('/api/admin/db/:filename/:table', (req, res) => {
    const dbPath = path.join(__dirname, 'db', req.params.filename);
    if (!fs.existsSync(dbPath)) return res.status(404).json({ error: 'File not found' });

    try {
        const tempDb = new db.constructor(dbPath);
        // Validate table name to prevent injection/errors (basic check)
        const tables = tempDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name);
        if (!tables.includes(req.params.table)) {
            tempDb.close();
            return res.status(404).json({ error: 'Table not found' });
        }

        const data = tempDb.prepare(`SELECT * FROM ${req.params.table} LIMIT 100`).all();
        tempDb.close();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin: Update User Stats/Resources
app.post('/api/admin/users/:id/update', (req, res) => {
    const userId = req.params.id;
    const { gold, gem, strength, dexterity, constitution, intelligence, wisdom, agility } = req.body;

    try {
        const tx = db.transaction(() => {
            if (gold !== undefined || gem !== undefined) {
                db.prepare('UPDATE user_resources SET gold = COALESCE(?, gold), gem = COALESCE(?, gem) WHERE user_id = ?')
                    .run(gold, gem, userId);
            }
            if (strength !== undefined) {
                db.prepare(`
                    UPDATE user_stats 
                    SET strength = COALESCE(?, strength),
                        dexterity = COALESCE(?, dexterity),
                        constitution = COALESCE(?, constitution),
                        intelligence = COALESCE(?, intelligence),
                        wisdom = COALESCE(?, wisdom),
                        agility = COALESCE(?, agility)
                    WHERE user_id = ?
                `).run(strength, dexterity, constitution, intelligence, wisdom, agility, userId);
            }
        });
        tx();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin: Send Mail
app.post('/api/admin/mail/send', (req, res) => {
    const { recipientId, title, content, items, scheduledAt } = req.body;
    // items: stringified JSON [{"code":"GOLD", "qty":100}, ...]

    try {
        const sendTx = db.transaction(() => {
            let recipients = [];
            if (recipientId === 'ALL') {
                recipients = db.prepare('SELECT id FROM users').all().map(u => u.id);
            } else {
                recipients = [recipientId];
            }

            const insert = db.prepare(`
                INSERT INTO mail (recipient_id, title, content, items, scheduled_at, expires_at) 
                VALUES (?, ?, ?, ?, ?, ?)
            `);

            const scheduleTime = scheduledAt || new Date().toISOString();
            const expireTime = req.body.expiresAt || null;

            recipients.forEach(rid => {
                insert.run(rid, title, content, items, scheduleTime, expireTime);
            });
        });

        sendTx();
        res.json({ success: true, count: recipientId === 'ALL' ? 'All Users' : 1 });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin: Get Mail History
app.get('/api/admin/mail/history', (req, res) => {
    try {
        const history = db.prepare(`
            SELECT m.*, u.username 
            FROM mail m 
            LEFT JOIN users u ON m.recipient_id = u.id 
            ORDER BY m.created_at DESC 
            LIMIT 100
        `).all();
        res.json(history);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// User: Get Mail
app.get('/api/mail/:userId', (req, res) => {
    try {
        const mails = db.prepare(`
            SELECT * FROM mail 
            WHERE recipient_id = ? 
            AND datetime(scheduled_at) <= datetime('now')
            AND (expires_at IS NULL OR datetime(expires_at) > datetime('now'))
            ORDER BY created_at DESC
        `).all(req.params.userId);
        // console.log(`[MailDebug] Fetching for user ${req.params.userId}. Found ${mails.length} msgs.`);

        res.json(mails);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// User: Claim Mail
app.post('/api/mail/claim', (req, res) => {
    const { mailId, userId } = req.body;
    try {
        const tx = db.transaction(() => {
            const mail = db.prepare('SELECT * FROM mail WHERE id = ? AND recipient_id = ?').get(mailId, userId);
            if (!mail) throw new Error("Mail not found");
            if (mail.is_claimed) throw new Error("Already claimed");

            // Process Items
            const items = JSON.parse(mail.items || '[]');
            items.forEach(item => {
                if (item.code === 'GOLD') {
                    db.prepare('UPDATE user_resources SET gold = gold + ? WHERE user_id = ?').run(item.qty, userId);
                } else if (item.code === 'GEM') {
                    db.prepare('UPDATE user_resources SET gem = gem + ? WHERE user_id = ?').run(item.qty, userId);
                } else {
                    // Item
                    const marketItem = db.prepare('SELECT id FROM market_items WHERE code = ?').get(item.code);
                    if (marketItem) {
                        const existing = db.prepare('SELECT * FROM user_inventory WHERE user_id = ? AND item_id = ?').get(userId, marketItem.id);
                        if (existing) {
                            db.prepare('UPDATE user_inventory SET quantity = quantity + ? WHERE user_id = ? AND item_id = ?').run(item.qty, userId, marketItem.id);
                        } else {
                            db.prepare('INSERT INTO user_inventory (user_id, item_id, quantity) VALUES (?, ?, ?)').run(userId, marketItem.id, item.qty);
                        }
                    }
                }
            });

            db.prepare('UPDATE mail SET is_claimed = 1 WHERE id = ?').run(mailId);
        });
        tx();
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// --- Admin Task Persistence --- //

// Get All Tasks & Categories
app.get('/api/admin/planning', (req, res) => {
    try {
        const tasksRaw = db.prepare('SELECT * FROM admin_tasks ORDER BY created_at DESC').all();
        const tasks = tasksRaw.map(t => ({
            id: t.id,
            title: t.title,
            description: t.description,
            status: t.status,
            categoryId: t.category_id,
            createdAt: t.created_at
        }));
        const categories = db.prepare('SELECT * FROM admin_categories').all();
        res.json({ tasks, categories });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create/Update Task
app.post('/api/admin/tasks', (req, res) => {
    const { id, title, description, status, categoryId, createdAt } = req.body;
    try {
        const stmt = db.prepare(`
            INSERT INTO admin_tasks (id, title, description, status, category_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            description = excluded.description,
            status = excluded.status,
            category_id = excluded.category_id
        `);
        stmt.run(id, title, description, status, categoryId, createdAt || Date.now());
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete Task
app.delete('/api/admin/tasks/:id', (req, res) => {
    try {
        db.prepare('DELETE FROM admin_tasks WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Sync Categories (Full Sync or Single Update - Implementing Single/Bulk Upsert for simplicity)
app.post('/api/admin/categories', (req, res) => {
    const categories = req.body; // Expects Array
    try {
        const tx = db.transaction(() => {
            const stmt = db.prepare(`
                INSERT INTO admin_categories (id, label, color)
                VALUES (?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                label = excluded.label,
                color = excluded.color
            `);
            categories.forEach(c => stmt.run(c.id, c.label, c.color));
        });
        tx();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete Category
app.delete('/api/admin/categories/:id', (req, res) => {
    try {
        db.prepare('DELETE FROM admin_categories WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
