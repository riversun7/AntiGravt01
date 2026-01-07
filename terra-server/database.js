const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ensure db directory exists and has write permissions
// Use terra-data/db for all environments (local dev and Docker)
const dbDir = path.join(__dirname, '..', 'terra-data', 'db');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}
try {
    // Attempt to grant full permissions (RWX for Owner/Group/Others) to fix persistent NAS/Docker issues
    fs.chmodSync(dbDir, '777');
    console.log(`[Database] Permissions for ${dbDir} set to 777.`);
} catch (e) {
    console.warn(`[Database] Warning: Could not set permissions on db directory: ${e.message}`);
}

const dbPath = path.join(dbDir, 'terra.db');
console.log(`[Database] Using database at: ${dbPath}`);
const db = new Database(dbPath);

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
        description TEXT,
        type TEXT DEFAULT 'RESOURCE',
        slot TEXT DEFAULT NULL,
        stats TEXT DEFAULT '{}',
        rarity TEXT DEFAULT 'common',
        image TEXT DEFAULT NULL
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

    const createMailTable = `
    CREATE TABLE IF NOT EXISTS mail (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recipient_id INTEGER, -- NULL for Public/All
        sender_id INTEGER DEFAULT 0, -- 0 for System
        title TEXT NOT NULL,
        content TEXT,
        items TEXT DEFAULT '[]', -- JSON: [{code, qty}]
        is_claimed INTEGER DEFAULT 0, -- 0: False, 1: True
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        scheduled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME DEFAULT NULL
    );`;

    const createAdminTasksTable = `
    CREATE TABLE IF NOT EXISTS admin_tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'TODO',
        category_id TEXT DEFAULT 'ADMIN',
        created_at INTEGER
    );`;

    const createAdminCategoriesTable = `
    CREATE TABLE IF NOT EXISTS admin_categories (
        id TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        color TEXT DEFAULT 'bg-gray-500'
    );`;

    // New Character System: Cyborg (main) + Minions (human/android/creature)
    const createCharacterCyborgTable = `
    CREATE TABLE IF NOT EXISTS character_cyborg (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER UNIQUE NOT NULL,
        name TEXT DEFAULT 'Cyborg',
        level INTEGER DEFAULT 1,
        exp INTEGER DEFAULT 0,
        
        -- Base Stats (used to calculate HP/MP)
        strength INTEGER DEFAULT 10,
        dexterity INTEGER DEFAULT 10,
        constitution INTEGER DEFAULT 10,
        agility INTEGER DEFAULT 10,
        intelligence INTEGER DEFAULT 10,
        wisdom INTEGER DEFAULT 10,
        
        -- Calculated Stats (HP = constitution * 10 + strength * 5, MP = wisdom * 8 + intelligence * 6)
        hp INTEGER DEFAULT 150,
        mp INTEGER DEFAULT 140,
        
        -- Cyborg-specific
        parts_tier INTEGER DEFAULT 1,
        genetic_tier INTEGER DEFAULT 1,
        
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );`;

    const createCharacterMinionTable = `
    CREATE TABLE IF NOT EXISTS character_minion (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        type TEXT CHECK(type IN ('human','android','creature')) NOT NULL,
        name TEXT NOT NULL,
        level INTEGER DEFAULT 1,
        exp INTEGER DEFAULT 0,
        
        -- Base Stats (used to calculate HP/MP)
        strength INTEGER DEFAULT 5,
        dexterity INTEGER DEFAULT 5,
        constitution INTEGER DEFAULT 5,
        agility INTEGER DEFAULT 5,
        intelligence INTEGER DEFAULT 5,
        wisdom INTEGER DEFAULT 5,
        
        -- Calculated Stats (HP = constitution * 10 + strength * 5, MP = wisdom * 8 + intelligence * 6)
        hp INTEGER DEFAULT 75,
        mp INTEGER DEFAULT 70,
        
        -- Type-specific attributes
        lifespan INTEGER DEFAULT NULL,
        age INTEGER DEFAULT 0,
        growth_stage TEXT DEFAULT 'infant',
        parts_tier INTEGER DEFAULT NULL,
        genetic_tier INTEGER DEFAULT NULL,
        rarity TEXT DEFAULT 'common',
        species TEXT DEFAULT NULL,
        
        -- Android-specific (battery/fuel system per user feedback)
        battery INTEGER DEFAULT 100,
        fuel INTEGER DEFAULT 100,
        
        -- Game mechanics
        loyalty INTEGER DEFAULT 50,
        fatigue INTEGER DEFAULT 0,
        maintenance_cost INTEGER DEFAULT 100,
        
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );`;

    const createMinionEquipmentTable = `
    CREATE TABLE IF NOT EXISTS minion_equipment (
        minion_id INTEGER NOT NULL,
        slot TEXT NOT NULL,
        item_id INTEGER,
        PRIMARY KEY (minion_id, slot),
        FOREIGN KEY(minion_id) REFERENCES character_minion(id) ON DELETE CASCADE,
        FOREIGN KEY(item_id) REFERENCES market_items(id)
    );`;

    const createMinionSkillsTable = `
    CREATE TABLE IF NOT EXISTS minion_skills (
        minion_id INTEGER NOT NULL,
        skill_id TEXT NOT NULL,
        level INTEGER DEFAULT 1,
        exp INTEGER DEFAULT 0,
        PRIMARY KEY (minion_id, skill_id),
        FOREIGN KEY(minion_id) REFERENCES character_minion(id) ON DELETE CASCADE
    );`;

    const createBuildingAssignmentsTable = `
    CREATE TABLE IF NOT EXISTS building_assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        building_id INTEGER NOT NULL,
        minion_id INTEGER NOT NULL,
        assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        task_type TEXT CHECK(task_type IN ('mining','guarding','resting')) NOT NULL,
        production_rate REAL DEFAULT 1.0,
        resources_collected INTEGER DEFAULT 0,
        last_collection DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(building_id) REFERENCES user_buildings(id) ON DELETE CASCADE,
        FOREIGN KEY(minion_id) REFERENCES character_minion(id) ON DELETE CASCADE
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

        // Movement System Columns
        const hasDest = userCols.some(c => c.name === 'destination_pos');
        if (!hasDest) {
            db.exec("ALTER TABLE users ADD COLUMN destination_pos TEXT DEFAULT NULL");
            db.exec("ALTER TABLE users ADD COLUMN start_pos TEXT DEFAULT NULL");
            db.exec("ALTER TABLE users ADD COLUMN arrival_time DATETIME DEFAULT NULL");
            db.exec("ALTER TABLE users ADD COLUMN departure_time DATETIME DEFAULT NULL");
            console.log("Migrated users table: added movement tracking columns (destination_pos, start_pos, arrival_time, departure_time)");
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

    // Migration: Add expires_at to mail table
    try {
        const mailCols = db.prepare('PRAGMA table_info(mail)').all();
        // Check if table exists first (it is created below if not, but migration runs before exec if not careful? No, exec is below.
        // Actually, createMailTable is executed below at line 151.
        // So we should run migration AFTER table creation or check if table exists.
        // But better to check AFTER execution of createMailTable?
        // Wait, standard practice here is to run migrations after 'ensure table exists'.
        // Let's place it after createMailTable exec.
    } catch (e) { }

    db.exec(createWorldMapTable);
    db.exec(createMailTable);
    db.exec(createAdminTasksTable);
    db.exec(createAdminCategoriesTable);
    // Execute new character system tables
    db.exec(createCharacterCyborgTable);
    db.exec(createCharacterMinionTable);
    db.exec(createMinionEquipmentTable);
    db.exec(createMinionSkillsTable);
    db.exec(createBuildingAssignmentsTable);

    try {
        const mailCols = db.prepare('PRAGMA table_info(mail)').all();
        const hasExpires = mailCols.some(c => c.name === 'expires_at');
        if (!hasExpires && mailCols.length > 0) {
            db.exec("ALTER TABLE mail ADD COLUMN expires_at DATETIME DEFAULT NULL");
            console.log("Migrated mail table: added expires_at");
        }
    } catch (e) { console.log("Migration error (mail):", e); }

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

    const createUserEquipmentTable = `
    CREATE TABLE IF NOT EXISTS user_equipment (
        user_id INTEGER,
        slot TEXT NOT NULL, -- HEAD, BODY, ARMS, LEGS, CORE, WEAPON
        item_id INTEGER,
        PRIMARY KEY (user_id, slot),
        FOREIGN KEY(user_id) REFERENCES users(id),
        FOREIGN KEY(item_id) REFERENCES market_items(id)
    );`;

    db.exec(createUserEquipmentTable);

    // Migration: Update market_items schema
    try {
        const itemCols = db.prepare('PRAGMA table_info(market_items)').all();

        const hasType = itemCols.some(c => c.name === 'type');
        if (!hasType) {
            db.exec("ALTER TABLE market_items ADD COLUMN type TEXT DEFAULT 'RESOURCE'"); // RESOURCE, EQUIPMENT
            db.exec("ALTER TABLE market_items ADD COLUMN slot TEXT DEFAULT NULL");
            db.exec("ALTER TABLE market_items ADD COLUMN stats TEXT DEFAULT '{}'"); // JSON string
            console.log("Migrated market_items table: added type, slot, stats");
        }

        const hasRarity = itemCols.some(c => c.name === 'rarity');
        if (!hasRarity) {
            db.exec("ALTER TABLE market_items ADD COLUMN rarity TEXT DEFAULT 'common'");
            console.log("Migrated market_items table: added rarity");
        }

        const hasImage = itemCols.some(c => c.name === 'image');
        if (!hasImage) {
            db.exec("ALTER TABLE market_items ADD COLUMN image TEXT DEFAULT NULL");
            console.log("Migrated market_items table: added image");
        }

    } catch (e) { console.log("Migration error (market_items):", e); }

    // Seed Market Items (Commodities + Equipment)
    try {
        // ALWAYS try to seed new items (logic inside checks for existence)
        if (true) {
            const newItems = [
                // -- HEAD --
                { name: 'Titanium Helmet', code: 'TITANIUM_HELM', price: 1200, vol: 5, desc: 'Standard issue infantry protection.', type: 'EQUIPMENT', slot: 'HEAD', stats: JSON.stringify({ constitution: 3, wisdom: 1 }) },
                { name: 'Cyber Eye Mk.I', code: 'CYBER_EYE_1', price: 800, vol: 5, desc: 'Basic optical enhancement.', type: 'EQUIPMENT', slot: 'HEAD', stats: JSON.stringify({ wisdom: 2, accuracy: 5 }) },
                { name: 'Tactical Visor', code: 'TAC_VISOR', price: 1500, vol: 6, desc: 'HUD with threat detection.', type: 'EQUIPMENT', slot: 'HEAD', stats: JSON.stringify({ wisdom: 4, accuracy: 8 }) },
                { name: 'Neural Link Interface', code: 'NEURAL_LINK', price: 3500, vol: 8, desc: 'Direct brain-computer interface.', type: 'EQUIPMENT', slot: 'HEAD', stats: JSON.stringify({ intelligence: 8, wisdom: 5 }) },

                // -- BODY --
                { name: 'Titanium Plating', code: 'TITANIUM_PLATE', price: 1800, vol: 5, desc: 'Heavy duty chest protection.', type: 'EQUIPMENT', slot: 'BODY', stats: JSON.stringify({ constitution: 8 }) },
                { name: 'Carbon Fiber Vest', code: 'CARBON_VEST', price: 1200, vol: 4, desc: 'Lightweight and durable.', type: 'EQUIPMENT', slot: 'BODY', stats: JSON.stringify({ constitution: 4, agility: 2 }) },
                { name: 'Reactive Armor', code: 'REACTIVE_ARMOR', price: 4000, vol: 7, desc: 'Explodes outward on impact.', type: 'EQUIPMENT', slot: 'BODY', stats: JSON.stringify({ constitution: 12, strength: 2 }) },
                { name: 'Stealth Suit', code: 'STEALTH_SUIT', price: 5000, vol: 9, desc: 'Active camouflage coating.', type: 'EQUIPMENT', slot: 'BODY', stats: JSON.stringify({ agility: 8, constitution: 2 }) },

                // -- ARMS --
                { name: 'Hydraulic Arms', code: 'HYDRA_ARMS', price: 1500, vol: 5, desc: 'Increases lifting capacity.', type: 'EQUIPMENT', slot: 'ARMS', stats: JSON.stringify({ strength: 5 }) },
                { name: 'Stabilizer Grips', code: 'STAB_GRIPS', price: 1100, vol: 4, desc: 'Recoil reduction system.', type: 'EQUIPMENT', slot: 'ARMS', stats: JSON.stringify({ dexterity: 4, accuracy: 5 }) },
                { name: 'Power Gauntlets', code: 'POWER_GAUNTLET', price: 2200, vol: 6, desc: 'Crushes rock and bone.', type: 'EQUIPMENT', slot: 'ARMS', stats: JSON.stringify({ strength: 8 }) },
                { name: 'Nano-Weave Sleeves', code: 'NANO_SLEEVES', price: 1800, vol: 5, desc: 'Self-repairing fabric.', type: 'EQUIPMENT', slot: 'ARMS', stats: JSON.stringify({ constitution: 3, dexterity: 3 }) },

                // -- LEGS --
                { name: 'Servo Legs', code: 'SERVO_LEGS', price: 1400, vol: 5, desc: 'Assisted walking servos.', type: 'EQUIPMENT', slot: 'LEGS', stats: JSON.stringify({ agility: 4, strength: 1 }) },
                { name: 'Jump Jets', code: 'JUMP_JETS', price: 2500, vol: 7, desc: 'Short-range thrusters.', type: 'EQUIPMENT', slot: 'LEGS', stats: JSON.stringify({ agility: 8 }) },
                { name: 'Magnetic Boots', code: 'MAG_BOOTS', price: 1000, vol: 3, desc: 'Adheres to metal surfaces.', type: 'EQUIPMENT', slot: 'LEGS', stats: JSON.stringify({ dexterity: 3, constitution: 2 }) },
                { name: 'Sprinter Pistons', code: 'SPRINT_PISTONS', price: 2100, vol: 6, desc: 'Optimized for high speed.', type: 'EQUIPMENT', slot: 'LEGS', stats: JSON.stringify({ agility: 7 }) },

                // -- CORE --
                { name: 'Fusion Core', code: 'FUSION_CORE', price: 3000, vol: 2, desc: 'Standard fusion battery.', type: 'EQUIPMENT', slot: 'CORE', stats: JSON.stringify({ intelligence: 5, energy: 100 }) },
                { name: 'Antimatter Cell', code: 'ANTIMATTER_CELL', price: 8000, vol: 10, desc: 'High-risk high-output power.', type: 'EQUIPMENT', slot: 'CORE', stats: JSON.stringify({ intelligence: 10, energy: 200 }) },
                { name: 'Solar Converter', code: 'SOLAR_CONV', price: 1500, vol: 3, desc: 'Renewable energy drip.', type: 'EQUIPMENT', slot: 'CORE', stats: JSON.stringify({ wisdom: 4, energy: 50 }) },
                { name: 'Overclock Module', code: 'OC_MODULE', price: 4500, vol: 8, desc: 'Push systems beyond limits.', type: 'EQUIPMENT', slot: 'CORE', stats: JSON.stringify({ agility: 5, strength: 5, energy: -20 }) },

                // -- WEAPON --
                { name: 'Plasma Cutter', code: 'PLASMA_CUTTER', price: 2000, vol: 8, desc: 'Mining tool weaponized.', type: 'EQUIPMENT', slot: 'WEAPON', stats: JSON.stringify({ attack: 15 }) },
                { name: 'Laser Rifle', code: 'LASER_RIFLE', price: 3500, vol: 7, desc: 'Precision energy weapon.', type: 'EQUIPMENT', slot: 'WEAPON', stats: JSON.stringify({ attack: 25, accuracy: 10 }) },
                { name: 'Railgun Prototype', code: 'RAILGUN_PROTO', price: 6000, vol: 9, desc: 'Devastating kinetic impact.', type: 'EQUIPMENT', slot: 'WEAPON', stats: JSON.stringify({ attack: 45, agility: -2 }) },
                { name: 'Shock Baton', code: 'SHOCK_BATON', price: 800, vol: 4, desc: 'Non-lethal pacification.', type: 'EQUIPMENT', slot: 'WEAPON', stats: JSON.stringify({ attack: 8, dexterity: 2 }) },
                { name: 'Nanite Swarm Canister', code: 'NANO_SWARM', price: 4500, vol: 8, desc: 'Unleashes consuming bots.', type: 'EQUIPMENT', slot: 'WEAPON', stats: JSON.stringify({ attack: 20, wisdom: 5 }) }
            ];

            const insertItem = db.prepare('INSERT INTO market_items (name, code, base_price, current_price, volatility, description, type, slot, stats) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
            newItems.forEach(item => {
                // Check if exists first to avoid duplicate code error
                const exists = db.prepare('SELECT id FROM market_items WHERE code = ?').get(item.code);
                if (!exists) {
                    insertItem.run(item.name, item.code, item.price, item.price, item.vol, item.desc, item.type, item.slot, item.stats);
                }
            });
            console.log("Equipment seeded.");
        }

        // Ensure initial resources have types
        const updateResource = db.prepare("UPDATE market_items SET type = 'RESOURCE' WHERE type IS NULL");
        updateResource.run();

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
            // Create cyborg character for admin
            db.prepare('INSERT INTO character_cyborg (user_id, name, level) VALUES (?, ?, ?)').run(admin.id, 'Admin Cyborg', 1);
            console.log("Admin user seeded: admin / 1234 (with cyborg)");
        } else {
            // Check if admin has cyborg, create if not
            const adminCyborg = db.prepare("SELECT * FROM character_cyborg WHERE user_id = ?").get(adminCheck.id);
            if (!adminCyborg) {
                db.prepare('INSERT INTO character_cyborg (user_id, name, level) VALUES (?, ?, ?)').run(adminCheck.id, 'Admin Cyborg', 1);
                console.log("Created cyborg for existing admin user");
            }
        }
    } catch (e) {
        console.log("Admin seed error or already exists", e);
    }

    console.log('Database initialized');
}

initSchema();

module.exports = db;
