const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./database');
const fs = require('fs');
const path = require('path');

const TerrainManager = require('./game/TerrainManager');
const terrainManager = new TerrainManager(db);
const PathfindingService = require('./game/PathfindingService');
const pathfindingService = new PathfindingService(db);

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
            // Initialize resources
            db.prepare('INSERT INTO user_resources (user_id, gold, gem) VALUES (?, ?, ?)').run(userId, 1000, 10);

            // Create default cyborg with base stats
            // Base stats defaults handled by table schema or explicit insert here
            db.prepare('INSERT INTO character_cyborg (user_id, name) VALUES (?, ?)').run(userId, 'New Commander');

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

        // Fetch Main Character (Cyborg) for stats display on User Profile if needed
        const cyborg = db.prepare('SELECT * FROM character_cyborg WHERE user_id = ?').get(req.params.id);

        // Fetch Equipment with Item Details
        const equipment = db.prepare(`
            SELECT ue.*, mi.name, mi.code, mi.description, mi.stats, mi.type 
            FROM user_equipment ue
            JOIN market_items mi ON ue.item_id = mi.id
            WHERE ue.user_id = ?
        `).all(req.params.id);

        // Return cyborg stats merged at top level for backward compatibility if client expects "stats" object, 
        // OR just return cyborg object. Client seems to use "user.stats" in some places?
        // Let's check client usage later. For now, we can map cyborg stats to "stats" property if needed.
        // Actually, previous code did: ...user, resources, stats, equipment
        // So "stats" was a top-level key.

        let stats = null;
        if (cyborg) {
            stats = {
                strength: cyborg.strength,
                dexterity: cyborg.dexterity,
                constitution: cyborg.constitution,
                agility: cyborg.agility,
                intelligence: cyborg.intelligence,
                wisdom: cyborg.wisdom,
                hp: cyborg.hp,
                mp: cyborg.mp
            };
        }

        res.json({ ...user, resources, stats, equipment, cyborg });
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

        db.prepare(`UPDATE character_cyborg SET strength = ?, dexterity = ?, constitution = ?, agility = ?, intelligence = ?, wisdom = ? WHERE user_id = ?`)
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
    npc_activity: false, // Default OFF (Minion AI)
    faction_active: false, // Default OFF (Absolute & Free Faction AI)
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
// MINION AI TICK SYSTEM (30 seconds interval)
// ============================================

const MINION_AI_INTERVAL = 30000; // 30 seconds
const MinionAI = require('./ai/MinionAI');
const minionAI = new MinionAI(db);

function processMinionAI() {
    if (!SYSTEM_CONFIG.npc_activity) return;

    try {
        // Get all users with minions
        const usersWithMinions = db.prepare(`
            SELECT DISTINCT user_id 
            FROM character_minion
        `).all();

        let totalActions = 0;

        usersWithMinions.forEach(({ user_id }) => {
            const results = minionAI.processUserMinions(user_id);
            totalActions += results.length;

            // Log actions (optional, can be removed in production)
            results.forEach(result => {
                console.log(`[Minion AI] Minion ${result.minion_id}: ${result.action} - ${result.reason}`);
            });
        });

        if (totalActions > 0) {
            console.log(`[Minion AI] Processed ${totalActions} minion actions`);
        }
    } catch (err) {
        console.error('[Minion AI] Error processing minions:', err);
    }
}

// Start Minion AI Ticker
setInterval(processMinionAI, MINION_AI_INTERVAL);
console.log(`[Minion AI] AI tick system started (${MINION_AI_INTERVAL / 1000}s interval)`);

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

// NPC Logic Cron
const absoluteNpcManager = require('./ai/AbsoluteNpcManager');
const freeNpcManager = require('./ai/FreeNpcManager');
const NPC_INTERVAL = 60000; // 1 minute
setInterval(() => {
    if (!SYSTEM_CONFIG.faction_active) return;

    console.log('[NPC] Faction Logic ACTIVE - Running...');
    absoluteNpcManager.run();
    freeNpcManager.run();
}, NPC_INTERVAL);
console.log('[NPC] Absolute & Free Faction Logic cron started');


// API: System Configuration
app.get('/api/admin/system/config', (req, res) => {
    res.json(SYSTEM_CONFIG);
});

app.post('/api/admin/system/config', (req, res) => {
    const { market_fluctuation, npc_activity, production_active, faction_active } = req.body;
    if (market_fluctuation !== undefined) SYSTEM_CONFIG.market_fluctuation = market_fluctuation;
    if (production_active !== undefined) SYSTEM_CONFIG.production_active = production_active;
    if (npc_activity !== undefined) SYSTEM_CONFIG.npc_activity = npc_activity;
    if (faction_active !== undefined) SYSTEM_CONFIG.faction_active = faction_active;

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

// API: Terrain Info (Public)
app.get('/api/map/terrain', async (req, res) => {
    const { lat, lng } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: 'Lat/Lng required' });

    try {
        const info = await terrainManager.getTerrainInfo(parseFloat(lat), parseFloat(lng));
        res.json(info);
    } catch (err) {
        console.error("Terrain API Error:", err);
        res.json({ type: 'PLAIN', elevation: 0, error: err.message });
    }
});

// API: Admin Set Terrain (God Mode)
app.post('/api/admin/tile', (req, res) => {
    const { x, y, terrain_type, resource_type, notes } = req.body;
    // Assuming x,y are grid coords.
    // Basic Auth check (TODO: Real Admin check)
    // const { userId } = req.body;
    // const user = db.prepare('SELECT role FROM users WHERE id = ?').get(userId);
    // if (!user || user.role !== 'admin') ...

    try {
        db.prepare(`
            INSERT INTO tile_overrides (x, y, terrain_type, resource_type, notes)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(x, y, world_x, world_y) DO UPDATE SET
            terrain_type = excluded.terrain_type,
            resource_type = excluded.resource_type,
            notes = excluded.notes
        `).run(x, y, terrain_type, resource_type, notes);

        res.json({ success: true, message: 'Tile override saved' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// app.get('/api/world-map', (req, res) => { ... }); // REMOVED (Client uses TerrainMap/Leaflet tiles)

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
    const def = buildingDefs[type];
    if (!def) return res.status(400).json({ error: "Invalid Building Type" });

    try {
        const userRes = db.prepare('SELECT * FROM user_resources WHERE user_id = ?').get(userId);
        if (!userRes || userRes.gold < def.cost.gold || userRes.gem < def.cost.gem) {
            return res.status(400).json({ error: "Insufficient Resources" });
        }
        // 2. Territory Constraints
        // Check if inside ANY territory (radius check)
        // distance in km.
        // Approx conversion: distance = sqrt((x2-x1)^2 + (y2-y1)^2) * 111 (if lat/lng)
        // Since we store territories with radius, we need to check all.
        // Optimization: In real game, use spatial index. For now, scan all "territory centers".

        const territories = db.prepare(`
            SELECT ub.id, ub.user_id, ub.x, ub.y, ub.territory_radius, ub.is_territory_center, u.npc_type
            FROM user_buildings ub
            JOIN users u ON ub.user_id = u.id
            WHERE ub.is_territory_center = 1
        `).all();

        let insideTerritory = null;
        for (const t of territories) {
            const distDeg = Math.sqrt(Math.pow(t.x - x, 2) + Math.pow(t.y - y, 2));
            const distKm = distDeg * 111;
            if (distKm <= t.territory_radius) {
                insideTerritory = t;
                break;
            }
        }

        // Logic Table:
        // 1. Outside all territories -> OK (Neutral land)
        // 2. Inside OWN territory -> OK
        // 3. Inside OTHER territory:
        //    - If Hostile -> FAIL
        //    - If Ally -> Create Request (PENDING)
        //    - If Neutral -> FAIL (Default rule: Close borders)

        if (insideTerritory && insideTerritory.user_id !== userId) {
            const ownerId = insideTerritory.user_id;

            // Get Factions
            const requester = db.prepare('SELECT faction_id FROM users WHERE id = ?').get(userId);
            const owner = db.prepare('SELECT faction_id FROM users WHERE id = ?').get(ownerId);

            let relation = 0;

            if (requester.faction_id && owner.faction_id) {
                if (requester.faction_id === owner.faction_id) {
                    relation = 100; // Same Faction = Ally
                } else {
                    const diplo = db.prepare(`
                        SELECT stance FROM faction_diplomacy 
                        WHERE (faction_id_a = ? AND faction_id_b = ?) 
                           OR (faction_id_a = ? AND faction_id_b = ?)
                    `).get(requester.faction_id, owner.faction_id, owner.faction_id, requester.faction_id);
                    relation = diplo ? diplo.stance : 0;
                }
            } else {
                // One of them has no faction -> Neutral (0)
                relation = 0;
            }

            console.log(`[Construction] User ${userId} (Fac:${requester.faction_id}) trying to build on ${ownerId} (Fac:${owner.faction_id}). Relation: ${relation}`);

            if (relation < -20) {
                return res.status(403).json({ error: 'Cannot build on hostile territory.' });
            } else if (relation >= 50) {
                // Alliance: Create Request
                db.prepare(`
                    INSERT INTO construction_requests (requester_id, owner_id, building_type, x, y, status)
                    VALUES (?, ?, ?, ?, ?, 'PENDING')
                `).run(userId, ownerId, type, x, y);

                return res.status(202).json({
                    success: true,
                    message: 'Construction request sent to territory owner.'
                });
            } else {
                return res.status(403).json({ error: 'Construction requires Alliance status.' });
            }
        }

        // Proceed with construction if Own land or Neutral land
        // Deduct cost
        db.prepare('UPDATE user_resources SET gold = gold - ?, gem = gem - ? WHERE user_id = ?').run(def.cost.gold, def.cost.gem, userId);

        // Create Building
        const isTerritory = def.isTerritory ? 1 : 0;
        const radius = isTerritory ? 2.0 : 0; // Default 2km radius for new CC

        db.prepare(`
            INSERT INTO user_buildings (user_id, type, x, y, world_x, world_y, is_territory_center, territory_radius, level)
            VALUES (?, ?, ?, ?, 0, 0, ?, ?, 1)
        `).run(userId, type, x, y, isTerritory, radius);

        res.json({ success: true, message: 'Building constructed.' });

    } catch (err) {
        console.error('Construction error:', err);
        res.status(500).json({ error: err.message });
    }
});

// =========================================
// DIPLOMACY REQUESTS API
// =========================================

// Get pending requests for the owner
app.get('/api/diplomacy/requests', (req, res) => {
    const { userId } = req.query; // Authenticated user ID
    if (!userId) return res.status(400).json({ error: 'User ID required' });

    try {
        const requests = db.prepare(`
            SELECT cr.*, u.username as requester_name 
            FROM construction_requests cr
            JOIN users u ON cr.requester_id = u.id
            WHERE cr.owner_id = ? AND cr.status = 'PENDING'
        `).all(userId);

        res.json({ requests });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Approve Request
app.post('/api/diplomacy/requests/:requestId/approve', (req, res) => {
    const { requestId } = req.params;

    try {
        const request = db.prepare('SELECT * FROM construction_requests WHERE id = ?').get(requestId);
        if (!request || request.status !== 'PENDING') {
            return res.status(404).json({ error: 'Request not found or processed' });
        }

        // Logic:
        // 1. Deduct cost from Requester (Check funds again)
        // 2. Build the building
        // 3. Update Status

        // Simplified Defs lookup (Duplicate code, should verify consistency)
        const buildingDefs = {
            'COMMAND_CENTER': { cost: { gold: 500, gem: 5 }, isTerritory: true },
            'WAREHOUSE': { cost: { gold: 50, gem: 0 }, isTerritory: false },
            'MINE': { cost: { gold: 100, gem: 0 }, isTerritory: false },
            'FARM': { cost: { gold: 75, gem: 0 }, isTerritory: false },
            'BARRACKS': { cost: { gold: 150, gem: 0 }, isTerritory: false },
            'FACTORY': { cost: { gold: 200, gem: 0 }, isTerritory: false }
        };
        const def = buildingDefs[request.building_type];

        // Transaction
        const tx = db.transaction(() => {
            // Check requester funds
            const resources = db.prepare('SELECT gold, gem FROM user_resources WHERE user_id = ?').get(request.requester_id);
            if (resources.gold < def.cost.gold || resources.gem < def.cost.gem) {
                throw new Error('Requester has insufficient funds');
            }

            // Pay
            db.prepare('UPDATE user_resources SET gold = gold - ?, gem = gem - ? WHERE user_id = ?')
                .run(def.cost.gold, def.cost.gem, request.requester_id);

            // Build
            db.prepare(`
                INSERT INTO user_buildings (user_id, type, x, y, world_x, world_y, is_territory_center, territory_radius, level)
                VALUES (?, ?, ?, ?, 0, 0, 0, 0, 1)
            `).run(request.requester_id, request.building_type, request.x, request.y);

            // Update Request
            db.prepare("UPDATE construction_requests SET status = 'APPROVED' WHERE id = ?").run(requestId);
        });

        try {
            tx();
            res.json({ success: true, message: 'Request approved and building constructed.' });
        } catch (txErr) {
            res.status(400).json({ error: txErr.message });
        }

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Reject Request
app.post('/api/diplomacy/requests/:requestId/reject', (req, res) => {
    const { requestId } = req.params;
    try {
        db.prepare("UPDATE construction_requests SET status = 'REJECTED' WHERE id = ?").run(requestId);
        res.json({ success: true, message: 'Request rejected.' });
    } catch (err) {
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

// Map APIs
// app.get('/api/local-map/:id', ...); // REMOVED (Client uses TerrainMap/Leaflet tiles)

// Admin APIs

app.get('/api/admin/users', (req, res) => {
    try {
        const users = db.prepare(`
            SELECT u.*, 
                   ur.gold, ur.gem,
                   cc.strength, cc.dexterity, cc.constitution, cc.agility, cc.intelligence, cc.wisdom,
                   cc.name as cyborg_name
            FROM users u
            LEFT JOIN user_resources ur ON u.id = ur.user_id
            LEFT JOIN character_cyborg cc ON u.id = cc.user_id
        `).all();
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/admin/files', (req, res) => {
    // Correct Path: terra-data/db (same as database.js)
    const dbDir = path.join(__dirname, '..', 'terra-data', 'db');

    try {
        const files = [];
        if (fs.existsSync(dbDir)) {
            const items = fs.readdirSync(dbDir);
            items.forEach(item => {
                if (item.endsWith('.db') || item.endsWith('.sql') || item.endsWith('.sqlite')) {
                    files.push({
                        name: item,
                        path: 'db/' + item,
                        download_url: `/api/admin/db/${item}/download`
                    });
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
    const dbPath = path.join(__dirname, '..', 'terra-data', 'db', req.params.filename);
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
    const dbPath = path.join(__dirname, '..', 'terra-data', 'db', req.params.filename);
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

// Download DB File
app.get('/api/admin/db/:filename/download', (req, res) => {
    const dbPath = path.join(__dirname, '..', 'terra-data', 'db', req.params.filename);
    if (!fs.existsSync(dbPath)) return res.status(404).json({ error: 'File not found' });
    res.download(dbPath);
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
                    UPDATE character_cyborg 
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
        let playerPosition = null;

        if (user && user.current_pos && user.current_pos !== '10_10') {
            const [x, y] = user.current_pos.split('_').map(Number);
            playerPosition = { x, y };
        } else {
            // Fallback: Try to find Command Center (HQ)
            const hq = db.prepare("SELECT x, y FROM user_buildings WHERE user_id = ? AND type = 'COMMAND_CENTER'").get(userId);
            if (hq) {
                playerPosition = { x: hq.x, y: hq.y };
                // Persist as current pos
                db.prepare("UPDATE users SET current_pos = ? WHERE id = ?").run(`${hq.x}_${hq.y}`, userId);
                console.log(`[GameState] Defaulted user ${userId} to HQ at ${hq.x}, ${hq.y}`);
            } else {
                // Fallback: Any building
                const anyBldg = db.prepare("SELECT x, y FROM user_buildings WHERE user_id = ? LIMIT 1").get(userId);
                if (anyBldg) {
                    playerPosition = { x: anyBldg.x, y: anyBldg.y };
                    db.prepare("UPDATE users SET current_pos = ? WHERE id = ?").run(`${anyBldg.x}_${anyBldg.y}`, userId);
                    console.log(`[GameState] Defaulted user ${userId} to Building at ${anyBldg.x}, ${anyBldg.y}`);
                }
            }
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

// Place Building on Game Map (With Tech Tree Logic)
app.post('/api/game/build', (req, res) => {
    const { userId, type, x, y } = req.body;

    if (!userId || !type) {
        return res.status(400).json({ error: 'User ID and building type required' });
    }

    try {
        const buildingType = type.toUpperCase();

        // 1. Tech Tree Verification
        if (buildingType === 'FACTORY') {
            // Requirement: Command Center (COMMANDER) must exist and be Level >= 2
            const commandCenter = db.prepare(`
                SELECT level FROM user_buildings 
                WHERE user_id = ? AND type = 'COMMANDER'
            `).get(userId);

            if (!commandCenter) {
                return res.status(400).json({ error: 'Requires Command Center to build Factory' });
            }
            if (commandCenter.level < 2) {
                return res.status(400).json({ error: 'Command Center Level 2 required for Factory' });
            }
        }

        // 2. Limit Checks
        if (buildingType === 'COMMANDER') {
            const existing = db.prepare(`SELECT id FROM user_buildings WHERE user_id = ? AND type = 'COMMANDER'`).get(userId);
            if (existing) {
                return res.status(400).json({ error: 'You can only have one Command Center' });
            }
        }

        // Use world_x and world_y as 0 for game map (non-world map buildings)
        // Use x,y as the game map coordinates - keep decimal precision
        const result = db.prepare(`
            INSERT INTO user_buildings (user_id, type, x, y, world_x, world_y, level)
            VALUES (?, ?, ?, ?, 0, 0, 1)
        `).run(userId, buildingType, x, y);

        const newBuilding = {
            id: result.lastInsertRowid,
            type: buildingType,
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
        // Verify existence
        const building = db.prepare('SELECT * FROM user_buildings WHERE id = ?').get(buildingId);

        if (!building) {
            return res.status(404).json({ error: 'Building not found' });
        }

        // CHECK: Absolute NPC Protection
        const owner = db.prepare('SELECT npc_type FROM users WHERE id = ?').get(building.user_id);
        if (owner && owner.npc_type === 'ABSOLUTE') {
            return res.status(403).json({ error: 'Target is an Absolute Neutral Faction. Cannot be destroyed.' });
        }

        // Verify ownership (or Admin override)
        if (String(building.user_id) !== String(userId) && String(userId) !== '1') {
            return res.status(403).json({ error: 'Not authorized to destroy this building' });
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
        const rate = (minion.strength + minion.intelligence) / 10.0; // Higher is better

        // Create assignment
        db.prepare(`
            INSERT INTO building_assignments (building_id, minion_id, task_type, production_rate)
            VALUES (?, ?, ?, ?)
        `).run(buildingId, minionId, taskType, rate);

        // Update minion status for UI
        db.prepare('UPDATE character_minion SET current_action = ? WHERE id = ?')
            .run(taskType.toUpperCase(), minionId);

        res.json({ success: true, message: 'Minion assigned successfully' });
    } catch (err) {
        console.error('Assign minion error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Unassign a minion (Recall)
app.delete('/api/buildings/:buildingId/assign/:minionId', (req, res) => {
    const { buildingId, minionId } = req.params;

    try {
        // 1. Collect any pending resources first
        const assignment = db.prepare(`
            SELECT resources_collected, minion_id 
            FROM building_assignments 
            WHERE building_id = ? AND minion_id = ?
        `).get(buildingId, minionId);

        if (assignment && assignment.resources_collected > 0) {
            const minion = db.prepare('SELECT user_id FROM character_minion WHERE id = ?').get(minionId);
            if (minion) {
                db.prepare('UPDATE user_resources SET gold = gold + ? WHERE user_id = ?')
                    .run(assignment.resources_collected, minion.user_id);
            }
        }

        // 2. Remove assignment
        const result = db.prepare(`
            DELETE FROM building_assignments 
            WHERE building_id = ? AND minion_id = ?
        `).run(buildingId, minionId);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Assignment not found' });
        }

        // 3. Reset Minion Status
        db.prepare("UPDATE character_minion SET current_action = 'IDLE' WHERE id = ?").run(minionId);

        res.json({ success: true, message: 'Minion recalled', collected: assignment ? assignment.resources_collected : 0 });
    } catch (err) {
        console.error('Recall minion error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Collect resources from building (All minions)
app.post('/api/buildings/:buildingId/collect', (req, res) => {
    const { buildingId } = req.params;
    const { userId } = req.body;

    if (!userId) return res.status(400).json({ error: 'User ID required' });

    try {
        // Collect Transaction
        const tx = db.transaction(() => {
            // 1. Calculate Total Pending Resources
            const total = db.prepare(`
                SELECT SUM(resources_collected) as amount 
                FROM building_assignments 
                WHERE building_id = ?
            `).get(buildingId);

            if (!total.amount || total.amount <= 0) {
                return { success: true, amount: 0, message: 'No resources to collect' };
            }

            // 2. Calculate User Storage Capacity (VOLUME BASED)
            // Constants
            const VOL_PER_GOLD = 0.001; // 1000 Gold = 1 Volume
            const VOL_PER_GEM = 0.0001;

            const warehouses = db.prepare(`
                SELECT level FROM user_buildings 
                WHERE user_id = ? AND type = 'WAREHOUSE'
            `).all(userId);

            const BASE_VOLUME_CAPACITY = 10.0; // 10,000 Gold cap base
            const WAREHOUSE_VOL_PER_LEVEL = 50.0; // 50,000 Gold cap per warehouse level

            const maxVolume = BASE_VOLUME_CAPACITY + warehouses.reduce((sum, w) => sum + (w.level * WAREHOUSE_VOL_PER_LEVEL), 0);

            // 3. Get Current Volume (Gold + Gem)
            // Note: Ideally we sum inventory too, but for resource collection cap, we usually focus on liquid assets.
            // Extending to include inventory would require summing all item volumes. Included for completeness if simple.
            const userRes = db.prepare('SELECT gold, gem FROM user_resources WHERE user_id = ?').get(userId);
            const currentGold = userRes ? userRes.gold : 0;
            const currentGem = userRes ? userRes.gem : 0;

            const currentVolume = (currentGold * VOL_PER_GOLD) + (currentGem * VOL_PER_GEM);

            // 4. Calculate Collectible Amount (Gold Only for now)
            const availableVolume = maxVolume - currentVolume;

            if (availableVolume <= 0) {
                return { success: false, error: 'Storage Volume Full! Build more Warehouses.' };
            }

            const pendingGold = total.amount;
            const pendingVolume = pendingGold * VOL_PER_GOLD;

            const collectableVolume = Math.min(pendingVolume, availableVolume);
            const amountToCollect = Math.floor(collectableVolume / VOL_PER_GOLD);

            if (amountToCollect <= 0) {
                return { success: false, error: 'Storage Volume Full! Build more Warehouses.' };
            }

            const remaining = pendingGold - amountToCollect;

            // 5. Update User Resources
            db.prepare('UPDATE user_resources SET gold = gold + ? WHERE user_id = ?').run(amountToCollect, userId);

            // 6. Update Assignments
            if (remaining <= 0) {
                db.prepare('UPDATE building_assignments SET resources_collected = 0 WHERE building_id = ?').run(buildingId);
            } else {
                const assignments = db.prepare('SELECT id, resources_collected FROM building_assignments WHERE building_id = ? AND resources_collected > 0').all(buildingId);

                let collectedSoFar = 0;
                for (const a of assignments) {
                    if (collectedSoFar >= amountToCollect) break;

                    const take = Math.min(a.resources_collected, amountToCollect - collectedSoFar);
                    db.prepare('UPDATE building_assignments SET resources_collected = resources_collected - ? WHERE id = ?').run(take, a.id);
                    collectedSoFar += take;
                }
            }

            // Update last collected time
            db.prepare('UPDATE user_buildings SET last_collected_at = CURRENT_TIMESTAMP WHERE id = ?').run(buildingId);

            return {
                success: true,
                amount: amountToCollect,
                maxStorage: maxVolume / VOL_PER_GOLD, // Display as Gold Equiv
                currentGold: currentGold + amountToCollect,
                volumeUsage: { current: currentVolume + collectableVolume, max: maxVolume }
            };
        });

        const result = tx();
        if (result.error) {
            return res.status(400).json(result);
        }
        res.json(result);

    } catch (err) {
        console.error('Collect resources error:', err);
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

// =========================================
// RESOURCE SYSTEM API ENDPOINTS
// =========================================
const { ResourceType, RESOURCE_DEFINITIONS } = require('./types/ResourceTypes');

// Get or create warehouse for user
app.get('/api/warehouse/:userId', (req, res) => {
    try {
        let warehouse = db.prepare('SELECT * FROM warehouses WHERE user_id = ?').get(req.params.userId);

        if (!warehouse) {
            // Create default warehouse
            const info = db.prepare('INSERT INTO warehouses (user_id, capacity) VALUES (?, ?)').run(req.params.userId, 1000);
            warehouse = db.prepare('SELECT * FROM warehouses WHERE id = ?').get(info.lastInsertRowid);
        }

        // Parse stored resources
        warehouse.stored_resources = JSON.parse(warehouse.stored_resources || '{}');
        res.json({ warehouse });
    } catch (err) {
        console.error('Get warehouse error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Gather resources from a node
app.post('/api/resources/gather', (req, res) => {
    const { userId, nodeId } = req.body;

    if (!userId || !nodeId) {
        return res.status(400).json({ error: 'userId and nodeId are required' });
    }

    try {
        // Get resource node
        const node = db.prepare('SELECT * FROM resource_nodes WHERE id = ?').get(nodeId);
        if (!node) {
            return res.status(404).json({ error: 'Resource node not found' });
        }

        // Get resource definition
        const resourceDef = RESOURCE_DEFINITIONS[node.resource_type];
        if (!resourceDef) {
            return res.status(400).json({ error: 'Invalid resource type' });
        }

        // Check if node has resources
        if (node.current_amount <= 0) {
            return res.status(400).json({ error: 'Resource node is depleted' });
        }

        // Get warehouse
        let warehouse = db.prepare('SELECT * FROM warehouses WHERE user_id = ?').get(userId);
        if (!warehouse) {
            const info = db.prepare('INSERT INTO warehouses (user_id, capacity) VALUES (?, ?)').run(userId, 1000);
            warehouse = db.prepare('SELECT * FROM warehouses WHERE id = ?').get(info.lastInsertRowid);
        }

        // Parse stored resources
        let stored = JSON.parse(warehouse.stored_resources || '{}');
        const currentTotal = Object.values(stored).reduce((sum, qty) => sum + qty, 0);

        // Check warehouse capacity
        if (currentTotal >= warehouse.capacity) {
            return res.status(400).json({ error: 'Warehouse is full' });
        }

        // Calculate gather amount (1 unit for now, can be improved with minion stats)
        const gatherAmount = Math.min(1, node.current_amount, warehouse.capacity - currentTotal);

        // Update node
        db.prepare('UPDATE resource_nodes SET current_amount = current_amount - ? WHERE id = ?').run(gatherAmount, nodeId);

        // Update warehouse
        stored[node.resource_type] = (stored[node.resource_type] || 0) + gatherAmount;
        db.prepare('UPDATE warehouses SET stored_resources = ? WHERE id = ?').run(JSON.stringify(stored), warehouse.id);

        res.json({
            success: true,
            gathered: gatherAmount,
            resourceType: node.resource_type,
            resourceName: resourceDef.name,
            warehouse: {
                ...warehouse,
                stored_resources: stored
            }
        });
    } catch (err) {
        console.error('Gather resources error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Get market prices
app.get('/api/market/prices', (req, res) => {
    try {
        let prices = db.prepare('SELECT * FROM market_prices').all();

        // Initialize if empty
        if (prices.length === 0) {
            Object.values(ResourceType).forEach(resourceType => {
                const def = RESOURCE_DEFINITIONS[resourceType];
                if (def) {
                    const basePrice = def.rarity === 'COMMON' ? 10 :
                        def.rarity === 'UNCOMMON' ? 50 :
                            def.rarity === 'RARE' ? 200 :
                                def.rarity === 'EPIC' ? 1000 : 5000;

                    db.prepare(`
                        INSERT INTO market_prices (resource_type, current_price, base_price, demand, supply)
                        VALUES (?, ?, ?, 100, 100)
                    `).run(resourceType, basePrice, basePrice);
                }
            });

            prices = db.prepare('SELECT * FROM market_prices').all();
        }

        res.json({ prices });
    } catch (err) {
        console.error('Get market prices error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Sell resources on market
app.post('/api/market/sell', (req, res) => {
    const { userId, resourceType, quantity } = req.body;

    if (!userId || !resourceType || !quantity || quantity <= 0) {
        return res.status(400).json({ error: 'Invalid request' });
    }

    try {
        // Get warehouse
        const warehouse = db.prepare('SELECT * FROM warehouses WHERE user_id = ?').get(userId);
        if (!warehouse) {
            return res.status(404).json({ error: 'Warehouse not found' });
        }

        // Parse stored resources
        let stored = JSON.parse(warehouse.stored_resources || '{}');
        const currentAmount = stored[resourceType] || 0;

        if (currentAmount < quantity) {
            return res.status(400).json({ error: 'Insufficient resources' });
        }

        // Get market price
        const priceData = db.prepare('SELECT * FROM market_prices WHERE resource_type = ?').get(resourceType);
        if (!priceData) {
            return res.status(404).json({ error: 'Resource not found in market' });
        }

        const totalGold = priceData.current_price * quantity;

        // Update warehouse
        stored[resourceType] -= quantity;
        if (stored[resourceType] === 0) delete stored[resourceType];
        db.prepare('UPDATE warehouses SET stored_resources = ? WHERE id = ?').run(JSON.stringify(stored), warehouse.id);

        // Update user gold
        db.prepare('UPDATE user_resources SET gold = gold + ? WHERE user_id = ?').run(totalGold, userId);

        // Update market (increase supply, decrease price slightly)
        const newSupply = priceData.supply + quantity;
        const newPrice = Math.max(Math.floor(priceData.base_price * (100 / newSupply)), 1);
        db.prepare('UPDATE market_prices SET supply = ?, current_price = ?, last_updated = CURRENT_TIMESTAMP WHERE resource_type = ?')
            .run(newSupply, newPrice, resourceType);

        res.json({
            success: true,
            sold: quantity,
            goldEarned: totalGold,
            newPrice
        });
    } catch (err) {
        console.error('Sell resources error:', err);
        res.status(500).json({ error: err.message });
    }
});

// =========================================
// MINION MANAGEMENT API ENDPOINTS
// =========================================

// Get all minions for a user
app.get('/api/minions/:userId', (req, res) => {
    try {
        const minions = db.prepare('SELECT * FROM character_minion WHERE user_id = ?').all(req.params.userId);
        res.json({ minions });
    } catch (err) {
        console.error('Get minions error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Get single minion details
app.get('/api/minion/:minionId', (req, res) => {
    try {
        const minion = db.prepare('SELECT * FROM character_minion WHERE id = ?').get(req.params.minionId);
        if (!minion) {
            return res.status(404).json({ error: 'Minion not found' });
        }

        // Parse preferences
        minion.preferences = JSON.parse(minion.preferences || '{}');
        res.json({ minion });
    } catch (err) {
        console.error('Get minion error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Create a new minion
app.post('/api/minions/create', (req, res) => {
    const { userId, type, name, preferences } = req.body;

    if (!userId || !type || !name) {
        return res.status(400).json({ error: 'userId, type, and name are required' });
    }

    if (!['human', 'android', 'creature'].includes(type)) {
        return res.status(400).json({ error: 'Invalid minion type' });
    }

    try {
        const prefsJson = JSON.stringify(preferences || {});

        const info = db.prepare(`
            INSERT INTO character_minion (
                user_id, type, name, hunger, stamina, battery, preferences, current_action
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            userId,
            type,
            name,
            type !== 'android' ? 50 : 0,  // hunger
            type !== 'android' ? 100 : 0, // stamina
            type === 'android' ? 100 : 0, // battery
            prefsJson,
            'IDLE'
        );

        const minion = db.prepare('SELECT * FROM character_minion WHERE id = ?').get(info.lastInsertRowid);
        minion.preferences = JSON.parse(minion.preferences);

        res.json({
            success: true,
            minion
        });
    } catch (err) {
        console.error('Create minion error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Update minion preferences
app.put('/api/minion/:minionId/preferences', (req, res) => {
    const { preferences } = req.body;

    if (!preferences) {
        return res.status(400).json({ error: 'Preferences are required' });
    }

    try {
        const prefsJson = JSON.stringify(preferences);
        db.prepare('UPDATE character_minion SET preferences = ? WHERE id = ?')
            .run(prefsJson, req.params.minionId);

        const minion = db.prepare('SELECT * FROM character_minion WHERE id = ?').get(req.params.minionId);
        minion.preferences = JSON.parse(minion.preferences);

        res.json({
            success: true,
            minion
        });
    } catch (err) {
        console.error('Update preferences error:', err);
        res.status(500).json({ error: err.message });
    }
});

// =========================================
// TERRITORY SYSTEM API ENDPOINTS
// =========================================

// Claim a tile (Legacy: kept for backward compatibility but effectively deprecated)
app.post('/api/tiles/claim', (req, res) => {
    // Legacy support or simplified claim logic can remain if needed,
    // but the new system relies on Command Centers.
    // For now, let's just allow it for non-territory claims or disable it?
    // User requested "overhaul", implying replacement.
    res.status(400).json({ error: 'Tile claiming is deprecated. Please construct a Command Center.' });
});

// Get tile info
// Get tile info (Deprecated - world_map removed)
app.get('/api/tiles/:tileId', (req, res) => {
    res.status(404).json({ error: 'Tile system deprecated' });
});

// Get user owned tiles (Deprecated - world_map removed)
app.get('/api/tiles/user/:userId', (req, res) => {
    res.json({ tiles: [] });
});

// Get all territories (Command Centers)
app.get('/api/territories', (req, res) => {
    try {
        const territories = db.prepare(`
            SELECT ub.id, ub.user_id, ub.x, ub.y, ub.territory_radius, ub.is_territory_center, ub.custom_boundary, ub.level,
                   u.username as owner_name, f.name as faction_name, f.type as npc_type, f.color, f.id as faction_id
            FROM user_buildings ub
            LEFT JOIN users u ON ub.user_id = u.id
            LEFT JOIN factions f ON u.faction_id = f.id
            WHERE ub.is_territory_center = 1
        `).all();

        // Color fallback if no faction (Player without faction)
        const enriched = territories.map(t => {
            let color = t.color || '#00FFFF'; // Default to Faction Color or Cyan
            return { ...t, color };
        });

        res.json({ territories: enriched });
    } catch (err) {
        console.error('Get territories error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Get Faction List for Diplomacy
app.get('/api/factions', (req, res) => {
    try {
        // Fetch from new 'factions' table
        const factions = db.prepare(`
            SELECT id, name as username, type as npc_type, description as personality, color, type, leader_id
            FROM factions
        `).all();

        const parsed = factions.map(f => {
            return {
                ...f,
                username: f.username, // name mapped to username
                npc_type: f.npc_type, // type mapped to npc_type
                tech_focus: 'Balanced', // Todo: Add to faction schema
                diplomatic_stance: {} // Todo: Fetch real stance
            };
        });

        res.json({ factions: parsed });
    } catch (err) {
        console.error('Get factions error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Admin: Spawn Free NPC
app.post('/api/admin/spawn-free-npc', (req, res) => {
    const { name, color, lat, lng } = req.body;
    // Basic validation
    if (!name) return res.status(400).json({ error: 'Name is required' });

    try {
        const username = name.toLowerCase().replace(/\s+/g, '_') + '_npc';
        const tagName = name.slice(0, 3).toUpperCase();

        // 1. Create Faction
        const factionInfo = db.prepare('INSERT INTO factions (name, tag, description, color, type) VALUES (?, ?, ?, ?, ?)')
            .run(name, tagName, 'Free Roaming Faction', color || '#CCCCCC', 'FREE');
        const factionId = factionInfo.lastInsertRowid;

        // 2. Create User (Leader)
        const userInfo = db.prepare('INSERT INTO users (username, password, npc_type, personality, tech_focus, faction_id, faction_rank) VALUES (?, ?, ?, ?, ?, ?, ?)')
            .run(username, 'npc_password', 'FREE', 'Aggressive', 'Military', factionId, 2);
        const userId = userInfo.lastInsertRowid;

        // Link User to Faction Leader
        db.prepare('UPDATE factions SET leader_id = ? WHERE id = ?').run(userId, factionId);

        // Give Resources
        db.prepare('INSERT INTO user_resources (user_id, gold, gem) VALUES (?, ?, ?)').run(userId, 5000, 100);

        // 3. Determine Location
        let spawnX = lat;
        let spawnY = lng;
        let worldX = 0;
        let worldY = 0;

        if (!spawnX || !spawnY) {
            // Find random location far from others
            // Simple approach: Random Grid (-20 to 20)
            worldX = Math.floor(Math.random() * 40) - 20;
            worldY = Math.floor(Math.random() * 40) - 20;
            // Convert to Real (Seed logic reference: 36.0 + 0.1*wx)
            spawnX = 36.0 + (worldX * 0.1);
            spawnY = 127.0 + (worldY * 0.1);
        } else {
            // Provided Lat/Lng is "Real" coords.
            // Estimate World Grid? Not strictly needed unless we enforce grid logic.
            // For now, allow arbitrary.
        }

        // 4. Create Outpost
        db.prepare(`
            INSERT INTO user_buildings (user_id, type, x, y, world_x, world_y, is_territory_center, territory_radius, level)
            VALUES (?, 'OUTPOST', ?, ?, ?, ?, 1, 2.0, 1)
        `).run(userId, spawnX, spawnY, worldX, worldY);

        console.log(`[Admin] Spawned Free NPC: ${name} at ${spawnX}, ${spawnY}`);

        res.json({ success: true, message: `Spawned ${name} at ${spawnX}, ${spawnY}`, factionId, userId });

    } catch (err) {
        console.error('Spawn NPC Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Build (Construct Building)
app.post('/api/buildings/construct', (req, res) => {
    const { userId, type, x, y, tileId } = req.body; // x, y are Lat/Lng or generic coords

    if (!userId || !type) {
        return res.status(400).json({ error: 'userId and type are required' });
    }

    try {
        // 1. Get Building Type Definition from DB
        const buildingType = db.prepare('SELECT * FROM building_types WHERE code = ?').get(type.toUpperCase());
        if (!buildingType) {
            return res.status(400).json({ error: 'Invalid building type' });
        }

        // 2. Parse Costs and Prerequisites
        const constructionCost = JSON.parse(buildingType.construction_cost || '{}');
        const prerequisites = JSON.parse(buildingType.prerequisites || '[]');

        // 3. Check Prerequisites (user must have built required buildings)
        if (prerequisites.length > 0) {
            const userBuildings = db.prepare('SELECT DISTINCT building_type_code, type FROM user_buildings WHERE user_id = ?').all(userId);
            const userBuildingCodes = userBuildings.map(b => b.building_type_code || b.type.toUpperCase());

            for (const prereq of prerequisites) {
                if (!userBuildingCodes.includes(prereq)) {
                    return res.status(400).json({
                        error: `Prerequisites not met. Required: ${prerequisites.join(', ')}`,
                        missing: prereq
                    });
                }
            }
        }

        // 4. Resource Check (support multiple resource types)
        const resources = db.prepare('SELECT gold, gem FROM user_resources WHERE user_id = ?').get(userId);
        if (!resources) {
            return res.status(400).json({ error: 'User resources not found' });
        }

        // Check gold and gem from user_resources
        if (constructionCost.gold && resources.gold < constructionCost.gold) {
            return res.status(400).json({ error: `Insufficient gold. Required: ${constructionCost.gold}, Available: ${resources.gold}` });
        }
        if (constructionCost.gem && resources.gem < constructionCost.gem) {
            return res.status(400).json({ error: `Insufficient gems. Required: ${constructionCost.gem}, Available: ${resources.gem}` });
        }

        // TODO: Check other resources (wood, ore, etc.) from warehouse when implemented
        // For now, we'll allow construction if gold/gem are sufficient

        // 5. Territory Constraints
        function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
            var R = 6371;
            var dLat = deg2rad(lat2 - lat1);
            var dLon = deg2rad(lon2 - lon1);
            var a =
                Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
            var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            var d = R * c;
            return d;
        }

        function deg2rad(deg) {
            return deg * (Math.PI / 180);
        }

        let isTerritoryCenter = buildingType.is_territory_center;
        let radius = buildingType.territory_radius;

        if (isTerritoryCenter) {
            // Check distance to ALL other territory centers
            const existingCenters = db.prepare('SELECT x, y FROM user_buildings WHERE is_territory_center = 1').all();
            for (const center of existingCenters) {
                const dist = getDistanceFromLatLonInKm(x, y, center.x, center.y);
                if (dist < 3.0) {
                    return res.status(400).json({ error: `Too close to another territory! Minimum distance is 3km. Current: ${dist.toFixed(2)}km` });
                }
            }
        } else {
            // Must be built WITHIN an owned territory
            const myCenters = db.prepare('SELECT x, y, territory_radius FROM user_buildings WHERE user_id = ? AND is_territory_center = 1').all(userId);
            let inTerritory = false;
            for (const center of myCenters) {
                const dist = getDistanceFromLatLonInKm(x, y, center.x, center.y);
                if (dist <= center.territory_radius) {
                    inTerritory = true;
                    break;
                }
            }
            // Admin override
            if (!inTerritory && userId !== '1') {
                return res.status(400).json({ error: 'Must build within your territory' });
            }
        }

        // 6. Deduct Resources
        let deductions = [];
        if (constructionCost.gold) {
            db.prepare('UPDATE user_resources SET gold = gold - ? WHERE user_id = ?').run(constructionCost.gold, userId);
            deductions.push(`${constructionCost.gold} gold`);
        }
        if (constructionCost.gem) {
            db.prepare('UPDATE user_resources SET gem = gem - ? WHERE user_id = ?').run(constructionCost.gem, userId);
            deductions.push(`${constructionCost.gem} gems`);
        }

        // 7. Construct Building
        const gridX = Math.floor((y + 180) / 360 * 160);
        const gridY = Math.floor((90 - x) / 180 * 80);

        const result = db.prepare(`
            INSERT INTO user_buildings (
                user_id, type, building_type_code, x, y, world_x, world_y, 
                is_territory_center, territory_radius, last_maintenance_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).run(userId, type, buildingType.code, x, y, gridX, gridY, isTerritoryCenter, radius);

        const newBuilding = db.prepare('SELECT * FROM user_buildings WHERE id = ?').get(result.lastInsertRowid);

        res.json({
            success: true,
            building: newBuilding,
            message: `Construction complete. Costs: ${deductions.join(', ')}`,
            buildingInfo: {
                name: buildingType.name,
                description: buildingType.description,
                tier: buildingType.tier
            }
        });

    } catch (err) {
        console.error('Construction error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ----------------------------------------------------------------------
// BUILDING TYPES MANAGEMENT (ADMIN)
// ----------------------------------------------------------------------

// Get all building types
app.get('/api/admin/building-types', (req, res) => {
    try {
        const buildingTypes = db.prepare('SELECT * FROM building_types ORDER BY tier, category').all();
        const parsed = buildingTypes.map(bt => ({
            ...bt,
            construction_cost: JSON.parse(bt.construction_cost || '{}'),
            maintenance_cost: JSON.parse(bt.maintenance_cost || '{}'),
            prerequisites: JSON.parse(bt.prerequisites || '[]')
        }));
        res.json({ buildingTypes: parsed });
    } catch (err) {
        console.error('Get building types error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Add new building type
app.post('/api/admin/building-types', (req, res) => {
    const {
        code, name, description, tier, category,
        construction_cost, maintenance_cost,
        min_units, max_units, storage_volume,
        production_type, production_rate,
        is_territory_center, territory_radius,
        prerequisites
    } = req.body;

    if (!code || !name) {
        return res.status(400).json({ error: 'code and name are required' });
    }

    try {
        const result = db.prepare(`
            INSERT INTO building_types (
                code, name, description, tier, category,
                construction_cost, maintenance_cost,
                min_units, max_units, storage_volume,
                production_type, production_rate,
                is_territory_center, territory_radius,
                prerequisites
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            code.toUpperCase(),
            name,
            description || '',
            tier || 1,
            category || 'GENERAL',
            JSON.stringify(construction_cost || {}),
            JSON.stringify(maintenance_cost || {}),
            min_units || 0,
            max_units || 0,
            storage_volume || 0.0,
            production_type || null,
            production_rate || 0.0,
            is_territory_center || 0,
            territory_radius || 0.0,
            JSON.stringify(prerequisites || [])
        );

        const newType = db.prepare('SELECT * FROM building_types WHERE id = ?').get(result.lastInsertRowid);
        res.json({ success: true, buildingType: newType });
    } catch (err) {
        console.error('Add building type error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Update building type
app.put('/api/admin/building-types/:code', (req, res) => {
    const { code } = req.params;
    const updates = req.body;

    try {
        const existing = db.prepare('SELECT * FROM building_types WHERE code = ?').get(code.toUpperCase());
        if (!existing) {
            return res.status(404).json({ error: 'Building type not found' });
        }

        const allowedFields = [
            'name', 'description', 'tier', 'category',
            'min_units', 'max_units', 'storage_volume',
            'production_type', 'production_rate',
            'is_territory_center', 'territory_radius'
        ];

        const updateParts = [];
        const values = [];

        allowedFields.forEach(field => {
            if (updates[field] !== undefined) {
                updateParts.push(`${field} = ?`);
                values.push(updates[field]);
            }
        });

        if (updates.construction_cost) {
            updateParts.push('construction_cost = ?');
            values.push(JSON.stringify(updates.construction_cost));
        }
        if (updates.maintenance_cost) {
            updateParts.push('maintenance_cost = ?');
            values.push(JSON.stringify(updates.maintenance_cost));
        }
        if (updates.prerequisites) {
            updateParts.push('prerequisites = ?');
            values.push(JSON.stringify(updates.prerequisites));
        }

        if (updateParts.length === 0) {
            return res.status(400).json({ error: 'No valid fields to update' });
        }

        values.push(code.toUpperCase());
        const query = `UPDATE building_types SET ${updateParts.join(', ')} WHERE code = ?`;
        db.prepare(query).run(...values);

        const updated = db.prepare('SELECT * FROM building_types WHERE code = ?').get(code.toUpperCase());
        res.json({ success: true, buildingType: updated });
    } catch (err) {
        console.error('Update building type error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Delete building type
app.delete('/api/admin/building-types/:code', (req, res) => {
    const { code } = req.params;

    try {
        const usageCount = db.prepare('SELECT COUNT(*) as count FROM user_buildings WHERE building_type_code = ?')
            .get(code.toUpperCase());

        if (usageCount.count > 0) {
            return res.status(400).json({
                error: `Cannot delete: ${usageCount.count} building(s) are using this type`
            });
        }

        const result = db.prepare('DELETE FROM building_types WHERE code = ?').run(code.toUpperCase());
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Building type not found' });
        }

        res.json({ success: true, message: `Building type ${code} deleted` });
    } catch (err) {
        console.error('Delete building type error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ----------------------------------------------------------------------
// BUILDING MAINTENANCE SYSTEM
// ----------------------------------------------------------------------

// Pay maintenance for a building
app.post('/api/buildings/:buildingId/pay-maintenance', (req, res) => {
    const { buildingId } = req.params;

    try {
        const building = db.prepare('SELECT * FROM user_buildings WHERE id = ?').get(buildingId);
        if (!building) {
            return res.status(404).json({ error: 'Building not found' });
        }

        const buildingType = db.prepare('SELECT * FROM building_types WHERE code = ?')
            .get(building.building_type_code || building.type.toUpperCase());

        if (!buildingType) {
            return res.status(400).json({ error: 'Building type not found in database' });
        }

        const maintenanceCost = JSON.parse(buildingType.maintenance_cost || '{}');

        const now = new Date();
        const lastMaintenance = new Date(building.last_maintenance_at);
        const hoursElapsed = Math.max(0, (now - lastMaintenance) / (1000 * 60 * 60));

        const totalCost = {};
        Object.keys(maintenanceCost).forEach(resource => {
            totalCost[resource] = Math.ceil(maintenanceCost[resource] * hoursElapsed);
        });

        if (totalCost.gold || totalCost.gem) {
            const resources = db.prepare('SELECT gold, gem FROM user_resources WHERE user_id = ?').get(building.user_id);
            if (!resources) {
                return res.status(400).json({ error: 'User resources not found' });
            }

            if (totalCost.gold && resources.gold < totalCost.gold) {
                return res.status(400).json({
                    error: `Insufficient gold for maintenance. Required: ${totalCost.gold}, Available: ${resources.gold}`
                });
            }
            if (totalCost.gem && resources.gem < totalCost.gem) {
                return res.status(400).json({
                    error: `Insufficient gems for maintenance. Required: ${totalCost.gem}, Available: ${resources.gem}`
                });
            }

            if (totalCost.gold) {
                db.prepare('UPDATE user_resources SET gold = gold - ? WHERE user_id = ?')
                    .run(totalCost.gold, building.user_id);
            }
            if (totalCost.gem) {
                db.prepare('UPDATE user_resources SET gem = gem - ? WHERE user_id = ?')
                    .run(totalCost.gem, building.user_id);
            }
        }

        db.prepare('UPDATE user_buildings SET last_maintenance_at = CURRENT_TIMESTAMP WHERE id = ?').run(buildingId);

        res.json({
            success: true,
            message: `Maintenance paid for ${hoursElapsed.toFixed(1)} hours`,
            costs: totalCost,
            nextMaintenance: new Date(now.getTime() + 3600000).toISOString()
        });

    } catch (err) {
        console.error('Maintenance payment error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ----------------------------------------------------------------------
// ADMIN: User Management
// ----------------------------------------------------------------------
app.get('/api/admin/users', (req, res) => {
    try {
        const users = db.prepare(`
            SELECT u.id, u.username, u.role, u.cyborg_model,
                   ur.gold, ur.gem,
                   us.strength, us.dexterity, us.constitution, us.intelligence, us.wisdom, us.agility
            FROM users u
            LEFT JOIN user_resources ur ON u.id = ur.user_id
            LEFT JOIN user_stats us ON u.id = us.user_id
        `).all();
        res.json(users);
    } catch (err) {
        console.error("Failed to fetch users", err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/admin/users/:id/update', (req, res) => {
    const userId = req.params.id;
    const { gold, gem, strength, dexterity, constitution, intelligence, wisdom, agility } = req.body;
    try {
        db.transaction(() => {
            db.prepare('UPDATE user_resources SET gold = ?, gem = ? WHERE user_id = ?').run(gold, gem, userId);
            db.prepare(`
                UPDATE user_stats 
                SET strength = ?, dexterity = ?, constitution = ?, intelligence = ?, wisdom = ?, agility = ?
                WHERE user_id = ?
            `).run(strength, dexterity, constitution, intelligence, wisdom, agility, userId);
        })();
        res.json({ success: true });
    } catch (err) {
        console.error("Failed to update user", err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ----------------------------------------------------------------------
// ADMIN: NPC Management
// ----------------------------------------------------------------------
app.get('/api/admin/npcs', (req, res) => {
    try {
        // Fix: Group By user.id to prevent duplicates when NPC has multiple territories
        const npcs = db.prepare(`
            SELECT u.id, u.username, u.npc_type, 
                   ub.id as building_id, ub.x, ub.y, ub.custom_boundary, ub.territory_radius
            FROM users u
            LEFT JOIN user_buildings ub ON u.id = ub.user_id AND ub.is_territory_center = 1
            WHERE u.npc_type IN ('ABSOLUTE', 'FREE')
            GROUP BY u.id
        `).all();
        res.json({ npcs });
    } catch (err) {
        console.error("Failed to fetch NPCs", err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.put('/api/admin/npcs/:id', (req, res) => {
    const userId = req.params.id;
    const { npc_type, boundary, building_id, radius } = req.body;

    try {
        db.prepare('UPDATE users SET npc_type = ? WHERE id = ?').run(npc_type, userId);

        if (building_id) {
            // Handle empty string as null
            const boundVal = (boundary && boundary.trim() !== "") ? boundary : null;
            db.prepare('UPDATE user_buildings SET custom_boundary = ?, territory_radius = ? WHERE id = ?')
                .run(boundVal, radius || 5, building_id);
        }
        res.json({ success: true });
    } catch (err) {
        console.error("Failed to update NPC", err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- Admin API: Seed Factions ---
app.post('/api/admin/seed-factions', (req, res) => {
    try {
        console.log('Seeding NPC Factions via Admin API...');
        const factions = [
            { name: 'The Empire (NPC)', username: 'empire_npc', desc: 'Global Hegemony', color: '#FF0000' },
            { name: 'Republic of Korea (NPC)', username: 'rok_npc', desc: 'Peninsula Defenders', color: '#0000FF' },
            { name: 'Neo Tokyo (NPC)', username: 'japan_npc', desc: 'Tech Giants', color: '#FFFF00' },
            { name: 'Dragon Dynasty (NPC)', username: 'china_npc', desc: 'Eastern Power', color: '#FF0000' },
            { name: 'Liberty Union (NPC)', username: 'usa_npc', desc: 'Western Alliance', color: '#0000FF' },
            { name: 'European Federation (NPC)', username: 'eu_npc', desc: 'Old World Coalition', color: '#00FF00' },
            { name: 'Slavic Bloc (NPC)', username: 'ru_npc', desc: 'Northern Bears', color: '#FF00FF' }
        ];

        const capitals = [
            { faction: 'rok_npc', name: 'Seoul Command', x: 37.5665, y: 126.9780, radius: 25.0 },
            { faction: 'japan_npc', name: 'Tokyo Fortress', x: 35.6762, y: 139.6503, radius: 25.0 },
            { faction: 'china_npc', name: 'Beijing Citadel', x: 39.9042, y: 116.4074, radius: 30.0 },
            { faction: 'usa_npc', name: 'Washington HQ', x: 38.9072, y: -77.0369, radius: 30.0 },
            { faction: 'eu_npc', name: 'London Outpost', x: 51.5074, y: -0.1278, radius: 15.0 },
            { faction: 'eu_npc', name: 'Paris Bastion', x: 48.8566, y: 2.3522, radius: 15.0 },
            { faction: 'eu_npc', name: 'Berlin Bunker', x: 52.5200, y: 13.4050, radius: 15.0 },
            { faction: 'ru_npc', name: 'Moscow Kremlin', x: 55.7558, y: 37.6173, radius: 30.0 },
            { faction: 'empire_npc', name: 'Antarctica Base', x: -82.8628, y: 135.0000, radius: 50.0 }
        ];

        db.transaction(() => {
            // 1. Update/Create Users with NPC Type
            for (const f of factions) {
                let user = db.prepare('SELECT id FROM users WHERE username = ?').get(f.username);
                if (!user) {
                    const info = db.prepare('INSERT INTO users (username, password, npc_type) VALUES (?, ?, ?)')
                        .run(f.username, 'npc_password', 'ABSOLUTE');
                    user = { id: info.lastInsertRowid };
                    db.prepare('INSERT INTO user_resources (user_id, gold, gem) VALUES (?, ?, ?)').run(user.id, 999999, 999999);
                } else {
                    db.prepare('UPDATE users SET npc_type = \'ABSOLUTE\' WHERE id = ?').run(user.id);
                }
                f.id = user.id;
            }

            // 2. Update Capitals (Command Centers)
            const checkBldg = db.prepare('SELECT id FROM user_buildings WHERE user_id = ? AND type = ? AND x = ? AND y = ?');
            const insertBldg = db.prepare(`
                INSERT INTO user_buildings (user_id, type, x, y, world_x, world_y, is_territory_center, territory_radius, level, custom_boundary)
                VALUES (?, 'COMMAND_CENTER', ?, ?, 0, 0, 1, ?, 5, ?)
            `);
            const updateBoundary = db.prepare('UPDATE user_buildings SET custom_boundary = ? WHERE id = ?');
            const updateRadius = db.prepare('UPDATE user_buildings SET territory_radius = ? WHERE id = ?');

            // Polygon for Seoul (Octagon)
            const seoulBoundary = JSON.stringify([
                [
                    [37.7165, 126.9780], [37.6726, 127.0841], [37.5665, 127.1280], [37.4604, 127.0841],
                    [37.4165, 126.9780], [37.4604, 126.8719], [37.5665, 126.8280], [37.6726, 126.8719]
                ]
            ]);

            for (const c of capitals) {
                const faction = factions.find(f => f.username === c.faction);
                if (!faction) continue;

                let boundary = null;
                if (c.faction === 'rok_npc') boundary = seoulBoundary;

                const exists = checkBldg.get(faction.id, 'COMMAND_CENTER', c.x, c.y);

                if (!exists) {
                    insertBldg.run(faction.id, c.x, c.y, c.radius, boundary);
                } else {
                    if (boundary) {
                        updateBoundary.run(boundary, exists.id);
                    } else {
                        updateRadius.run(c.radius, exists.id);
                    }
                }
            }
        })();

        res.json({ success: true, message: 'NPC Factions seeded successfully' });
    } catch (error) {
        console.error('Seed error:', error);
        res.status(500).json({ success: false, error: 'Failed to seed factions' });
    }
});

// =========================================
// MOVEMENT & PATHFINDING API
// =========================================

// Calculate Path (A*)
app.post('/api/game/path', async (req, res) => {
    const { startLat, startLng, endLat, endLng, waypoints } = req.body;

    console.log(`[PATH_REQ] Start: ${startLat},${startLng} -> End: ${endLat},${endLng} | Waypoints: ${waypoints ? waypoints.length : 0}`);

    if (startLat === undefined || endLat === undefined) {
        return res.status(400).json({ error: 'Start and End coordinates required' });
    }

    try {
        const result = await pathfindingService.findPath(startLat, startLng, endLat, endLng, waypoints || []);
        console.log(`[PATH_RES] Success: ${result.success}, Distance: ${result.distance}`);
        res.json(result);
    } catch (err) {
        console.error('Pathfinding error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Execute Move (with path validation and timing)
app.post('/api/game/move', (req, res) => {
    const { userId, x, y, path } = req.body; // x, y are target Lat/Lng

    console.log(`[MOVE_REQ] User: ${userId} -> Target: ${x}, ${y} | Path Nodes: ${path ? path.length : 'None'}`);

    if (!userId || x === undefined || y === undefined) {
        return res.status(400).json({ error: 'Invalid move request' });
    }

    try {
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        const startPosStr = user.current_pos || "37.5665,126.9780"; // Default Seoul
        const [startLat, startLng] = startPosStr.split(',').map(Number);

        // 1. Calculate Distance
        // If path is provided, use path length. Otherwise straight line.
        let distanceKm = 0;

        // Debug inputs
        // console.log(`[MOVE_DEBUG] Start: ${startLat},${startLng}, Target: ${x},${y}`);

        if (path && Array.isArray(path) && path.length > 0) {
            // Sum segments
            for (let i = 0; i < path.length - 1; i++) {
                const d = calculateDistance(path[i].lat, path[i].lng, path[i + 1].lat, path[i + 1].lng);
                if (!isNaN(d)) distanceKm += d;
            }
            // Add start to first point
            const dStart = calculateDistance(startLat, startLng, path[0].lat, path[0].lng);
            if (!isNaN(dStart)) distanceKm += dStart;
        } else {
            distanceKm = calculateDistance(startLat, startLng, x, y);
        }

        if (isNaN(distanceKm)) {
            console.error(`[MOVE_ERROR] Calculated distance is NaN. Start: ${startLat},${startLng}, Target: ${x},${y}, PathLen: ${path ? path.length : 0}`);
            distanceKm = 0;
        }

        // 2. Determine Speed
        // Admin: 1 km/s (3600 km/h)
        // User: 0.1 km/s (360 km/h) -> 100m/s
        let speedKmPerSec = 0.1;
        if (user.role === 'admin') {
            speedKmPerSec = 1.0;
        }

        const durationSeconds = distanceKm / speedKmPerSec;

        // 3. Set Dates
        const now = new Date();
        const arrivalTimeMs = now.getTime() + (durationSeconds * 1000);

        // Safety check for invalid date
        if (isNaN(arrivalTimeMs)) {
            throw new Error(`Invalid arrival time calculation (Duration: ${durationSeconds})`);
        }

        const arrival = new Date(arrivalTimeMs);

        const targetPosStr = `${x},${y}`;
        const pathJson = path ? JSON.stringify(path) : null;

        // 4. Update DB
        // We need 'start_pos' to interpolate if needed (already have current_pos as start)
        // We set departure_time, arrival_time, destination_pos.
        // Also saving path might be useful but schema doesn't have it yet. 
        // We will just use start/dest for simple server-side check, client handles visual path.
        // Actually, if we don't save path, on refresh we lose it.
        // Ideally we add 'current_path' column. But for now, let's rely on client state or 
        // simple interpolation between start/end on refresh.

        db.prepare(`
            UPDATE users 
            SET start_pos = current_pos,
                destination_pos = ?,
                departure_time = ?,
                arrival_time = ?
            WHERE id = ?
        `).run(targetPosStr, now.toISOString(), arrival.toISOString(), userId);

        res.json({
            success: true,
            message: `Moving to (${x}, ${y}). Arriving in ${durationSeconds.toFixed(1)}s`,
            arrival_time: arrival.toISOString(),
            start_pos: [startLat, startLng],
            duration_seconds: durationSeconds
        });

    } catch (err) {
        console.error('Move error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Helper for Haversine (Server side)
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Start Server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
