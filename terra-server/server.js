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
                // Let's implement auto-seed for admin in initialization or just handle it here for MVP simplicity if needed,
                // but typically we seed DB. Let's do it in database.js actually? No, here is dynamic.
                // Let's stick to: if username is 'admin', require password provided matches DB.
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
