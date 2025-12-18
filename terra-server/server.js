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

// 2. Get User Info (with resources)
app.get('/api/user/:id', (req, res) => {
    try {
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
        if (!user) return res.status(404).json({ error: 'User not found' });

        const resources = db.prepare('SELECT * FROM user_resources WHERE user_id = ?').get(req.params.id);
        const stats = db.prepare('SELECT * FROM user_stats WHERE user_id = ?').get(req.params.id);

        res.json({ ...user, resources, stats });
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

// Economy: Market Ticker & APIs
const MARKET_UPDATE_INTERVAL = 60000; // 1 minute

function updateMarketPrices() {
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
            SELECT ui.*, mi.name, mi.code, mi.description 
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

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
