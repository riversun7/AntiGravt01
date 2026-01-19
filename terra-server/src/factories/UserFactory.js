const db = require('../../database');

/**
 * @file UserFactory.js
 * @description 사용자와 그 부속 데이터(자원, 스탯, 사이보그, 초기 건물)를 원자적(Atomic)으로 생성하는 팩토리 클래스입니다.
 * @role 데이터 무결성을 보장하며 복잡한 사용자 생성 프로세스를 캡슐화
 * @dependencies database
 * @referenced_by seed_factions.js, seed_rival.js, server.js (회원가입/로그인 등에서 사용 권장)
 * @status Active
 * @analysis 
 * - DB 트랜잭션을 사용하여 모든 관련 레코드가 동시에 생성되거나, 실패 시 롤백되도록 보장합니다.
 * - `user_stats` 테이블과 `character_cyborg` 테이블 간의 데이터 중복이 보이며, 이는 추후 통합 모델로 리팩토링할 필요가 있습니다.
 */

const db = require('../../database');

/**
 * @class UserFactory
 * @description
 * Creates a User and all their required dependencies atomically.
 * Enforces the "Database Schema Laws" defined in docs/DATABASE_SCHEMA.md.
 */
class UserFactory {
    /**
     * @function create
     * @description 사용자 엔티티를 생성하고 관련 자원, 캐릭터, 건물을 초기화합니다.
     * @param {Object} params - 생성 파라미터
     * @param {string} params.username - 아이디 (Unique)
     * @param {string} params.password - 비밀번호 (Default: '1234')
     * @param {string} params.npcType - NPC 타입 ('NONE', 'ABSOLUTE', 'FREE')
     * @param {Object} params.location - 초기 위치
     * @param {Object} params.resources - 초기 자원
     * @param {Object} params.initialBuilding - 초기 건물 (옵션)
     * @returns {Object} 생성된 사용자 객체 ({ id, username })
     * @analysis 
     * - `user_stats`는 향후 제거될 예정(Legacy)이나 호환성을 위해 유지되고 있습니다.
     * - 건물 생성 시 `building_types` 테이블을 참조하여 유효성을 검증하는 소프트 체크(Soft Check)가 포함되어 있습니다.
     */
    static create({
        username,
        password = '1234',
        npcType = 'NONE',
        role = 'user',
        factionId = null,
        factionRank = 0,
        cyborgModel = 'COMMANDER', // Default model
        stats = null, // Optional custom stats { strength, dexterity ... }
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
                    faction_id, faction_rank, cyborg_model,
                    current_pos, start_pos, destination_pos
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            const posStr = `${location.x}_${location.y}`;
            const info = insertUser.run(
                username,
                password,
                role,
                npcType,
                factionId,
                factionRank,
                cyborgModel,
                posStr, posStr, posStr // Init movement vars
            );
            userId = info.lastInsertRowid;

            // 2. Create User Resources (Wallet)
            const insertRes = db.prepare(`
                INSERT INTO user_resources (user_id, gold, gem) VALUES (?, ?, ?)
            `);
            insertRes.run(userId, resources.gold, resources.gem);

            // 3. Create Cyborg & Stats
            // Default stats for a new cyborg if not provided
            const baseStats = stats || { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, agility: 10 };

            // Insert into user_stats (important for UI/Logic consistency)
            try {
                const insertStats = db.prepare(`
                    INSERT INTO user_stats (
                        user_id, strength, dexterity, constitution, intelligence, wisdom, agility
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                `);
                insertStats.run(userId, baseStats.strength, baseStats.dexterity, baseStats.constitution, baseStats.intelligence, baseStats.wisdom, baseStats.agility);
            } catch (e) {
                console.warn('[UserFactory] Failed to insert user_stats (might be missing table or duplicate):', e.message);
            }

            const hp = (baseStats.constitution * 10) + (baseStats.strength * 5);
            const mp = (baseStats.wisdom * 8) + (baseStats.intelligence * 6);

            const insertCyborg = db.prepare(`
                INSERT INTO character_cyborg (
                    user_id, name, 
                    strength, dexterity, constitution, intelligence, wisdom, agility,
                    hp, mp, movement_speed, vision_range
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            insertCyborg.run(
                userId,
                `${username}'s Cyborg`, // Default name
                baseStats.strength, baseStats.dexterity, baseStats.constitution, baseStats.intelligence, baseStats.wisdom, baseStats.agility,
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
