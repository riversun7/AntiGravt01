const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ensure db directory exists and has write permissions
const dbDir = process.env.DB_PATH ? path.resolve(process.env.DB_PATH) : path.join(__dirname, 'db');
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
// Ensure we are not using a relative path accidentally
if (!path.isAbsolute(dbPath)) {
    console.warn(`[Database] WARNING: Database path is relative! Resolving to: ${path.resolve(dbPath)}`);
}
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
        cyborg_model TEXT DEFAULT NULL,
        movement_path TEXT DEFAULT NULL,
        start_pos TEXT DEFAULT NULL,
        destination_pos TEXT DEFAULT NULL,
        departure_time TEXT DEFAULT NULL,
        arrival_time TEXT DEFAULT NULL
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
        is_territory_center INTEGER DEFAULT 0,
        territory_radius REAL DEFAULT 5.0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_collected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_maintenance_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        hp INTEGER DEFAULT 100,
        building_type_code TEXT DEFAULT NULL,
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
    CREATE TABLE IF NOT EXISTS building_assignments (\n        id INTEGER PRIMARY KEY AUTOINCREMENT,
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

    // Resource System Tables
    const createResourceNodesTable = `
    CREATE TABLE IF NOT EXISTS resource_nodes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tile_id TEXT NOT NULL,
        resource_type TEXT NOT NULL,
        current_amount INTEGER DEFAULT 0,
        max_amount INTEGER NOT NULL,
        regen_rate REAL NOT NULL,
        last_regen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );`;

    const createWarehousesTable = `
    CREATE TABLE IF NOT EXISTS warehouses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        capacity INTEGER DEFAULT 1000,
        stored_resources TEXT DEFAULT '{}',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );`;

    const createMarketPricesTable = `
    CREATE TABLE IF NOT EXISTS market_prices (
        resource_type TEXT PRIMARY KEY,
        current_price INTEGER NOT NULL,
        base_price INTEGER NOT NULL,
        demand INTEGER DEFAULT 100,
        supply INTEGER DEFAULT 100,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
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
            db.exec("ALTER TABLE users ADD COLUMN movement_path TEXT DEFAULT NULL"); // Added path storage
            db.exec("ALTER TABLE users ADD COLUMN arrival_time DATETIME DEFAULT NULL");
            db.exec("ALTER TABLE users ADD COLUMN departure_time DATETIME DEFAULT NULL");
            console.log("Migrated users table: added movement tracking columns (destination_pos, start_pos, movement_path, arrival_time, departure_time)");
        } else {
            // Check specifically for movement_path if destination_pos existed but path didn't
            const hasPath = userCols.some(c => c.name === 'movement_path');
            if (!hasPath) {
                db.exec("ALTER TABLE users ADD COLUMN movement_path TEXT DEFAULT NULL");
                console.log("Migrated users table: added movement_path");
            }
        }
    } catch (e) {
        console.error("Migration error:", e);
    }

    db.exec(createResourcesTable);
    // db.exec(createUserStatsTable); // REMOVED
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

        // Territory System Migration
        const hasIsTerritoryCenter = buildCols.some(c => c.name === 'is_territory_center');
        if (!hasIsTerritoryCenter && buildCols.length > 0) {
            db.exec("ALTER TABLE user_buildings ADD COLUMN is_territory_center INTEGER DEFAULT 0"); // 0: false, 1: true
            db.exec("ALTER TABLE user_buildings ADD COLUMN territory_radius REAL DEFAULT 5.0"); // km
            console.log("Migrated user_buildings table: added is_territory_center and territory_radius");
        }
    } catch (e) { console.log("Migration error (user_buildings):", e); }


    // db.exec(createWorldMapTable); // REMOVED
    db.exec(createMailTable);
    db.exec(createAdminTasksTable);
    db.exec(createAdminCategoriesTable);
    // Execute new character system tables
    db.exec(createCharacterCyborgTable);
    db.exec(createCharacterMinionTable);
    db.exec(createMinionEquipmentTable);
    db.exec(createMinionSkillsTable);
    db.exec(createBuildingAssignmentsTable);

    // Execute resource system tables
    db.exec(createResourceNodesTable);
    db.exec(createWarehousesTable);
    db.exec(createMarketPricesTable);

    // Migration: Check/Create building_assignments if missed (safety check)
    try {
        const check = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='building_assignments'").get();
        if (!check) {
            db.exec(createBuildingAssignmentsTable);
            console.log("Migrated: Created building_assignments table.");
        }
    } catch (e) {
        console.error("Migration error (building_assignments check):", e);
    }

    try {
        const mailCols = db.prepare('PRAGMA table_info(mail)').all();
        const hasExpires = mailCols.some(c => c.name === 'expires_at');
        if (!hasExpires && mailCols.length > 0) {
            db.exec("ALTER TABLE mail ADD COLUMN expires_at DATETIME DEFAULT NULL");
            console.log("Migrated mail table: added expires_at");
        }
    } catch (e) { console.log("Migration error (mail):", e); }

    // Migration: Add AI attributes to character_minion
    try {
        const minionCols = db.prepare('PRAGMA table_info(character_minion)').all();

        const hasHunger = minionCols.some(c => c.name === 'hunger');
        if (!hasHunger && minionCols.length > 0) {
            db.exec("ALTER TABLE character_minion ADD COLUMN hunger INTEGER DEFAULT 50"); // 0-100
            db.exec("ALTER TABLE character_minion ADD COLUMN preferences TEXT DEFAULT '{}'"); // JSON
            db.exec("ALTER TABLE character_minion ADD COLUMN current_action TEXT DEFAULT 'IDLE'"); // IDLE, GATHERING, RESTING, TRADING
            db.exec("ALTER TABLE character_minion ADD COLUMN stamina INTEGER DEFAULT 100"); // Human/Creature stamina
            console.log("Migrated character_minion table: added hunger, preferences, current_action, stamina");
        }
    } catch (e) { console.log("Migration error (character_minion AI):", e); }


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

    // const createUserVehiclesTable ... REMOVED

    // Migration: Update market_items schema
    try {
        const itemCols = db.prepare('PRAGMA table_info(market_items)').all();

        const hasType = itemCols.some(c => c.name === 'type');
        if (!hasType) {
            db.exec("ALTER TABLE market_items ADD COLUMN type TEXT DEFAULT 'RESOURCE'"); // RESOURCE, EQUIPMENT, VEHICLE
            db.exec("ALTER TABLE market_items ADD COLUMN slot TEXT DEFAULT NULL");
            db.exec("ALTER TABLE market_items ADD COLUMN stats TEXT DEFAULT '{}'"); // JSON string
            console.log("Migrated market_items table: added type, slot, stats");
        }

        const hasRarity = itemCols.some(c => c.name === 'rarity');
        if (!hasRarity) {
            db.exec("ALTER TABLE market_items ADD COLUMN rarity TEXT DEFAULT 'common'");
        }

        const hasImage = itemCols.some(c => c.name === 'image');
        if (!hasImage) {
            db.exec("ALTER TABLE market_items ADD COLUMN image TEXT DEFAULT NULL");
        }

        // PHYSICAL ATTRIBUTES MIGRATION
        const hasWeight = itemCols.some(c => c.name === 'weight');
        if (!hasWeight) {
            db.exec("ALTER TABLE market_items ADD COLUMN weight REAL DEFAULT 0.1");
            db.exec("ALTER TABLE market_items ADD COLUMN volume REAL DEFAULT 0.1");
            console.log("Migrated market_items table: added weight, volume");
        }

    } catch (e) { console.log("Migration error (market_items):", e); }

    // Migration: Update character_minion for Weight
    try {
        const minionCols = db.prepare('PRAGMA table_info(character_minion)').all();
        const hasSelfWeight = minionCols.some(c => c.name === 'self_weight');
        if (!hasSelfWeight) {
            db.exec("ALTER TABLE character_minion ADD COLUMN self_weight REAL DEFAULT 70.0"); // kg
            db.exec("ALTER TABLE character_minion ADD COLUMN carry_weight REAL DEFAULT 50.0"); // kg capacity
            console.log("Migrated character_minion table: added self_weight, carry_weight");
        }
    } catch (e) { console.log("Migration error (character_minion physics):", e); }

    // PROFESSOR: NPC System Migration
    try {
        const userCols = db.prepare('PRAGMA table_info(users)').all();

        // 1. NPC Type
        const hasNpcType = userCols.some(c => c.name === 'npc_type');
        if (!hasNpcType) {
            db.exec("ALTER TABLE users ADD COLUMN npc_type TEXT DEFAULT 'NONE'"); // NONE, ABSOLUTE, FREE
            console.log("Migrated users table: added npc_type");
        }

        // 2. NPC Attributes (Personality, Tech Focus, Diplomacy)
        const hasPersonality = userCols.some(c => c.name === 'personality');
        if (!hasPersonality) {
            db.exec("ALTER TABLE users ADD COLUMN personality TEXT DEFAULT 'Balanced'"); // Aggressive, Defensive, Merchant, Diplomatic
            db.exec("ALTER TABLE users ADD COLUMN tech_focus TEXT DEFAULT 'Balanced'"); // Military, Industrial, Biotech
            db.exec("ALTER TABLE users ADD COLUMN diplomatic_stance TEXT DEFAULT '{}'"); // JSON: { "user_id": score }
            console.log("Migrated users table: added personality, tech_focus, diplomatic_stance");
        }

        // 3. Movement System Migration
        const hasMovementPath = userCols.some(c => c.name === 'movement_path');
        if (!hasMovementPath) {
            db.exec("ALTER TABLE users ADD COLUMN movement_path TEXT DEFAULT NULL");
            db.exec("ALTER TABLE users ADD COLUMN start_pos TEXT DEFAULT NULL");
            db.exec("ALTER TABLE users ADD COLUMN destination_pos TEXT DEFAULT NULL");
            db.exec("ALTER TABLE users ADD COLUMN departure_time TEXT DEFAULT NULL");
            db.exec("ALTER TABLE users ADD COLUMN arrival_time TEXT DEFAULT NULL");
            console.log("Migrated users table: added movement system columns");
        }


        const bldgCols = db.prepare('PRAGMA table_info(user_buildings)').all();
        const hasBoundary = bldgCols.some(c => c.name === 'custom_boundary');
        if (!hasBoundary) {
            db.exec("ALTER TABLE user_buildings ADD COLUMN custom_boundary TEXT DEFAULT NULL"); // JSON string
            console.log("Migrated user_buildings table: added custom_boundary");
        }
    } catch (e) {
        console.log("Migration error (NPC System):", e);
    }

    const createNpcMemoryTable = `
    CREATE TABLE IF NOT EXISTS npc_memory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        npc_id INTEGER NOT NULL,
        target_id INTEGER NOT NULL, -- User ID or other NPC ID
        event_type TEXT NOT NULL, -- ATTACK, TRADE, ALLIANCE_OFFER, BROKEN_PROMISE
        value INTEGER DEFAULT 0, -- Impact score (-100 to +100)
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME DEFAULT NULL,
        FOREIGN KEY(npc_id) REFERENCES users(id) ON DELETE CASCADE
    );`;

    db.exec(createNpcMemoryTable);

    // Migration: construction_requests
    try {
        const tableCheckRequests = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='construction_requests'").get();
        if (!tableCheckRequests) {
            db.exec(`
                CREATE TABLE IF NOT EXISTS construction_requests (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    requester_id INTEGER,
                    owner_id INTEGER,
                    building_type TEXT,
                    x REAL,
                    y REAL,
                    world_x INTEGER,
                    world_y INTEGER,
                    status TEXT DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'REJECTED'
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(requester_id) REFERENCES users(id),
                    FOREIGN KEY(owner_id) REFERENCES users(id)
                )
            `);
            console.log("Migration: 'construction_requests' table created.");
        }
    } catch (e) {
        console.error("Migration error (construction_requests check):", e);
    }

    // Migration: tile_overrides & elevation_cache (Terrain System)
    try {
        db.exec(`
            CREATE TABLE IF NOT EXISTS tile_overrides (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                x INTEGER,
                y INTEGER,
                world_x INTEGER DEFAULT 0,
                world_y INTEGER DEFAULT 0,
                terrain_type TEXT, -- 'MOUNTAIN', 'WATER', 'FOREST', 'PLAIN'
                resource_type TEXT, -- 'GOLD', 'IRON', 'OIL'
                notes TEXT,
                UNIQUE(x, y, world_x, world_y)
            );

            CREATE TABLE IF NOT EXISTS elevation_cache (
                lat REAL,
                lng REAL,
                elevation REAL,
                fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY(lat, lng)
            );
        `);
        console.log("Migration: 'tile_overrides' and 'elevation_cache' tables created.");
    } catch (e) {
        console.error("Migration error (terrain tables):", e);
    }

    // Migration: Faction System
    try {
        const tableCheckFactions = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='factions'").get();
        if (!tableCheckFactions) {
            db.exec(`
                CREATE TABLE IF NOT EXISTS factions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT UNIQUE,
                    tag TEXT,
                    leader_id INTEGER,
                    description TEXT,
                    color TEXT DEFAULT '#FFFFFF',
                    type TEXT DEFAULT 'PLAYER', -- 'ABSOLUTE', 'FREE', 'PLAYER'
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS faction_diplomacy (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    faction_id_a INTEGER,
                    faction_id_b INTEGER,
                    stance INTEGER DEFAULT 0, -- -100 to 100
                    status TEXT DEFAULT 'NEUTRAL', -- 'NEUTRAL', 'WAR', 'ALLIANCE'
                    FOREIGN KEY(faction_id_a) REFERENCES factions(id),
                    FOREIGN KEY(faction_id_b) REFERENCES factions(id)
                );
            `);
            console.log("Migration: 'factions' and 'faction_diplomacy' tables created.");
        }

        // Add faction_id and faction_rank to users
        const userCols = db.prepare('PRAGMA table_info(users)').all();
        if (!userCols.some(c => c.name === 'faction_id')) {
            db.exec("ALTER TABLE users ADD COLUMN faction_id INTEGER DEFAULT NULL REFERENCES factions(id)");
            db.exec("ALTER TABLE users ADD COLUMN faction_rank INTEGER DEFAULT 0"); // 0: Member, 1: Officer, 2: Leader
            console.log("Migration: Added faction_id/rank to users.");
        }

    } catch (e) {
        console.error("Migration error (Faction System):", e);
    }

    // Migration: Building Types System
    const createBuildingTypesTable = `
    CREATE TABLE IF NOT EXISTS building_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        tier INTEGER DEFAULT 1,
        category TEXT DEFAULT 'GENERAL',
        
        construction_cost TEXT DEFAULT '{}',
        maintenance_cost TEXT DEFAULT '{}',
        
        min_units INTEGER DEFAULT 0,
        max_units INTEGER DEFAULT 0,
        
        storage_volume REAL DEFAULT 0.0,
        
        production_type TEXT DEFAULT NULL,
        production_rate REAL DEFAULT 0.0,
        
        is_territory_center INTEGER DEFAULT 0,
        territory_radius REAL DEFAULT 0.0,
        
        prerequisites TEXT DEFAULT '[]',
        
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );`;

    db.exec(createBuildingTypesTable);

    // Migration: Add building_type_code and last_maintenance_at to user_buildings
    try {
        const buildCols = db.prepare('PRAGMA table_info(user_buildings)').all();
        const hasBuildingTypeCode = buildCols.some(c => c.name === 'building_type_code');
        if (!hasBuildingTypeCode && buildCols.length > 0) {
            db.exec("ALTER TABLE user_buildings ADD COLUMN building_type_code TEXT DEFAULT NULL");
            console.log("Migrated user_buildings table: added building_type_code");
        }

        const hasLastMaintenance = buildCols.some(c => c.name === 'last_maintenance_at');
        if (!hasLastMaintenance && buildCols.length > 0) {
            db.exec("ALTER TABLE user_buildings ADD COLUMN last_maintenance_at DATETIME DEFAULT CURRENT_TIMESTAMP");
            console.log("Migrated user_buildings table: added last_maintenance_at");
        }
    } catch (e) { console.log("Migration error (user_buildings building_types):", e); }

    // Seed Market Items (Commodities + Equipment + Vehicles)
    try {
        // ALWAYS try to seed new items (logic inside checks for existence)
        if (true) {
            const newItems = [
                // -- HEAD --
                { name: 'Titanium Helmet', code: 'TITANIUM_HELM', price: 1200, vol: 5, weight: 2.0, desc: 'Standard issue infantry protection.', type: 'EQUIPMENT', slot: 'HEAD', stats: JSON.stringify({ constitution: 3, wisdom: 1 }) },
                { name: 'Cyber Eye Mk.I', code: 'CYBER_EYE_1', price: 800, vol: 0.5, weight: 0.2, desc: 'Basic optical enhancement.', type: 'EQUIPMENT', slot: 'HEAD', stats: JSON.stringify({ wisdom: 2, accuracy: 5 }) },
                { name: 'Tactical Visor', code: 'TAC_VISOR', price: 1500, vol: 1, weight: 0.5, desc: 'HUD with threat detection.', type: 'EQUIPMENT', slot: 'HEAD', stats: JSON.stringify({ wisdom: 4, accuracy: 8 }) },
                { name: 'Neural Link Interface', code: 'NEURAL_LINK', price: 3500, vol: 1, weight: 0.1, desc: 'Direct brain-computer interface.', type: 'EQUIPMENT', slot: 'HEAD', stats: JSON.stringify({ intelligence: 8, wisdom: 5 }) },

                // -- BODY --
                { name: 'Titanium Plating', code: 'TITANIUM_PLATE', price: 1800, vol: 10, weight: 15.0, desc: 'Heavy duty chest protection.', type: 'EQUIPMENT', slot: 'BODY', stats: JSON.stringify({ constitution: 8 }) },
                { name: 'Carbon Fiber Vest', code: 'CARBON_VEST', price: 1200, vol: 4, weight: 3.0, desc: 'Lightweight and durable.', type: 'EQUIPMENT', slot: 'BODY', stats: JSON.stringify({ constitution: 4, agility: 2 }) },
                { name: 'Reactive Armor', code: 'REACTIVE_ARMOR', price: 4000, vol: 7, weight: 12.0, desc: 'Explodes outward on impact.', type: 'EQUIPMENT', slot: 'BODY', stats: JSON.stringify({ constitution: 12, strength: 2 }) },

                // -- WEAPON --
                { name: 'Plasma Cutter', code: 'PLASMA_CUTTER', price: 2000, vol: 8, weight: 5.0, desc: 'Mining tool weaponized.', type: 'EQUIPMENT', slot: 'WEAPON', stats: JSON.stringify({ attack: 15 }) },

                // -- VEHICLES --
                { name: 'Transport Truck T1', code: 'TRUCK_T1', price: 5000, vol: 2000, weight: 3000.0, desc: 'Basic transport vehicle.', type: 'VEHICLE', slot: null, stats: JSON.stringify({ max_weight: 1000, max_volume: 500 }) },
                { name: 'Cargo Drone V1', code: 'DRONE_V1', price: 2500, vol: 50, weight: 20.0, desc: 'Aerial transport drone.', type: 'VEHICLE', slot: null, stats: JSON.stringify({ max_weight: 50, max_volume: 20 }) }
            ];

            const insertItem = db.prepare('INSERT INTO market_items (name, code, base_price, current_price, volatility, description, type, slot, stats, weight, volume) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
            const updateItem = db.prepare('UPDATE market_items SET weight = ?, volume = ? WHERE code = ?');

            newItems.forEach(item => {
                const exists = db.prepare('SELECT id FROM market_items WHERE code = ?').get(item.code);
                if (!exists) {
                    insertItem.run(item.name, item.code, item.price, item.price, item.vol || 1.0, item.desc, item.type, item.slot, item.stats, item.weight || 1.0, item.vol || 1.0);
                } else {
                    updateItem.run(item.weight || 1.0, item.vol || 1.0, item.code);
                }
            });
            console.log("Equipment & Vehicles seeded.");
        }

        // Ensure initial resources have types
        const updateResource = db.prepare("UPDATE market_items SET type = 'RESOURCE' WHERE type IS NULL");
        updateResource.run();

    } catch (e) {
        console.log("Market seed error:", e);
    }

    // Migration: Building Types System (Updated for Territory V2)
    try {
        const buildTypeCols = db.prepare('PRAGMA table_info(building_types)').all();

        // Add new columns if they don't exist
        const newCols = [
            { name: 'max_hp', type: 'INTEGER DEFAULT 100' },
            { name: 'housing_capacity', type: 'INTEGER DEFAULT 0' },
            { name: 'housing_efficiency', type: 'REAL DEFAULT 1.0' },
            { name: 'internal_map_size', type: 'INTEGER DEFAULT 0' },
            { name: 'upgrade_to', type: 'TEXT DEFAULT NULL' },
            { name: 'max_rank_depth', type: 'INTEGER DEFAULT 0' },
            { name: 'rank_slots', type: 'INTEGER DEFAULT 0' }
        ];

        newCols.forEach(col => {
            if (!buildTypeCols.some(c => c.name === col.name)) {
                db.exec(`ALTER TABLE building_types ADD COLUMN ${col.name} ${col.type}`);
                console.log(`Migrated building_types table: added ${col.name}`);
            }
        });

        // Add hp to user_buildings
        const userBuildCols = db.prepare('PRAGMA table_info(user_buildings)').all();
        if (!userBuildCols.some(c => c.name === 'hp')) {
            db.exec("ALTER TABLE user_buildings ADD COLUMN hp INTEGER DEFAULT 100");
            console.log("Migrated user_buildings table: added hp");
        }

    } catch (e) {
        console.log("Migration error (Assessment Territory V2):", e);
    }

    // Seed/Update Building Types
    try {
        console.log('Seeding/Updating building types...');

        const buildingTypes = [
            // TIER 1 - Territory
            {
                code: 'AREA_BEACON',
                name: '영토 신호기',
                description: '단순 영토 주장용 구조물. 지휘 기능 없음.',
                tier: 1,
                category: 'TERRITORY',
                construction_cost: JSON.stringify({ gold: 100 }),
                maintenance_cost: JSON.stringify({ gold: 2 }),
                min_units: 0,
                max_units: 0,
                storage_volume: 0.0,
                is_territory_center: 1,
                territory_radius: 1.0,
                max_hp: 10,
                max_rank_depth: 0,
                rank_slots: 0,
                prerequisites: JSON.stringify([])
            },
            {
                code: 'AREA_BEACON',
                name: '영토 신호기',
                description: '단순 영토 주장용 구조물. 지휘 기능 없음.',
                tier: 1,
                category: 'TERRITORY',
                construction_cost: JSON.stringify({ gold: 100 }),
                maintenance_cost: JSON.stringify({ gold: 2 }),
                min_units: 0,
                max_units: 0,
                storage_volume: 0.0,
                production_type: null,
                production_rate: 0.0,
                is_territory_center: 1,
                territory_radius: 1.0,
                max_hp: 10,
                housing_capacity: 0,
                prerequisites: JSON.stringify([])
            },
            {
                code: 'COMMAND_CENTER',
                name: '사령부',
                description: '영토의 중심. 사령관 및 부관 배치 가능.',
                tier: 1,
                category: 'ADMIN',
                construction_cost: JSON.stringify({ gold: 500, gem: 5 }),
                maintenance_cost: JSON.stringify({ gold: 20 }),
                min_units: 1,
                max_units: 5,
                storage_volume: 100.0,
                is_territory_center: 1,
                territory_radius: 3.0,
                max_hp: 30,
                housing_capacity: 5,
                housing_efficiency: 0.5,
                max_rank_depth: 2, // Commander + Officers
                rank_slots: 5,
                upgrade_to: 'CENTRAL_CONTROL_HUB',
                prerequisites: JSON.stringify([])
            },
            // TIER 2 - Advanced Territory
            {
                code: 'CENTRAL_CONTROL_HUB',
                name: '중앙 통제소',
                description: '고도화된 지휘 통제 시설. 내부 맵 및 대규모 조직 운용 가능.',
                tier: 2,
                category: 'ADMIN',
                construction_cost: JSON.stringify({ gold: 2000, gem: 50, wood: 100, ore: 100 }),
                maintenance_cost: JSON.stringify({ gold: 50, energy: 20 }),
                min_units: 5,
                max_units: 20,
                storage_volume: 500.0,
                is_territory_center: 1,
                territory_radius: 5.0,
                max_hp: 100,
                housing_capacity: 10,
                housing_efficiency: 0.8,
                internal_map_size: 100,
                max_rank_depth: 3, // Multi-level hierarchy
                rank_slots: 20,
                prerequisites: JSON.stringify(['COMMAND_CENTER', 'RESEARCH_LAB'])
            },
            // Existing types (keeping basic definitions, but new columns will update via INSERT OR REPLACE)
            {
                code: 'BASIC_QUARTERS',
                name: '기본 숙소',
                description: '유닛이 휴식하고 회복하는 곳.',
                tier: 1,
                category: 'HOUSING',
                construction_cost: JSON.stringify({ gold: 100, wood: 50 }),
                maintenance_cost: JSON.stringify({ gold: 5 }),
                min_units: 0,
                max_units: 3,
                storage_volume: 20.0,
                max_hp: 50,
                housing_capacity: 3,
                housing_efficiency: 1.0,
                prerequisites: JSON.stringify(['COMMAND_CENTER'])
            },
            {
                code: 'BASIC_WAREHOUSE',
                name: '기본 창고',
                description: '자원을 보관하는 창고.',
                tier: 1,
                category: 'STORAGE',
                construction_cost: JSON.stringify({ gold: 50, wood: 100 }),
                maintenance_cost: JSON.stringify({ gold: 3 }),
                min_units: 0,
                max_units: 2,
                storage_volume: 500.0,
                max_hp: 50,
                prerequisites: JSON.stringify(['COMMAND_CENTER'])
            },
            {
                code: 'LUMBERYARD',
                name: '목재소',
                description: '나무를 채집하는 건물.',
                tier: 1,
                category: 'RESOURCE',
                construction_cost: JSON.stringify({ gold: 75, wood: 30 }),
                maintenance_cost: JSON.stringify({ gold: 5 }),
                min_units: 1,
                max_units: 5,
                storage_volume: 50.0,
                production_type: 'WOOD',
                production_rate: 10.0,
                max_hp: 40,
                prerequisites: JSON.stringify(['COMMAND_CENTER'])
            },
            {
                code: 'MINE',
                name: '광산',
                description: '광물을 채굴하는 건물.',
                tier: 1,
                category: 'RESOURCE',
                construction_cost: JSON.stringify({ gold: 100, wood: 50 }),
                maintenance_cost: JSON.stringify({ gold: 8 }),
                min_units: 1,
                max_units: 5,
                storage_volume: 50.0,
                production_type: 'ORE',
                production_rate: 8.0,
                max_hp: 40,
                prerequisites: JSON.stringify(['COMMAND_CENTER'])
            },
            {
                code: 'FARM',
                name: '농장',
                description: '식량을 생산하는 건물.',
                tier: 1,
                category: 'RESOURCE',
                construction_cost: JSON.stringify({ gold: 75, wood: 40 }),
                maintenance_cost: JSON.stringify({ gold: 6 }),
                min_units: 1,
                max_units: 5,
                storage_volume: 50.0,
                production_type: 'FOOD',
                production_rate: 12.0,
                max_hp: 30,
                prerequisites: JSON.stringify(['COMMAND_CENTER'])
            },
            {
                code: 'RESEARCH_LAB',
                name: '연구소',
                description: '기술을 연구하고 고급 건물을 해금.',
                tier: 2,
                category: 'RESEARCH',
                construction_cost: JSON.stringify({ gold: 300, wood: 100, ore: 50 }),
                maintenance_cost: JSON.stringify({ gold: 15, energy: 5 }),
                min_units: 2,
                max_units: 8,
                storage_volume: 30.0,
                max_hp: 80,
                prerequisites: JSON.stringify(['COMMAND_CENTER', 'BASIC_WAREHOUSE'])
            },
            {
                code: 'ADVANCED_WAREHOUSE',
                name: '고급 창고',
                description: '대용량 자원 보관 시설.',
                tier: 2,
                category: 'STORAGE',
                construction_cost: JSON.stringify({ gold: 200, wood: 150, ore: 100 }),
                maintenance_cost: JSON.stringify({ gold: 10 }),
                min_units: 0,
                max_units: 3,
                storage_volume: 2000.0,
                max_hp: 150,
                prerequisites: JSON.stringify(['BASIC_WAREHOUSE', 'RESEARCH_LAB'])
            },
            {
                code: 'BARRACKS',
                name: '병영',
                description: '유닛을 훈련하고 전투 준비.',
                tier: 2,
                category: 'MILITARY',
                construction_cost: JSON.stringify({ gold: 150, wood: 80, ore: 60 }),
                maintenance_cost: JSON.stringify({ gold: 12 }),
                min_units: 1,
                max_units: 10,
                storage_volume: 100.0,
                max_hp: 120,
                prerequisites: JSON.stringify(['COMMAND_CENTER', 'RESEARCH_LAB'])
            },
            {
                code: 'FACTORY',
                name: '공장',
                description: '고급 아이템과 장비 제작.',
                tier: 2,
                category: 'INDUSTRIAL',
                construction_cost: JSON.stringify({ gold: 200, wood: 100, ore: 150 }),
                maintenance_cost: JSON.stringify({ gold: 18, energy: 10 }),
                min_units: 2,
                max_units: 8,
                storage_volume: 200.0,
                max_hp: 120,
                prerequisites: JSON.stringify(['RESEARCH_LAB', 'BASIC_WAREHOUSE'])
            }
        ];

        const insertOrReplace = db.prepare(`
            INSERT INTO building_types (
                code, name, description, tier, category,
                construction_cost, maintenance_cost,
                min_units, max_units, storage_volume,
                production_type, production_rate,
                is_territory_center, territory_radius, prerequisites,
                max_hp, housing_capacity, housing_efficiency, 
                internal_map_size, upgrade_to, max_rank_depth, rank_slots
            ) VALUES (
                @code, @name, @description, @tier, @category,
                @construction_cost, @maintenance_cost,
                @min_units, @max_units, @storage_volume,
                @production_type, @production_rate,
                @is_territory_center, @territory_radius, @prerequisites,
                @max_hp, @housing_capacity, @housing_efficiency,
                @internal_map_size, @upgrade_to, @max_rank_depth, @rank_slots
            )
            ON CONFLICT(code) DO UPDATE SET
                name=excluded.name,
                description=excluded.description,
                construction_cost=excluded.construction_cost,
                maintenance_cost=excluded.maintenance_cost,
                is_territory_center=excluded.is_territory_center,
                territory_radius=excluded.territory_radius,
                max_hp=excluded.max_hp,
                housing_capacity=excluded.housing_capacity,
                housing_efficiency=excluded.housing_efficiency,
                internal_map_size=excluded.internal_map_size,
                max_rank_depth=excluded.max_rank_depth,
                rank_slots=excluded.rank_slots,
                upgrade_to=excluded.upgrade_to,
                production_type=excluded.production_type,
                production_rate=excluded.production_rate
        `);

        // Helper to fill defaults for optional fields if I miss any in existing types
        const bindParams = (bt) => ({
            code: bt.code,
            name: bt.name,
            description: bt.description,
            tier: bt.tier,
            category: bt.category,
            construction_cost: bt.construction_cost,
            maintenance_cost: bt.maintenance_cost,
            min_units: bt.min_units,
            max_units: bt.max_units,
            storage_volume: bt.storage_volume,
            production_type: bt.production_type || null,
            production_rate: bt.production_rate || 0.0,
            is_territory_center: bt.is_territory_center || 0,
            territory_radius: bt.territory_radius || 0,
            prerequisites: bt.prerequisites,
            max_hp: bt.max_hp || 50,
            housing_capacity: bt.housing_capacity || 0,
            housing_efficiency: bt.housing_efficiency || 1.0,
            internal_map_size: bt.internal_map_size || 0,
            upgrade_to: bt.upgrade_to || null,
            max_rank_depth: bt.max_rank_depth || 0,
            rank_slots: bt.rank_slots || 0
        });

        buildingTypes.forEach(bt => {
            insertOrReplace.run(bindParams(bt));
        });

        console.log(`Seeded/Updated ${buildingTypes.length} building types.`);

    } catch (e) {
        console.log("Building types seed error:", e);
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
            // db.prepare('INSERT INTO user_stats (user_id) VALUES (?)').run(admin.id); // REMOVED
            // Create cyborg character for admin
            db.prepare('INSERT INTO character_cyborg (user_id, name, level) VALUES (?, ?, ?)').run(admin.id, 'Admin Cyborg', 1);
            console.log("Admin user seeded: admin / 1234 (with cyborg)");
        } else {
            // Check if admin has cyborg, create if not
            const adminCyborg = db.prepare("SELECT * FROM character_cyborg WHERE user_id = ?").get(adminCheck.id);
            if (!adminCyborg) {
                db.prepare('INSERT OR IGNORE INTO character_cyborg (user_id, name, level) VALUES (?, ?, ?)').run(adminCheck.id, 'Admin Cyborg', 1);
                console.log("Created cyborg for existing admin user (if not exists)");
            }
        }
    } catch (e) {
        console.log("Admin seed error or already exists", e);
    }

    // Seed Sample Resource Nodes
    try {
        const { ResourceType, RESOURCE_DEFINITIONS } = require('./types/ResourceTypes');
        const nodeCount = db.prepare('SELECT COUNT(*) as count FROM resource_nodes').get();

        if (nodeCount.count === 0) {
            console.log('Seeding sample resource nodes...');

            const sampleNodes = [
                // WOOD nodes
                { tile_id: '50_25', resource_type: ResourceType.WOOD, current_amount: 800, max_amount: 1000, regen_rate: 1.0 },
                { tile_id: '52_26', resource_type: ResourceType.WOOD, current_amount: 600, max_amount: 1000, regen_rate: 1.0 },
                { tile_id: '48_24', resource_type: ResourceType.WOOD, current_amount: 900, max_amount: 1000, regen_rate: 1.0 },

                // ORE nodes
                { tile_id: '55_30', resource_type: ResourceType.ORE, current_amount: 300, max_amount: 500, regen_rate: 0.5 },
                { tile_id: '58_32', resource_type: ResourceType.ORE, current_amount: 450, max_amount: 500, regen_rate: 0.5 },
                { tile_id: '53_28', resource_type: ResourceType.ORE, current_amount: 200, max_amount: 500, regen_rate: 0.5 },

                // FOOD nodes
                { tile_id: '45_22', resource_type: ResourceType.FOOD, current_amount: 700, max_amount: 800, regen_rate: 0.8 },
                { tile_id: '47_23', resource_type: ResourceType.FOOD, current_amount: 650, max_amount: 800, regen_rate: 0.8 },
                { tile_id: '49_25', resource_type: ResourceType.FOOD, current_amount: 800, max_amount: 800, regen_rate: 0.8 },

                // STONE nodes
                { tile_id: '60_35', resource_type: ResourceType.STONE, current_amount: 400, max_amount: 600, regen_rate: 0.6 },
                { tile_id: '62_36', resource_type: ResourceType.STONE, current_amount: 550, max_amount: 600, regen_rate: 0.6 },

                // ENERGY nodes (rare)
                { tile_id: '65_40', resource_type: ResourceType.ENERGY, current_amount: 150, max_amount: 300, regen_rate: 0.3 },
                { tile_id: '68_42', resource_type: ResourceType.ENERGY, current_amount: 200, max_amount: 300, regen_rate: 0.3 },

                // MANA_CRYSTAL nodes (very rare)
                { tile_id: '70_45', resource_type: ResourceType.MANA_CRYSTAL, current_amount: 50, max_amount: 100, regen_rate: 0.05 },
                { tile_id: '75_48', resource_type: ResourceType.MANA_CRYSTAL, current_amount: 30, max_amount: 100, regen_rate: 0.05 }
            ];

            const insertNode = db.prepare(`
                INSERT INTO resource_nodes (tile_id, resource_type, current_amount, max_amount, regen_rate)
                VALUES (?, ?, ?, ?, ?)
            `);

            sampleNodes.forEach(node => {
                insertNode.run(node.tile_id, node.resource_type, node.current_amount, node.max_amount, node.regen_rate);
            });

            console.log(`Seeded ${sampleNodes.length} sample resource nodes`);
        }
    } catch (e) {
        console.log("Resource nodes seed error:", e);
    }

    console.log('Database initialized');
}

initSchema();

module.exports = db;
