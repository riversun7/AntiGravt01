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
        -- current_pos TEXT DEFAULT '10_10' (Added via migration)
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

    const createUserBuildingsTable = `
    CREATE TABLE IF NOT EXISTS user_buildings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        type TEXT NOT NULL,
        x INTEGER NOT NULL,
        y INTEGER NOT NULL,
        world_x INTEGER NOT NULL,
        world_y INTEGER NOT NULL,
        level INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_collected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
    );`;

    const createWorldMapTable = `
    CREATE TABLE IF NOT EXISTS world_map (
        id TEXT PRIMARY KEY, -- Format "x_y" e.g "0_0"
        x INTEGER NOT NULL,
        y INTEGER NOT NULL,
        type TEXT NOT NULL, -- ICE, TUNDRA, OCEAN, PLAIN, FOREST, JUNGLE, DESERT, MOUNTAIN, CITY
        name TEXT,
        owner_id INTEGER DEFAULT NULL,
        faction TEXT DEFAULT NULL -- 'TERRAN', 'CYBER', 'IRON', 'NEUTRAL'
    );`;

    db.exec(createUsersTable);

    // Migration: Add current_pos to users if not exists
    try {
        const userCols = db.prepare('PRAGMA table_info(users)').all();
        const hasPos = userCols.some(c => c.name === 'current_pos');
        if (!hasPos) {
            db.exec("ALTER TABLE users ADD COLUMN current_pos TEXT DEFAULT '10_10'");
            console.log("Migrated users table: added current_pos");
        }
    } catch (e) {
        console.error("Migration error:", e);
    }

    db.exec(createResourcesTable);
    db.exec(createUserStatsTable);
    db.exec(createMarketItemsTable);
    db.exec(createUserInventoryTable);
    db.exec(createUserBuildingsTable);

    // Migration: Add last_collected_at to user_buildings
    try {
        const buildCols = db.prepare('PRAGMA table_info(user_buildings)').all();
        const hasCollected = buildCols.some(c => c.name === 'last_collected_at');
        if (!hasCollected && buildCols.length > 0) {
            db.exec("ALTER TABLE user_buildings ADD COLUMN last_collected_at DATETIME DEFAULT CURRENT_TIMESTAMP");
            console.log("Migrated user_buildings table: added last_collected_at");
        }
    } catch (e) { console.log("Migration error (user_buildings):", e); }

    // Check World Map Version (Faction Column)
    try {
        const mapCols = db.prepare('PRAGMA table_info(world_map)').all();
        const hasFaction = mapCols.some(c => c.name === 'faction');
        if (!hasFaction && mapCols.length > 0) {
            // Drop old table to re-seed
            db.exec('DROP TABLE world_map');
            console.log("Dropped legacy world_map table.");
        }
    } catch (e) { console.error("Error checking world_map table for faction column:", e); }

    db.exec(createWorldMapTable);

    // Seed World Map (160x80) - High Res Earth Like v4
    try {
        const mapCheck = db.prepare('SELECT count(*) as count FROM world_map').get();
        // Check for 160x80 (12800 tiles)
        if (mapCheck.count !== 12800) {
            console.log("Map Resolution Upgrade Required. Re-seeding High-Res Earth Map 160x80...");
            db.exec('DROP TABLE IF EXISTS world_map');
            db.exec(createWorldMapTable);

            const insertTile = db.prepare('INSERT INTO world_map (id, x, y, type, name, faction) VALUES (?, ?, ?, ?, ?, ?)');

            // 80x40 Base Template
            const EARTH_TEMPLATE = [
                "********************************************************************************", // 0
                "********************************************************************************", // 1
                "***********~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~************", // 2
                "********~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~********", // 3
                "*****~~~~~~......~~~~~~~~~~~~~~~...FFFF...~~~~~~~~~~..........~~~~~~~~~~~~~*****", // 4
                "****~~~~~.........~~~~~~~~~~~~...FF....MM..~~~~~~~~~..............~~~~~~...~****", // 5
                "***~~~~~FF.........~~~~~~~~~~~~..P.L.........~~~~~~~~.........B.....~~~~~~...****", // 6
                "**~~~~~FFF...^^^....~~~~~~~~~~..F.....^^...~~~~~~~~~..^^^^...S.T...~~~~~~~..****", // 7
                "**~~~~~N.....^^.....~~~~~~~~~~........^.....~~~~~~~~...^^^^........~~~~~~~..****", // 8
                "**~~~~..F...........~~~~~~~~~~........^.....~~~~~~~~....^^^........~~~~~~~..****", // 9
                "**~~~~...............~~~~~~~~~..............~~~~~~~~.....C.........~~~~~~~..****", // 10
                "**~~~~........C......~~~~~~~~~..............~~~~~~~~~.............~~~~~~~~..****", // 11
                "**~~~~~.............~~~~~~~~~~..............~~~~~~~~~~............~~~~~~~~..****", // 12
                "***~~~~.............~~~~~~~~~~.......DDDD...~~~~~~~~~~...DDDD.....~~~~~~~~..****", // 13
                "***~~~~C...........~~~~~~~~~~~......DDDDDD..~~~~~~~~~~~.DDDDDD....~~~~~~~~..****", // 14
                "****~~~~..........~~~~~~~~~~~~......DDDDDD...~~~~~~~~~~.DDDDDD...~~~~~~~~..*****", // 15
                "****~~~~~.........~~~~~~~~~~~~~.....DDDDDD...~~~~~~~~~~~..DDDD....~~~~~~~...*****", // 16
                "*****~~~~~.......~~~~~~~~~~~~~~......DDDD....~~~~~~~~~~..........~~~~~~....*****", // 17
                "*****~~~~~~......~~~~~~~~~~~~~~~............~~~~~~~~~~~JJJJJJ....~~~~~.....*****", // 18
                "******~~~~~~....~~~~~~~~~~~~~~~~............~~~~~~~~~~JJJJJJJJ...~~~~......*****", // 19
                "******~~~~~~...~~~~~~~~~~~~~~~~~............~~~~~~~~~~JJJJJJJJ...~~~~......*****", // 20
                "*******~~~~~..~~~~~~~~~~~~~~~~~~..JJJJJJ....~~~~~~~~~~JJJJJJJJ...~~~~......*****", // 21
                "*******~~~~~.~~~~~~~~~~~~~~~~~~~.JJJJJJJJ...~~~~~~~~~~~JJJJJJ....~~~~......*****", // 22
                "********~~~~.~~~~~~~~~~~~~~~~~~~.JJJJJJJJ...~~~~~~~~~~~~~~~~.....~~~~......*****", // 23
                "********~~~~.~~~~~~~~~~~~~~~~~~~..JJJJJJ....~~~~~~~~~~~~~~~~...~~~~~~......*****", // 24
                "*********~~~.~~~~~~~~~~~~~~~~~~~............~~~~~~~~~~~~~~~~..~~~~~~~......*****", // 25
                "*********~~~.~~~~~~~~~~~~~~~~~~~............~~~~~~~~~~~~~~~~..~~~~~~~......*****", // 26
                "**********~~.~~~~~~~~~~~~~~~~~~~~..........~~~~~~~~~~~~~~~~~~~~~~~~~~......*****", // 27
                "**********~~..~~~~~~~~~~~~~~~~~~~..........~~~~~~~~~~~~~~~~~~~~~~~~~~......*****", // 28
                "***********~...~~~~~~~~~~~~~~~~~~..........~~~~~~~~~~~~~~~~~~~~~~~~~~......*****", // 29
                "***********~...~~~~~~~~~~~~~~~~~~~........~~~~~~~~~~~~~~~~~~~~~~~~~~~......*****", // 30
                "************~..~~~~~~~~~~~~~~~~~~~........~~~~~~~~~~~~~~~~~~~~~~~~~~************", // 31
                "************~..~~~~~~~~~~~~~~~~~~~~......~~~~~~~~~~~~~~~~~~~~~..~~~~************", // 32
                "*************~~~~~~~~~~~~~~~~~~~~~~......~~~~~~~~~~~~~~~~~~~~....~~~************", // 33
                "*************~~~~~~~~~~~~~~~~~~~~~~~....~~~~~~~~~~~~~~~~~~~~~...~~~~************", // 34
                "**************~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~...**********", // 35
                "***************~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~...***********", // 36
                "****************~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~...************", // 37
                "********************************************************************************", // 38
                "********************************************************************************"  // 39
            ];

            const BASE_WIDTH = 80;
            const BASE_HEIGHT = 40;
            const SCALE = 2; // 2x Scaling -> 160x80

            db.transaction(() => {
                for (let y = 0; y < BASE_HEIGHT * SCALE; y++) {
                    const baseY = Math.floor(y / SCALE);
                    const row = EARTH_TEMPLATE[baseY] || "".padEnd(BASE_WIDTH, '~');

                    for (let x = 0; x < BASE_WIDTH * SCALE; x++) {
                        const baseX = Math.floor(x / SCALE);
                        const char = row[baseX] || '~';

                        const id = `${x}_${y}`;
                        let type = 'OCEAN';
                        let faction = null;
                        let customName = null;

                        switch (char) {
                            case '*': type = 'ICE'; break;
                            case '.': type = 'PLAIN'; break;
                            case 'F': type = 'FOREST'; break;
                            case '^': type = 'MOUNTAIN'; break;
                            case 'D': type = 'DESERT'; break;
                            case 'J': type = 'JUNGLE'; break;
                            case 'C': type = 'CITY'; break;
                            case 'L': type = 'CITY'; customName = 'London'; faction = 'TERRAN'; break;
                            case 'P': type = 'CITY'; customName = 'Paris'; faction = 'TERRAN'; break;
                            case 'N': type = 'CITY'; customName = 'New York'; faction = 'TERRAN'; break;
                            case 'M': type = 'CITY'; customName = 'Moscow'; faction = 'IRON'; break;
                            case 'B': type = 'CITY'; customName = 'Beijing'; faction = 'CYBER'; break;
                            case 'T': type = 'CITY'; customName = 'Tokyo'; faction = 'CYBER'; break;
                            case 'S': type = 'CITY'; customName = 'Seoul'; faction = 'CYBER'; break;
                            case '~': default: type = 'OCEAN'; break;
                        }

                        // Distributed Factions
                        if (type === 'CITY' && !faction) {
                            if (baseX < 30) faction = 'TERRAN';
                            else if (baseX < 50) faction = 'IRON';
                            else faction = 'CYBER';
                        }

                        // Scaling Logic for Names (Prevent duplication)
                        if (customName) {
                            if (x % SCALE === 0 && y % SCALE === 0) {
                                // Original
                            } else {
                                customName = `Greater ${customName}`;
                            }
                        }

                        const sectorName = customName || `Sector ${x}-${y}`;
                        insertTile.run(id, x, y, type, sectorName, faction);
                    }
                }
            })();
            console.log(`World Map (High Res Earth 160x80 v4) seeded.`);
        }
    } catch (e) {
        console.log("World Map seed error:", e);
    }

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
