const db = require('../../database');

/**
 * @class UserFactory
 * @description
 * Creates a User and all their required dependencies atomically.
 * Enforces the "Database Schema Laws" defined in docs/DATABASE_SCHEMA.md.
 */
class UserFactory {
    /**
     * Creates a full user entity with cyborg, resources, and optional building.
     * @param {Object} params
     * @param {string} params.username - Unique username
     * @param {string} params.password - Default: '1234'
     * @param {string} params.npcType - 'NONE' (Player), 'ABSOLUTE', 'FREE'
     * @param {string} params.role - 'user' or 'admin'
     * @param {number|null} params.factionId - Optional faction ID
     * @param {Object} params.location - { x, y, world_x, world_y }
     * @param {Object} params.resources - { gold, gem }
     * @param {Object} params.initialBuilding - Optional { code, radius }
     * @returns {Object} Created User Object
     */
    static create({
        username,
        password = '1234',
        npcType = 'NONE',
        role = 'user',
        factionId = null,
        factionRank = 0,
        location = { x: 0, y: 0, world_x: 0, world_y: 0 },
        resources = { gold: 1000, gem: 10 },
        initialBuilding = null // e.g. { code: 'COMMAND_CENTER' }
    }) {
        console.log(`[UserFactory] Creating user: ${username} (${npcType})...`);

        let userId = null;

        const transaction = db.transaction(() => {
            // 1. Create User Record
            const insertUser = db.prepare(`
                INSERT INTO users (
                    username, password, role, npc_type, 
                    faction_id, faction_rank,
                    current_pos, start_pos, destination_pos
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            const posStr = `${location.x}_${location.y}`;
            const info = insertUser.run(
                username,
                password,
                role,
                npcType,
                factionId,
                factionRank,
                posStr, posStr, posStr // Init movement vars
            );
            userId = info.lastInsertRowid;

            // 2. Create User Resources (Wallet)
            const insertRes = db.prepare(`
                INSERT INTO user_resources (user_id, gold, gem) VALUES (?, ?, ?)
            `);
            insertRes.run(userId, resources.gold, resources.gem);

            // 3. Create Cyborg (REQUIRED)
            // Default stats for a new cyborg
            const baseStats = { str: 10, dex: 10, con: 10, int: 10, wis: 10 };
            const hp = baseStats.con * 10 + baseStats.str * 5;
            const mp = baseStats.wis * 8 + baseStats.int * 6;

            const insertCyborg = db.prepare(`
                INSERT INTO character_cyborg (
                    user_id, name, 
                    strength, dexterity, constitution, intelligence, wisdom,
                    hp, mp, movement_speed, vision_range
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            insertCyborg.run(
                userId,
                `${username}'s Cyborg`, // Default name
                baseStats.str, baseStats.dex, baseStats.con, baseStats.int, baseStats.wis,
                hp, mp,
                0.1, // Default speed
                10.0 // Default vision
            );

            // 4. (Optional) Create Initial Building
            if (initialBuilding) {
                // Validate building code against building_types (Soft check)
                const typeCheck = db.prepare("SELECT * FROM building_types WHERE code = ?").get(initialBuilding.code);

                // If type doesn't exist, we might warn but proceed if force is needed, 
                // but for integrity we should strictly use what exists or fallback.
                const code = typeCheck ? typeCheck.code : initialBuilding.code;
                const radius = typeCheck ? typeCheck.territory_radius : (initialBuilding.radius || 5.0);
                const isCenter = typeCheck ? typeCheck.is_territory_center : 1;

                const insertBldg = db.prepare(`
                    INSERT INTO user_buildings (
                        user_id, building_type_code, type, 
                        x, y, world_x, world_y, 
                        is_territory_center, territory_radius, hp
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `);

                insertBldg.run(
                    userId,
                    code,
                    code, // Keep 'type' synced for legacy compatibility, but code is source of truth
                    location.x, location.y, location.world_x, location.world_y,
                    isCenter, radius, 100
                );
            }
        });

        // Execute Transaction
        try {
            transaction();
            console.log(`[UserFactory] Successfully created user ID: ${userId}`);
            return { id: userId, username };
        } catch (err) {
            console.error(`[UserFactory] Failed to create user ${username}:`, err);
            throw err;
        }
    }
}

module.exports = UserFactory;
