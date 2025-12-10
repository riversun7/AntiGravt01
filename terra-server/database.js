const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ensure db directory exists
const dbDir = path.join(__dirname, 'db');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir);
}

const dbPath = path.join(dbDir, 'terra.db');
const db = new Database(dbPath, { verbose: console.log });

// Initialize Schema
function initSchema() {
    const createUsersTable = `
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT DEFAULT NULL,
        role TEXT DEFAULT 'user',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME DEFAULT CURRENT_TIMESTAMP,
        cyborg_model TEXT DEFAULT NULL
    );`;

    const createResourcesTable = `
    CREATE TABLE IF NOT EXISTS user_resources (
        user_id INTEGER PRIMARY KEY,
        gold INTEGER DEFAULT 0,
        gem INTEGER DEFAULT 0,
        FOREIGN KEY(user_id) REFERENCES users(id)
    );`;

    const createUserStatsTable = `
    CREATE TABLE IF NOT EXISTS user_stats (
        user_id INTEGER PRIMARY KEY,
        strength INTEGER DEFAULT 5,
        dexterity INTEGER DEFAULT 5,
        constitution INTEGER DEFAULT 5,
        agility INTEGER DEFAULT 5,
        intelligence INTEGER DEFAULT 5,
        wisdom INTEGER DEFAULT 5,
        FOREIGN KEY(user_id) REFERENCES users(id)
    );`;

    const createMarketItemsTable = `
    CREATE TABLE IF NOT EXISTS market_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        code TEXT NOT NULL UNIQUE,
        base_price INTEGER NOT NULL,
        current_price INTEGER NOT NULL,
        previous_price INTEGER DEFAULT NULL,
        volatility INTEGER NOT NULL,
        description TEXT
    );`;

    const createUserInventoryTable = `
    CREATE TABLE IF NOT EXISTS user_inventory (
        user_id INTEGER,
        item_id INTEGER,
        quantity INTEGER DEFAULT 0,
        PRIMARY KEY (user_id, item_id),
        FOREIGN KEY(user_id) REFERENCES users(id),
        FOREIGN KEY(item_id) REFERENCES market_items(id)
    );`;

    db.exec(createUsersTable);
    db.exec(createResourcesTable);
    db.exec(createUserStatsTable);
    db.exec(createMarketItemsTable);
    db.exec(createUserInventoryTable);

    // Seed Market Items (Commodities)
    try {
        const itemsCount = db.prepare('SELECT count(*) as count FROM market_items').get();
        if (itemsCount.count === 0) {
            const items = [
                { name: 'Iron Ore', code: 'IRON_ORE', price: 50, vol: 10, desc: 'Raw material mined from the earth.' },
                { name: 'Wheat', code: 'WHEAT', price: 30, vol: 15, desc: 'Basic food source associated with 1st Gen Industry.' },
                { name: 'Steel', code: 'STEEL', price: 150, vol: 8, desc: 'Refined alloy used for construction and arms.' },
                { name: 'Flour', code: 'FLOUR', price: 80, vol: 12, desc: 'Processed food ingredient.' },
                { name: 'Cyborg Parts', code: 'CYBORG_PARTS', price: 500, vol: 20, desc: 'High-tech components for cybernetic upgrades.' }
            ];

            const insertItem = db.prepare('INSERT INTO market_items (name, code, base_price, current_price, volatility, description) VALUES (?, ?, ?, ?, ?, ?)');
            items.forEach(item => {
                insertItem.run(item.name, item.code, item.price, item.price, item.vol, item.desc);
            });
            console.log("Market items seeded.");
        }
    } catch (e) {
        console.log("Market seed error:", e);
    }

    // Seed Admin
    try {
        const adminCheck = db.prepare("SELECT * FROM users WHERE username = 'admin'").get();
        if (!adminCheck) {
            db.prepare("INSERT INTO users (username, password, role) VALUES ('admin', '1234', 'admin')").run();
            // Get admin id
            const admin = db.prepare("SELECT id FROM users WHERE username = 'admin'").get();
            // Init resources/stats/inventory for admin
            db.prepare('INSERT INTO user_resources (user_id, gold, gem) VALUES (?, ?, ?)').run(admin.id, 999999, 999999);
            db.prepare('INSERT INTO user_stats (user_id) VALUES (?)').run(admin.id);
            console.log("Admin user seeded: admin / 1234");
        }
    } catch (e) {
        console.log("Admin seed error or already exists", e);
    }

    console.log('Database initialized');
}

initSchema();

module.exports = db;
