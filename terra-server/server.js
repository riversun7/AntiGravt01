const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
}));
app.use(bodyParser.json());

// DEBUG: Log all incoming requests
app.use((req, res, next) => {
    console.log(`[REQUEST] ${req.method} ${req.url} from ${req.ip}`);
    next();
});

// 0. Health Check (To verify connectivity/port)
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Terra Server is running', port: PORT });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`========================================`);
    console.log(`🚀 TERRA SERVER RUNNING on port ${PORT}`);
    console.log(`========================================`);
});


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
                if (!password || password !== user.password) {
                    return res.status(401).json({ error: 'Invalid Password' });
                }
            }

            // Update last login
            db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);
            console.log(`User logged in: ${username}`);
        }

        res.json({ user });
    } catch (err) {
        console.error('Login error details:', err);
        // RETURN ACTUAL ERROR FOR DEBUGGING (Temporary for NAS diagnosis)
        res.status(500).json({ error: 'Internal server error', details: err.message, stack: err.stack });
    }
});

// 2. Get User Info (with resources & equipment)
app.get('/api/user/:id', (req, res) => {
    try {
        let user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
        if (!user) return res.status(404).json({ error: 'User not found' });

        // Check Movement Resolution
        if (user.destination_pos && user.arrival_time) {
            const now = new Date();
            const arrival = new Date(user.arrival_time);

            if (now >= arrival) {
                // Arrived
                db.prepare(`
                    UPDATE users 
                    SET current_pos = destination_pos, 
                        destination_pos = NULL, 
                        start_pos = NULL, 
                        arrival_time = NULL, 
                        departure_time = NULL 
                    WHERE id = ?
                `).run(user.id);

                // Fetch updated user
                user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
            }
        }

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
    market_fluctuation: false, // Default OFF
    production_active: false, // Default OFF
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

// ============================================
// RESOURCE PRODUCTION CRON (1 minute interval)
// ============================================

const PRODUCTION_INTERVAL = 60000; // 1 minute

function processResourceProduction() {
    if (!SYSTEM_CONFIG.production_active) return; // Skip if disabled

    try {
        // Get all active mining assignments
        const miningAssignments = db.prepare(`
            SELECT 
                a.*,
                b.type as building_type,
                b.user_id,
                m.type as minion_type,
                m.strength,
                m.intelligence,
                m.hp,
                m.battery,
                m.fuel
            FROM building_assignments a
            JOIN user_buildings b ON a.building_id = b.id
            JOIN character_minion m ON a.minion_id = m.id
            WHERE a.task_type = 'mining'
        `).all();

        console.log(`[Production] Processing ${miningAssignments.length} mining assignments...`);

        miningAssignments.forEach(assignment => {
            // 1. Check if minion can continue working
            const canWork = checkMinionHealth(assignment);
            if (!canWork) {
                console.log(`[Production] Minion ${assignment.minion_id} sent to barracks (low health/battery)`);
                return;
            }

            // 2. Calculate production based on stats
            const baseProduction = 10; // 10 gold per minute
            const production = Math.floor(baseProduction * assignment.production_rate);

            // 3. Update accumulated resources
            db.prepare(`
                UPDATE building_assignments 
                SET resources_collected = resources_collected + ?
                WHERE id = ?
            `).run(production, assignment.id);

            // 4. Drain health/battery
            drainMinionResources(assignment);

            console.log(`[Production] Minion ${assignment.minion_id} produced ${production} gold`);
        });

        // Process resting minions (recovery)
        processRestingMinions();

    } catch (e) {
        console.error('[Production] Error:', e);
    }
}

function checkMinionHealth(assignment) {
    // Check HP for all types
    if (assignment.hp < 30) {
        sendToBarracks(assignment.minion_id, assignment.user_id);
        return false;
    }

    // Check battery for androids
    if (assignment.minion_type === 'android' && assignment.battery < 20) {
        sendToBarracks(assignment.minion_id, assignment.user_id);
        return false;
    }

    return true;
}

function drainMinionResources(assignment) {
    const healthDrain = assignment.minion_type === 'android' ? 0 : 2; // Organic types lose HP
    const batteryDrain = assignment.minion_type === 'android' ? 3 : 0; // Androids lose battery
    const fuelDrain = 1; // All types consume some fuel

    db.prepare(`
        UPDATE character_minion 
        SET hp = MAX(0, hp - ?),
            battery = MAX(0, battery - ?),
            fuel = MAX(0, fuel - ?)
        WHERE id = ?
    `).run(healthDrain, batteryDrain, fuelDrain, assignment.minion_id);
}

function sendToBarracks(minionId, userId) {
    try {
        // Find user's barracks
        const barracks = db.prepare(`
            SELECT * FROM user_buildings 
            WHERE user_id = ? AND type = 'BARRACKS'
            ORDER BY id ASC LIMIT 1
        `).get(userId);

        if (!barracks) {
            console.warn(`[Production] No barracks found for user ${userId}, minion ${minionId} removed from assignment`);
            // Remove from current assignment
            db.prepare('DELETE FROM building_assignments WHERE minion_id = ?').run(minionId);
            return;
        }

        // Remove from current assignment and assign to barracks
        db.transaction(() => {
            db.prepare('DELETE FROM building_assignments WHERE minion_id = ?').run(minionId);
            db.prepare(`
                INSERT INTO building_assignments (building_id, minion_id, task_type, production_rate)
                VALUES (?, ?, 'resting', 1.0)
            `).run(barracks.id, minionId);
        })();

        console.log(`[Production] Minion ${minionId} sent to barracks ${barracks.id}`);
    } catch (e) {
        console.error('[Production] Error sending to barracks:', e);
    }
}

function processRestingMinions() {
    const restingAssignments = db.prepare(`
        SELECT 
            a.*,
            m.type as minion_type,
            m.hp,
            m.battery,
            m.fuel
        FROM building_assignments a
        JOIN character_minion m ON a.minion_id = m.id
        WHERE a.task_type = 'resting'
    `).all();

    restingAssignments.forEach(assignment => {
        const healthRecover = 10; // HP per minute
        const batteryRecover = assignment.minion_type === 'android' ? 15 : 0; // Battery per minute
        const fuelRecover = 5;

        db.prepare(`
            UPDATE character_minion 
            SET hp = MIN(100, hp + ?),
                battery = MIN(100, battery + ?),
                fuel = MIN(100, fuel + ?)
            WHERE id = ?
        `).run(healthRecover, batteryRecover, fuelRecover, assignment.minion_id);

        // Check if fully recovered
        const minion = db.prepare('SELECT hp, battery, type FROM character_minion WHERE id = ?').get(assignment.minion_id);
        const isFullyRecovered = minion.hp >= 100 &&
            (minion.type !== 'android' || minion.battery >= 100);

        if (isFullyRecovered) {
            // Remove from barracks (make idle)
            db.prepare('DELETE FROM building_assignments WHERE id = ?').run(assignment.id);
            console.log(`[Production] Minion ${assignment.minion_id} fully recovered, now idle`);
        }
    });
}

// Start production cron
setInterval(processResourceProduction, PRODUCTION_INTERVAL);
console.log('[Production] Resource production cron started (1 minute interval)');


// API: System Configuration
app.get('/api/admin/system/config', (req, res) => {
    res.json(SYSTEM_CONFIG);
});

app.post('/api/admin/system/config', (req, res) => {
    const { market_fluctuation, npc_activity, production_active } = req.body;
    if (market_fluctuation !== undefined) SYSTEM_CONFIG.market_fluctuation = market_fluctuation;
    if (production_active !== undefined) SYSTEM_CONFIG.production_active = production_active;
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

        const user = db.prepare('SELECT current_pos, destination_pos FROM users WHERE id = ?').get(userId);
        if (user.destination_pos) throw new Error("Already moving");

        // Calculate Distance
        const [x1, y1] = (user.current_pos || "10_10").split('_').map(Number);
        const [x2, y2] = targetId.split('_').map(Number);

        // Euclidean distance
        const dist = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));

        // Speed: 2 seconds per unit distance, minimum 3 seconds
        // Adjust this factor to tune gameplay speed
        const travelTimeMs = Math.max(3000, Math.floor(dist * 200));
        const now = new Date();
        const arrival = new Date(now.getTime() + travelTimeMs);

        db.prepare(`
            UPDATE users 
            SET start_pos = current_pos, 
                destination_pos = ?, 
                departure_time = ?, 
                arrival_time = ? 
            WHERE id = ?
        `).run(targetId, now.toISOString(), arrival.toISOString(), userId);

        res.json({ success: true, arrival_time: arrival.toISOString(), duration: travelTimeMs, start_pos: user.current_pos, target_pos: targetId });
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

// User: Claim All Mail
app.post('/api/mail/claim-all', (req, res) => {
    const { userId } = req.body;
    try {
        let totalClaimed = 0;
        let claimedItems = [];

        const tx = db.transaction(() => {
            // Get all unclaimed mail
            const mails = db.prepare(`
                SELECT * FROM mail 
                WHERE recipient_id = ? AND is_claimed = 0
                AND datetime(scheduled_at) <= datetime('now')
                AND (expires_at IS NULL OR datetime(expires_at) > datetime('now'))
            `).all(userId);

            if (mails.length === 0) return;

            mails.forEach(mail => {
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
                    claimedItems.push(item);
                });
                totalClaimed++;
            });

            // Mark all as claimed
            db.prepare(`
                UPDATE mail 
                SET is_claimed = 1 
                WHERE recipient_id = ? AND is_claimed = 0
                AND datetime(scheduled_at) <= datetime('now')
                AND (expires_at IS NULL OR datetime(expires_at) > datetime('now'))
            `).run(userId);
        });
        tx();

        res.json({ success: true, count: totalClaimed, items: claimedItems });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// User: Delete Claimed Mail
app.delete('/api/mail/claimed', (req, res) => {
    const { userId } = req.body;
    try {
        const info = db.prepare('DELETE FROM mail WHERE recipient_id = ? AND is_claimed = 1').run(userId);
        res.json({ success: true, deleted: info.changes });
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

// ============================================
// GAME MAP APIs (Leaflet Game Map System)
// ============================================

// Get Game State (Buildings + Player Position)
app.get('/api/game/state', (req, res) => {
    const { userId } = req.query;

    if (!userId) {
        return res.status(400).json({ error: 'User ID required' });
    }

    try {
        // Get player position from users table
        const user = db.prepare('SELECT current_pos FROM users WHERE id = ?').get(userId);
        let playerPosition = { x: 0, y: 0 };

        if (user && user.current_pos) {
            const [x, y] = user.current_pos.split('_').map(Number);
            playerPosition = { x, y };
        }

        // Get all buildings for this user (using existing user_buildings table)
        const buildings = db.prepare(`
            SELECT id, type, x, y, level, user_id, created_at
            FROM user_buildings 
            WHERE user_id = ?
        `).all(userId);

        res.json({
            playerPosition,
            buildings: buildings.map(b => ({
                id: b.id,
                type: b.type.toLowerCase(), // Convert HOUSE to house
                x: b.x,
                y: b.y,
                level: b.level || 1,
                user_id: b.user_id,
                created_at: b.created_at
            }))
        });
    } catch (err) {
        console.error('Game state error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Save Player Position
app.post('/api/game/move', (req, res) => {
    const { userId, x, y } = req.body;

    if (!userId) {
        return res.status(400).json({ error: 'User ID required' });
    }

    try {
        // Save position with decimal precision as "x_y" format in current_pos
        const position = `${x}_${y}`;
        db.prepare('UPDATE users SET current_pos = ? WHERE id = ?').run(position, userId);

        res.json({ success: true, position: { x, y } });
    } catch (err) {
        console.error('Move error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Place Building on Game Map
app.post('/api/game/build', (req, res) => {
    const { userId, type, x, y } = req.body;

    if (!userId || !type) {
        return res.status(400).json({ error: 'User ID and building type required' });
    }

    try {
        // Use world_x and world_y as 0 for game map (non-world map buildings)
        // Use x,y as the game map coordinates - keep decimal precision
        const result = db.prepare(`
            INSERT INTO user_buildings (user_id, type, x, y, world_x, world_y, level)
            VALUES (?, ?, ?, ?, 0, 0, 1)
        `).run(userId, type.toUpperCase(), x, y);

        const newBuilding = {
            id: result.lastInsertRowid,
            type: type,
            x: x,
            y: y,
            user_id: parseInt(userId),
            created_at: new Date().toISOString()
        };

        res.json(newBuilding);
    } catch (err) {
        console.error('Build error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Destroy Building
app.delete('/api/game/building/:buildingId', (req, res) => {
    const { buildingId } = req.params;
    const userId = req.query.userId;

    if (!userId || !buildingId) {
        return res.status(400).json({ error: 'User ID and Building ID required' });
    }

    try {
        // Verify ownership
        const building = db.prepare('SELECT * FROM user_buildings WHERE id = ? AND user_id = ?').get(buildingId, userId);

        if (!building) {
            return res.status(404).json({ error: 'Building not found or not owned by user' });
        }

        // Delete building (CASCADE will remove assignments)
        db.prepare('DELETE FROM user_buildings WHERE id = ?').run(buildingId);

        res.json({ success: true, message: 'Building destroyed' });
    } catch (err) {
        console.error('Destroy building error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// BUILDING ASSIGNMENT APIs (Unit Assignment System)
// ============================================

// Get all assignments across all buildings (for filtering assigned minions)
app.get('/api/buildings/all/assignments', (req, res) => {
    try {
        const assignments = db.prepare(`
            SELECT minion_id
            FROM building_assignments
        `).all();

        res.json(assignments);
    } catch (err) {
        console.error('Get all assignments error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Get assignments for a specific building
app.get('/api/buildings/:buildingId/assignments', (req, res) => {
    const { buildingId } = req.params;

    try {
        const assignments = db.prepare(`
            SELECT 
                a.*,
                m.name as minion_name,
                m.type as minion_type,
                m.species,
                m.strength,
                m.dexterity,
                m.constitution,
                m.intelligence,
                m.hp,
                m.mp,
                m.battery,
                m.fuel,
                m.fatigue,
                m.loyalty
            FROM building_assignments a
            JOIN character_minion m ON a.minion_id = m.id
            WHERE a.building_id = ?
        `).all(buildingId);

        res.json(assignments);
    } catch (err) {
        console.error('Get assignments error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Assign a minion to a building
app.post('/api/buildings/:buildingId/assign', (req, res) => {
    const { buildingId } = req.params;
    const { minionId, taskType } = req.body;

    if (!minionId || !taskType) {
        return res.status(400).json({ error: 'Minion ID and task type required' });
    }

    if (!['mining', 'guarding', 'resting'].includes(taskType)) {
        return res.status(400).json({ error: 'Invalid task type' });
    }

    try {
        // Check if minion is already assigned somewhere
        const existingAssignment = db.prepare(`
            SELECT * FROM building_assignments WHERE minion_id = ?
        `).get(minionId);

        if (existingAssignment) {
            return res.status(400).json({ error: 'Minion is already assigned to another building' });
        }

        // Get minion stats to calculate production rate
        const minion = db.prepare('SELECT * FROM character_minion WHERE id = ?').get(minionId);
        if (!minion) {
            return res.status(404).json({ error: 'Minion not found' });
        }

        // Calculate production efficiency based on stats
        const baseEfficiency = 1.0;
        const statBonus = (minion.strength + minion.intelligence) / 20; // 0.5 to 1.0 range typically
        const productionRate = baseEfficiency * (1 + statBonus * 0.5); // Max 1.5x efficiency

        // Create assignment
        const result = db.prepare(`
            INSERT INTO building_assignments (building_id, minion_id, task_type, production_rate)
            VALUES (?, ?, ?, ?)
        `).run(buildingId, minionId, taskType, productionRate);

        const newAssignment = db.prepare(`
            SELECT 
                a.*,
                m.name as minion_name,
                m.type as minion_type
            FROM building_assignments a
            JOIN character_minion m ON a.minion_id = m.id
            WHERE a.id = ?
        `).get(result.lastInsertRowid);

        res.json(newAssignment);
    } catch (err) {
        console.error('Assign minion error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Remove a minion from a building
app.delete('/api/buildings/:buildingId/assign/:minionId', (req, res) => {
    const { buildingId, minionId } = req.params;

    try {
        // Get assignment to check collected resources
        const assignment = db.prepare(`
            SELECT * FROM building_assignments 
            WHERE building_id = ? AND minion_id = ?
        `).get(buildingId, minionId);

        if (!assignment) {
            return res.status(404).json({ error: 'Assignment not found' });
        }

        // Auto-collect resources before removing
        const collectedResources = assignment.resources_collected;

        if (collectedResources > 0) {
            // Get building owner
            const building = db.prepare('SELECT user_id FROM user_buildings WHERE id = ?').get(buildingId);

            // Add resources to user
            db.prepare(`
                UPDATE user_resources 
                SET gold = gold + ?
                WHERE user_id = ?
            `).run(collectedResources, building.user_id);
        }

        // Remove assignment
        db.prepare(`
            DELETE FROM building_assignments 
            WHERE building_id = ? AND minion_id = ?
        `).run(buildingId, minionId);

        res.json({
            success: true,
            collectedResources,
            message: `Minion removed. Collected ${collectedResources} gold.`
        });
    } catch (err) {
        console.error('Remove minion error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Get all minions for a user with their assignment status
app.get('/api/characters/minions', (req, res) => {
    const userId = req.query.userId;
    if (!userId) {
        return res.status(400).json({ error: 'User ID required' });
    }

    try {
        const minions = db.prepare(`
            SELECT
                m.*,
                ba.building_id,
                ba.task_type,
                ub.type as building_type
            FROM character_minion m
            LEFT JOIN building_assignments ba ON m.id = ba.minion_id
            LEFT JOIN user_buildings ub ON ba.building_id = ub.id
            WHERE m.user_id = ?
        `).all(userId);

        const result = minions.map(m => ({
            id: m.id,
            name: m.name,
            type: m.type,
            hp: m.hp,
            battery: m.battery,
            fatigue: m.fatigue,
            status: m.building_id ? `Active (${m.building_type})` : 'Idle'
        }));

        // Get user name for Commander
        const user = db.prepare('SELECT username FROM users WHERE id = ?').get(userId);

        // Add Commander
        result.unshift({
            id: 'commander',
            name: user ? user.username : 'Commander',
            type: 'human',
            hp: 100,
            battery: 100,
            fatigue: 0,
            status: 'Active (Command)',
            isCommander: true
        });

        res.json(result);
    } catch (err) {
        console.error('Get minions error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Collect resources from a building
app.post('/api/buildings/:buildingId/collect', (req, res) => {
    const { buildingId } = req.params;

    try {
        // Get all assignments for this building
        const assignments = db.prepare(`
            SELECT * FROM building_assignments WHERE building_id = ?
        `).all(buildingId);

        if (assignments.length === 0) {
            return res.json({ gold: 0, message: 'No minions assigned' });
        }

        let totalGold = 0;

        // Transaction
        db.transaction(() => {
            assignments.forEach(assignment => {
                totalGold += assignment.resources_collected;

                // Reset collected resources
                db.prepare(`
                    UPDATE building_assignments 
                    SET resources_collected = 0, last_collection = CURRENT_TIMESTAMP
                    WHERE id = ?
                `).run(assignment.id);
            });

            // Get building owner and add resources
            const building = db.prepare('SELECT user_id FROM user_buildings WHERE id = ?').get(buildingId);

            db.prepare(`
                UPDATE user_resources 
                SET gold = gold + ?
                WHERE user_id = ?
            `).run(totalGold, building.user_id);
        })();

        res.json({
            success: true,
            gold: totalGold,
            message: `Collected ${totalGold} gold`
        });
    } catch (err) {
        console.error('Collect resources error:', err);
        res.status(500).json({ error: err.message });
    }
});


app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
