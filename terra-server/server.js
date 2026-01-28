/**
 * @file server.js
 * @description Terra-Server의 메인 진입점 파일입니다. Express 앱을 설정하고 API 라우트, 게임 루프(경제, NPC 등)를 실행합니다.
 * @role 백엔드 서버 코어, API 라우팅, 주기적 게임 로직 실행 (Cron Jobs)
 * @dependencies express, sqlite3(better-sqlite3), database.js, 각종 Game/AI Managers
 * @referenced_by Client App (API 호출), Docker Container (Entrypoint)
 * @status Active (Monolith)
 * @analysis 
 * - 현재 모든 API와 게임 로직이 이 파일 하나에 집중되어 있어 유지보수가 어렵습니다 (God Object).
 * - 추후 라우트(Routes)와 컨트롤러(Controllers)를 분리하는 리팩토링이 강력히 권장됩니다.
 * - `adminConfig` 변수는 현재 코드 내에서 실질적으로 사용되지 않는 것으로 보입니다.
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./database');
const fs = require('fs');
const path = require('path');

// 게임 로직 매니저 로드
const TerrainManager = require('./game/TerrainManager');
const terrainManager = new TerrainManager(db);
const PathfindingService = require('./game/PathfindingService');
const pathfindingService = new PathfindingService(db);

// --- 관리자 런타임 설정 (Admin Runtime Config) ---
/**
 * @variable adminConfig
 * @description 게임 내 관리자 기능에 영향을 주는 런타임 설정값입니다.
 * @analysis 
 * - 현재 이 변수는 선언만 되어 있고 실제 로직에서 거의 사용되지 않는 레거시 코드입니다.
 * - 추후 관리자 패널에서 실시간으로 게임 속도를 조절하거나 시야 제한을 해제하는 기능 구현 시 활용될 수 있습니다.
 */
let adminConfig = {
    speed: 10.0,       // 유닛의 이동 속도 계수 (km/s) - 기본값: 36,000 km/h
    viewRange: 99999.0 // 관리자 전용 시야 범위 (km) - 기본값: 무제한
};

const app = express();
const PORT = process.env.PORT || 3001;

// CORS (Cross-Origin Resource Sharing) 설정
// 클라이언트(프론트엔드)에서의 API 호출을 허용하기 위한 보안 설정입니다.
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*', // 모든 도메인 허용 (보안상 추후 특정 도메인으로 제한 권장)
    credentials: true                       // 인증 쿠키/헤더 전달 허용
}));

// Body Parser 설정: 요청 본문(JSON) 파싱
app.use(bodyParser.json());

// --- 요청 로깅 미들웨어 (Request Logging Middleware) ---
/**
 * 모든 들어오는 HTTP 요청을 로깅하여 디버깅을 돕습니다.
 * 형식: [시간] 메소드 URL (IP 주소)
 */
app.use((req, res, next) => {
    // console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} (${req.ip})`); // 로그 과다 발생 시 주석 처리
    next();
});

// 정적 파일 서빙: 업로드된 이미지 등
// 예: /uploads/profile.png 로 접근 가능
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- 기본 라우트 (Health Check) ---
app.get('/', (req, res) => {
    res.send('Terra Server is running');
});
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Terra Server is running', port: PORT });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`========================================`);
    console.log(`🚀 TERRA SERVER RUNNING on port ${PORT}`);
    console.log(`========================================`);
});


// Routes
// ============================================
// 사용자 인증 API (User Authentication APIs)
// ============================================

/**
 * @route POST /api/register
 * @description 신규 사용자를 등록하고 초기 자원과 건물을 지급합니다.
 * @param {string} username - 사용자 아이디
 * @param {string} password - 사용자 비밀번호
 * @returns {Object} { id, username }
 * 
 * @analysis
 * - [보안 취약점] 현재 비밀번호가 **평문(Plain Text)**으로 저장되고 있습니다. 반드시 `bcrypt` 등을 사용해 해싱(Hashing) 처리해야 합니다.
 * - [트랜잭션 미사용] 사용자 생성과 초기 자원 지급이 원자적(Atomic)이지 않을 수 있습니다. `UserFactory` 사용을 권장하거나 트랜잭션으로 묶어야 합니다.
 */
app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    try {
        // 아이디 중복 체크
        const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
        if (existing) {
            return res.status(400).json({ error: 'Username already taken' });
        }

        // 사용자 레코드 생성 (서울 시청 위경도를 초기 위치로 설정)
        // TODO: 비밀번호 해싱 적용 필수
        const info = db.prepare(`
            INSERT INTO users (username, password, role, current_pos, start_pos, destination_pos) 
            VALUES (?, ?, 'user', '37.5665_126.9780', '37.5665_126.9780', '37.5665_126.9780')
        `).run(username, password);

        const userId = info.lastInsertRowid;

        // 초기 자원 지급
        db.prepare('INSERT INTO user_resources (user_id, gold, gem) VALUES (?, 1000, 10)').run(userId);

        // 초기 스탯 생성 (Legacy: user_stats + character_cyborg)
        // 두 테이블에 중복 데이터가 들어가고 있어 리팩토링 대상입니다.
        db.prepare(`
            INSERT INTO user_stats (
                user_id, strength, dexterity, constitution, intelligence, wisdom, agility
            ) VALUES (?, 10, 10, 10, 10, 10, 10)
        `).run(userId);

        // 기본 사이보그 캐릭터 생성
        db.prepare(`
            INSERT INTO character_cyborg (
                user_id, name, strength, dexterity, constitution, intelligence, wisdom, agility, hp, mp
            ) VALUES (?, ?, 10, 10, 10, 10, 10, 10, 150, 140)
        `).run(userId, `${username}'s Cyborg`);

        res.json({ id: userId, username });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Registration failed' });
    }
});

/**
 * @route POST /api/login
 * @description 사용자 로그인을 처리합니다.
 * @param {string} username - 사용자 아이디
 * @param {string} password - 사용자 비밀번호
 * @returns {Object} { id, username, role, ... }
 * 
 * @analysis
 * - [보안 취약점] 세션이나 JWT 토큰을 발급하지 않고 단순히 유저 정보를 반환합니다. 클라이언트가 이를 믿고 인증 상태를 유지하면 보안에 취약합니다.
 * - 비밀번호 해싱 적용 시 검증 로직(`bcrypt.compare`) 변경이 필요합니다.
 */
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    try {
        const user = db.prepare('SELECT * FROM users WHERE username = ? AND password = ?').get(username, password);
        if (user) {
            res.json({ user });
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Login failed' });
    }
});

// ============================================
// 사용자 정보 조회 및 이동 처리 (User Info & Movement Check)
// ============================================

/**
 * @route GET /api/user/:id
 * @description 사용자 기본 정보, 자원, 장비 상태를 조회합니다. 이동 완료 체크도 수행합니다.
 * @param {string} id - 사용자 ID
 * @analysis 
 * - **지연 업데이트(Lazy Update) 패턴**: 별도의 이동 완료 이벤트가 없고, 사용자가 정보를 조회할 때 `arrival_time`을 체크하여 위치를 업데이트합니다.
 * - 장비 정보 등 여러 테이블을 조인(Join)하거나 별도 쿼리로 가져와 병합하고 있습니다. 
 */
app.get('/api/user/:id', (req, res) => {
    try {
        // 1. 사용자 기본 정보 조회
        let user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
        if (!user) return res.status(404).json({ error: 'User not found' });

        // --- 이동 완료 체크 로직 (arrival_time 지났는지 확인) ---
        if (user.destination_pos && user.arrival_time) {
            const now = new Date();
            const arrival = new Date(user.arrival_time);

            if (now >= arrival) {
                // 도착 완료 처리
                db.prepare(`
                    UPDATE users 
                    SET current_pos = destination_pos, 
                        destination_pos = NULL, start_pos = NULL, arrival_time = NULL, departure_time = NULL 
                    WHERE id = ?
                `).run(user.id);

                // 업데이트된 정보 다시 조회 (동기화)
                user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
            }
        }

        // 2. 자원 정보 조회
        const resources = db.prepare('SELECT * FROM user_resources WHERE user_id = ?').get(user.id);

        // 3. 캐릭터(Cyborg) 스탯 조회
        const stats = db.prepare('SELECT * FROM character_cyborg WHERE user_id = ?').get(user.id);

        // 4. 장비 정보 조회
        const equipment = db.prepare(`
            SELECT ue.*, mi.name as item_name, mi.type as item_type
            FROM user_equipment ue
            JOIN market_items mi ON ue.item_id = mi.id
            WHERE ue.user_id = ?
        `).all(user.id);

        res.json({
            ...user,
            resources: resources || { gold: 0, gem: 0 },
            stats: stats || {},
            equipment: equipment || []
        });

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to fetch user' });
    }
});

// ============================================
// 관리자 기능 (Admin Features)
// ============================================

/**
 * @route POST /api/admin/config
 * @description 관리자 설정(속도, 시야 등)을 런타임에 변경합니다.
 * @analysis 
 * - 메모리 상의 `adminConfig` 변수만 변경하므로 재시작 시 초기화됩니다.
 * - 인증 미들웨어가 없어 누구나 호출 가능한 보안 위험이 있습니다.
 */
app.post('/api/admin/config', (req, res) => {
    const { speed, viewRange } = req.body;
    if (speed !== undefined) adminConfig.speed = parseFloat(speed);
    if (viewRange !== undefined) adminConfig.viewRange = parseFloat(viewRange);
    res.json({ success: true, config: adminConfig });
});

/**
 * @route GET /api/admin/config
 * @description 현재 관리자 설정을 조회합니다.
 */
app.get('/api/admin/config', (req, res) => {
    res.json(adminConfig);
});

/**
 * @route POST /api/admin/reset-world
 * @description 게임 월드를 초기화합니다. (테스트용)
 * @analysis 
 * - 사용자, 자원, 건물을 모두 삭제하고 초기 라이벌(Rival)만 재생성합니다.
 * - 운영 중 실수로 호출되면 돌이킬 수 없는 데이터 손실이 발생하므로 **매우 주의**해야 합니다.
 * - 별도의 관리자 인증(Admin Auth) 절차가 반드시 추가되어야 합니다.
 */
app.post('/api/admin/reset-world', (req, res) => {
    try {
        console.warn("[Admin] RESET WORLD TRIGGERED!");

        // 핵심 테이블 데이터 삭제 (TRUNCATE 대신 DELETE 사용)
        db.prepare('DELETE FROM users WHERE role != "admin"').run(); // 관리자 제외 삭제
        db.prepare('DELETE FROM user_resources WHERE user_id NOT IN (SELECT id FROM users)').run();
        db.prepare('DELETE FROM user_buildings').run();
        db.prepare('DELETE FROM user_inventory').run();
        db.prepare('DELETE FROM character_cyborg WHERE user_id NOT IN (SELECT id FROM users)').run();
        // 기타 테이블 청소
        db.prepare('DELETE FROM building_assignments').run();
        db.prepare('DELETE FROM factions WHERE type != "ABSOLUTE"').run(); // 절대 세력 보존? (확인 필요)

        // 라이벌(Rival) 및 초기 NPC 재생성
        const seedRival = require('./seed_rival'); // seed_rival.js 함수 호출 고려 필요 (현재는 파일 실행 방식이라 require로 재실행 어려울 수 있음)
        // 여기서는 간단히 seed_rival.js 내용을 실행하지 않고 로그만 남김 (구조적 개선 필요)

        res.json({ success: true, message: "World reset (partial implementation)" });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
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
// ============================================
// 경제 및 시스템 설정 (Economy & System Config)
// ============================================

/**
 * @constant MARKET_UPDATE_INTERVAL
 * @description 시장 가격 변동 주기 (밀리초 단위). 현재는 legacy 코드로 남아있고 실제로는 SYSTEM_CONFIG를 사용합니다.
 */
const MARKET_UPDATE_INTERVAL = 60000; // 1분

// 전역 시스템 설정 (Global System Configuration)
/**
 * @variable SYSTEM_CONFIG
 * @description 게임의 주요 시스템(시장, 생산, NPC, 세력 등)의 활성화 여부와 주기를 제어하는 전역 설정 객체입니다.
 * @role 서버의 런타임 상태 제어 (DB가 아닌 메모리에 상주하므로 재시작 시 초기화됨)
 * @priority High - 게임 루프의 핵심 제어 변수
 * 
 * @property {boolean} market_fluctuation - 시장 가격 자동 변동 시스템 활성화 여부
 * @property {number} market_interval - 시장 가격 변동 주기 (ms)
 * @property {boolean} production_active - 자원 생산(채굴/농사) 시스템 활성화 여부
 * @property {number} production_interval - 자원 생산 주기 (ms)
 * @property {boolean} npc_activity - 일반 NPC(Minion) AI 활성화 여부
 * @property {number} npc_interval - 일반 NPC 행동 주기 (ms)
 * @property {number} npc_position_update_interval - 이동 중인 NPC의 위치 업데이트 주기 (초 단위 주의)
 * @property {boolean} faction_active - 세력(Faction) AI 활성화 여부 (Absolute/Free NPC)
 * @property {number} faction_interval - 세력 AI 의사결정 주기 (ms)
 * @property {number} client_poll_interval - 클라이언트가 서버 상태를 확인하는 권장 주기 (ms)
 * 
 * @analysis 
 * - 현재 모든 설정이 메모리에 있어 서버 재시작 시 기본값(비활성)으로 돌아갑니다. 운영 환경에서는 DB의 `system_settings` 테이블 등을 만들어 영구 저장해야 합니다.
 * - 개발 및 디버깅 중에는 `false`로 두어 불필요한 로그나 성능 저하를 막는 것이 유리합니다.
 */
let SYSTEM_CONFIG = {
    market_fluctuation: false,       // 시장 가격 변동 (기본: 꺼짐)
    market_interval: 60000,         // 시장 업데이트 주기: 60초
    production_active: true,        // 자원 생산 (기본: 켜짐)
    production_interval: 60000,     // 생산 주기: 60초
    npc_activity: true,             // 미니언 AI (기본: 켜짐)
    npc_interval: 60000,            // 미니언 행동 주기: 60초
    npc_position_update_interval: 30, // 이동 위치 갱신: 30초
    faction_active: true,           // 세력전 AI (기본: 켜짐 - NPC 확장 테스트)
    faction_interval: 60000,        // 세력 행동 주기: 60초
    client_poll_interval: 60000     // 클라이언트 폴링: 60초
};

global.SYSTEM_CONFIG = SYSTEM_CONFIG;

/**
 * @function updateMarketPrices
 * @description 시장 가격을 주기적으로 변동시키는 함수
 * @role 경제 시스템 핵심 루프
 * @analysis 
 * - 단순한 랜덤 변동 로직 (-volatility% ~ +volatility%)을 사용 중입니다.
 * - 수요/공급에 기반한 동적 가격 모델로 고도화할 필요가 있습니다.
 */
function updateMarketPrices() {
    // 다음 실행 스케줄링
    setTimeout(updateMarketPrices, SYSTEM_CONFIG.market_interval);

    if (!SYSTEM_CONFIG.market_fluctuation) return; // 비활성화 시 스킵

    try {
        const items = db.prepare('SELECT * FROM market_items').all();
        const updateStmt = db.prepare('UPDATE market_items SET current_price = ?, previous_price = ? WHERE id = ?');

        items.forEach(item => {
            // 단순 랜덤 변동: -volatility% ~ +volatility%
            const changePercent = (Math.random() * (item.volatility * 2) - item.volatility) / 100;
            let newPrice = Math.floor(item.current_price * (1 + changePercent));

            // 경계값 체크 (최소 가격: 기본가의 10%)
            if (newPrice < item.base_price * 0.1) newPrice = Math.floor(item.base_price * 0.1);

            updateStmt.run(newPrice, item.current_price, item.id);
        });
        console.log(`[Market] Prices updated at ${new Date().toLocaleTimeString()} (Next in ${SYSTEM_CONFIG.market_interval / 1000}s)`);
    } catch (e) {
        console.error("Market Update Error:", e);
    }
}
// Start Market Loop
setTimeout(updateMarketPrices, SYSTEM_CONFIG.market_interval);

// Old ticker removed


// ============================================
// MINION AI TICK SYSTEM (30 seconds interval)
// ============================================

const MinionAI = require('./ai/MinionAI');
const minionAI = new MinionAI(db);

/**
 * @function processMinionAI
 * @description 미니언 AI 로직을 주기적으로 실행하는 루프 함수
 * @role NPC/Minion 행동 처리 (채굴, 휴식 등)
 * @analysis 
 * - `SYSTEM_CONFIG.npc_interval` (기본 60초) 마다 실행됩니다.
 * - `character_minion` 테이블의 `user_id`를 기반으로 사용자별 미니언들을 처리합니다.
 */
function processMinionAI() {
    // 다음 실행 스케줄링
    setTimeout(processMinionAI, SYSTEM_CONFIG.npc_interval);

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
setTimeout(processMinionAI, SYSTEM_CONFIG.npc_interval);
console.log(`[Minion AI] AI tick system started (Interval: ${SYSTEM_CONFIG.npc_interval / 1000}s)`);

// ============================================
// RESOURCE PRODUCTION CRON
// ============================================

/**
 * @function processResourceProduction
 * @description 건물에 배치된 미니언들의 자원 생산을 처리하는 루프
 * @role 자원 생산 및 미니언 상태(배터리, 체력) 소모 관리
 * @analysis 
 * - `building_assignments` 테이블을 순회하며 채굴(mining) 작업자를 처리합니다.
 * - 생산량은 `production_rate`와 시간 비율(intervalRatio)에 비례합니다.
 * - 미니언의 체력/배터리가 낮으면 자동으로 병영(Barracks)으로 보내 휴식시킵니다.
 */
function processResourceProduction() {
    // Schedule next run
    setTimeout(processResourceProduction, SYSTEM_CONFIG.production_interval);

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
            // Adjust production based on interval ratio (assuming baseProduction is per minute)
            const intervalRatio = SYSTEM_CONFIG.production_interval / 60000;
            const baseProduction = 10; // 10 gold per minute
            const production = Math.floor(baseProduction * assignment.production_rate * intervalRatio);

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

/**
 * @function checkMinionHealth
 * @description 미니언이 작업을 계속할 수 있는지(체력/배터리 체크) 확인
 * @param {Object} assignment - 작업 배정 정보
 * @returns {boolean} - 작업 가능 여부
 */
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

/**
 * @function drainMinionResources
 * @description 작업 수행에 따른 미니언의 자원(체력, 배터리, 연료) 소모 처리
 * @param {Object} assignment - 작업 배정 정보
 */
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

/**
 * @function sendToBarracks
 * @description 미니언을 강제로 벙영(Barracks)으로 이동시켜 휴식(resing) 상태로 전환
 * @param {number} minionId - 미니언 ID
 * @param {number} userId - 사용자 ID
 */
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

/**
 * @function processRestingMinions
 * @description 휴식 중인 미니언들의 체력/배터리 회복 처리
 * @role 병영(Barracks) 내 미니언 회복 로직
 */
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
// Start production cron
setTimeout(processResourceProduction, SYSTEM_CONFIG.production_interval);
console.log('[Production] Resource production cron started');

// NPC Logic Cron
const absoluteNpcManager = require('./ai/AbsoluteNpcManager');
const freeNpcManager = require('./ai/FreeNpcManager');

/**
 * @function processFactionLogic
 * @description NPC 세력(Faction) AI를 주기적으로 실행하는 루프
 * @role Absolute(절대자) 및 Free(자유) 세력의 행동(이동, 전투, 확장) 처리
 */
function processFactionLogic() {
    setTimeout(processFactionLogic, SYSTEM_CONFIG.faction_interval);

    if (!SYSTEM_CONFIG.faction_active) return;

    console.log('[NPC] Faction Logic ACTIVE - Running...');
    absoluteNpcManager.run();
    freeNpcManager.run();
}
// Start Faction Loop
setTimeout(processFactionLogic, SYSTEM_CONFIG.faction_interval);
console.log('[NPC] Absolute & Free Faction Logic loop started');
console.log(`[System] Initial Config: faction_active=${SYSTEM_CONFIG.faction_active}, npc_activity=${SYSTEM_CONFIG.npc_activity}`);


// API: System Configuration
app.get('/api/admin/system/config', (req, res) => {
    res.json(SYSTEM_CONFIG);
});

app.post('/api/admin/system/config', (req, res) => {
    const {
        market_fluctuation, market_interval,
        npc_activity, npc_interval,
        production_active, production_interval,
        faction_active, faction_interval,
        client_poll_interval,
        npc_position_update_interval
    } = req.body;

    if (market_fluctuation !== undefined) SYSTEM_CONFIG.market_fluctuation = market_fluctuation;
    if (market_interval !== undefined) SYSTEM_CONFIG.market_interval = Number(market_interval);

    if (production_active !== undefined) SYSTEM_CONFIG.production_active = production_active;
    if (production_interval !== undefined) SYSTEM_CONFIG.production_interval = Number(production_interval);

    if (npc_activity !== undefined) SYSTEM_CONFIG.npc_activity = npc_activity;
    if (npc_interval !== undefined) SYSTEM_CONFIG.npc_interval = Number(npc_interval);

    if (faction_active !== undefined) SYSTEM_CONFIG.faction_active = faction_active;
    if (faction_interval !== undefined) SYSTEM_CONFIG.faction_interval = Number(faction_interval);

    if (client_poll_interval !== undefined) SYSTEM_CONFIG.client_poll_interval = Number(client_poll_interval);

    if (npc_position_update_interval !== undefined) SYSTEM_CONFIG.npc_position_update_interval = Number(npc_position_update_interval);

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

/**
 * @route POST /api/resources/transfer
 * @description 다른 사용자에게 자원(Gold/Gem)을 송금합니다.
 * @role 플레이어 간 거래 또는 지원 
 * @analysis 
 * - 받는 사람의 존재 여부를 먼저 확인합니다.
 * - 본인에게 송금하는 것을 방지하는 로직이 추가되어야 합니다.
 */
app.post('/api/resources/transfer', (req, res) => {
    const { senderId, receiverName, amount, resourceType } = req.body; // resourceType: 'gold' or 'gem'

    // 유효성 검사
    if (amount <= 0) return res.status(400).json({ error: 'Invalid amount' });
    if (!['gold', 'gem'].includes(resourceType)) return res.status(400).json({ error: 'Invalid resource type' });

    try {
        const receiver = db.prepare('SELECT id FROM users WHERE username = ?').get(receiverName);
        if (!receiver) return res.status(404).json({ error: 'Receiver not found' });

        // 본인 송금 체크 (추가 권장)
        // if (senderId == receiver.id) return res.status(400).json({ error: 'Cannot transfer to self' });

        const senderRes = db.prepare(`SELECT ${resourceType} FROM user_resources WHERE user_id = ?`).get(senderId);

        if (!senderRes || senderRes[resourceType] < amount) {
            return res.status(400).json({ error: 'Not enough funds' });
        }

        // 트랜잭션 송금
        const transferTx = db.transaction(() => {
            db.prepare(`UPDATE user_resources SET ${resourceType} = ${resourceType} - ? WHERE user_id = ?`).run(amount, senderId);
            db.prepare(`UPDATE user_resources SET ${resourceType} = ${resourceType} + ? WHERE user_id = ?`).run(amount, receiver.id);
        });

        transferTx();
        res.json({ success: true, message: `Transferred ${amount} ${resourceType} to ${receiverName}` });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Transfer failed' });
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



// Position Sync Endpoint
app.get('/api/game/position/:userId', (req, res) => {
    try {
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        // Check if movement complete
        if (user.arrival_time && new Date() >= new Date(user.arrival_time)) {
            // Movement complete - update position
            db.prepare(`
                UPDATE users 
                SET current_pos = destination_pos,
                    destination_pos = NULL,
                    arrival_time = NULL,
                    movement_path = NULL
                WHERE id = ?
            `).run(req.params.userId);

            const [lat, lng] = user.destination_pos.split(',').map(Number);
            return res.json({
                position: [lat, lng],
                isMoving: false,
                path: []
            });
        }

        // Still moving or Idle
        const currentPos = user.current_pos
            ? (user.current_pos.includes(',') ? user.current_pos.split(',') : user.current_pos.split('_')).map(Number)
            : [37.5665, 126.9780]; // Lat, Lng

        res.json({
            position: currentPos,
            isMoving: !!user.destination_pos,
            path: user.movement_path ? JSON.parse(user.movement_path) : [],
            arrivalTime: user.arrival_time,
            startPos: user.start_pos ? user.start_pos.split(',').map(Number) : currentPos,
            targetPos: user.destination_pos ? user.destination_pos.split(',').map(Number) : null
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// app.post('/api/map/move', ...); REMOVED

// ============================================
// 건설 및 영토 시스템 (Build & Territory System)
// ============================================

/**
 * @route POST /api/build
 * @description 건물을 건설하거나, 타 세력 영토인 경우 건설 요청(Request)을 생성합니다.
 * @param {string} user_id - 사용자 ID
 * @param {string} type - 건물 타입 코드 (예: COMMAND_CENTER, BARRACKS)
 * @param {number} x, y - 건설할 타일 좌표
 * @analysis 
 * - **영토 판정**: 모든 '영토 중심 건물(Command Center 등)'과의 거리를 계산하여 특정 영토 내부인지 확인합니다.
 * - **외교 로직**: 
 *   - 내 영토/중립 지역: 즉시 건설
 *   - 타 세력 영토: 
 *     - 적대(Hostile): 건설 불가(403)
 *     - 동맹(Alliance): 건설 요청 생성 -> 상대방 승인 필요
 * - **개선점**: 영토 판정 시 모든 건물을 순회(`O(N)`)하고 있어, 쿼드트리(QuadTree)나 공간 인덱싱(RTREE) 도입이 시급합니다.
 */
app.post('/api/build', (req, res) => {
    const { user_id, type, x, y, world_x, world_y } = req.body;
    const userId = user_id; // 변수명 통일

    // 1. 건물 타입 및 비용 검증
    const buildingType = db.prepare('SELECT * FROM building_types WHERE code = ?').get(type);
    if (!buildingType) {
        return res.status(400).json({ error: "Invalid Building Type - not found in building_types" });
    }

    const cost = JSON.parse(buildingType.construction_cost || '{}');
    if (!cost.gold) {
        return res.status(400).json({ error: "Building type has no defined construction cost" });
    }

    // buildingDefs는 클라이언트/서버 공유 상수지만, DB 조회가 더 정확합니다. (하위 호환성 유지)
    const def = buildingDefs[type] || { cost: cost, isTerritory: buildingType.is_territory_center };

    try {
        // 자원 확인
        const userRes = db.prepare('SELECT * FROM user_resources WHERE user_id = ?').get(userId);
        if (!userRes || userRes.gold < (cost.gold || 0) || userRes.gem < (cost.gem || 0)) {
            return res.status(400).json({ error: "Insufficient Resources" });
        }

        // 2. 영토 충돌 판정 (Territory Constraints)
        // 현재 맵 상의 모든 영토 중심점을 가져와 거리 계산 (비효율적, 최적화 필요)
        const territories = db.prepare(`
            SELECT ub.id, ub.user_id, ub.x, ub.y, ub.territory_radius, ub.is_territory_center, u.npc_type
            FROM user_buildings ub
            JOIN users u ON ub.user_id = u.id
            WHERE ub.is_territory_center = 1
        `).all();

        let insideTerritory = null;
        for (const t of territories) {
            // 유클리드 거리 근사치 (위경도 1도 ≈ 111km)
            const distDeg = Math.sqrt(Math.pow(t.x - x, 2) + Math.pow(t.y - y, 2));
            const distKm = distDeg * 111;

            if (distKm <= t.territory_radius) {
                insideTerritory = t;
                break; // 가장 먼저 발견된 영토에 속한 것으로 판정 (겹침 처리 미흡)
            }
        }

        // Case check:
        // 1. 공해(Neutral Land): 즉시 건설 가능
        // 2. 내 영토(Own Land): 즉시 건설 가능
        // 3. 타인 영토(Other Land): 외교 관계에 따라 처리
        if (insideTerritory && insideTerritory.user_id !== userId) {
            const ownerId = insideTerritory.user_id;

            // 세력(Faction) 관계 조회
            const requester = db.prepare('SELECT faction_id FROM users WHERE id = ?').get(userId);
            const owner = db.prepare('SELECT faction_id FROM users WHERE id = ?').get(ownerId);

            let relation = 0; // 0: Neutral

            if (requester.faction_id && owner.faction_id) {
                if (requester.faction_id === owner.faction_id) {
                    relation = 100; // 같은 세력 = 절대 동맹
                } else {
                    const diplo = db.prepare(`
                        SELECT stance FROM faction_diplomacy 
                        WHERE (faction_id_a = ? AND faction_id_b = ?) 
                           OR (faction_id_a = ? AND faction_id_b = ?)
                    `).get(requester.faction_id, owner.faction_id, owner.faction_id, requester.faction_id);
                    relation = diplo ? diplo.stance : 0;
                }
            }
            // faction_id가 없으면 무소속(Free) -> Neutral 취급

            console.log(`[Construction] User ${userId} trying to build on ${ownerId}'s land. Relation: ${relation}`);

            if (relation < -20) {
                return res.status(403).json({ error: 'Cannot build on hostile territory.' });
            } else if (relation >= 50) {
                // 동맹(Alliance): 건설 승인 요청(Request) 생성
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

        // 건설 실행 (내 영토 또는 중립 지역)
        db.transaction(() => {
            // 1. 자원 차감
            db.prepare('UPDATE user_resources SET gold = gold - ?, gem = gem - ? WHERE user_id = ?')
                .run(cost.gold || 0, cost.gem || 0, userId);

            // 2. 건물 레코드 생성
            const isTerritory = buildingType.is_territory_center === 1 ? 1 : 0;
            const radius = isTerritory ? buildingType.territory_radius : 0;

            db.prepare(`
                INSERT INTO user_buildings (user_id, type, x, y, world_x, world_y, is_territory_center, territory_radius, level)
                VALUES (?, ?, ?, ?, 0, 0, ?, ?, 1)
            `).run(userId, type, x, y, isTerritory, radius);
        })();

        res.json({ success: true, message: 'Building constructed.' });

    } catch (err) {
        console.error('Construction error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// 외교 및 건설 요청 승인 API (Diplomacy & Requests)
// ============================================

/**
 * @route GET /api/diplomacy/requests
 * @description 내 영토에 건설하려는 타인의 요청 목록을 조회합니다.
 */
app.get('/api/diplomacy/requests', (req, res) => {
    const { userId } = req.query;
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

/**
 * @route POST /api/diplomacy/requests/:requestId/approve
 * @description 건설 요청을 승인합니다. 승인 시점에 요청자의 자원을 차감하고 건물을 건설해줍니다.
 * @analysis 
 * - **중복 자원 체크**: 요청 시점에 자원이 있었더라도, 승인 시점에 없을 수 있으므로 다시 확인해야 합니다.
 * - **트랜잭션**: 자원 차감, 건물 생성, 요청 상태 변경이 모두 성공해야 하므로 트랜잭션 필수입니다.
 */
app.post('/api/diplomacy/requests/:requestId/approve', (req, res) => {
    const { requestId } = req.params;

    try {
        const request = db.prepare('SELECT * FROM construction_requests WHERE id = ?').get(requestId);
        if (!request || request.status !== 'PENDING') {
            return res.status(404).json({ error: 'Request not found or processed' });
        }

        const buildingType = db.prepare('SELECT * FROM building_types WHERE code = ?').get(request.building_type);
        if (!buildingType) {
            return res.status(404).json({ error: 'Building type not found in database' });
        }

        const cost = JSON.parse(buildingType.construction_cost || '{}');

        // 트랜잭션 실행
        const tx = db.transaction(() => {
            // 1. 요청자(Requester) 자원 재확인
            const resources = db.prepare('SELECT gold, gem FROM user_resources WHERE user_id = ?').get(request.requester_id);
            if (resources.gold < (cost.gold || 0) || resources.gem < (cost.gem || 0)) {
                throw new Error('Requester has insufficient funds');
            }

            // 2. 요청자 자원 차감
            db.prepare('UPDATE user_resources SET gold = gold - ?, gem = gem - ? WHERE user_id = ?')
                .run(cost.gold || 0, cost.gem || 0, request.requester_id);

            // 3. 건물 생성 (좌표는 요청 시 저장된 좌표 사용)
            db.prepare(`
                INSERT INTO user_buildings (user_id, type, x, y, world_x, world_y, is_territory_center, territory_radius, level)
                VALUES (?, ?, ?, ?, 0, 0, 0, 0, 1)
            `).run(request.requester_id, request.building_type, request.x, request.y);

            // 4. 요청 상태 완료 처리
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

/**
 * @route POST /api/diplomacy/requests/:requestId/reject
 * @description 건설 요청을 거절합니다.
 */
app.post('/api/diplomacy/requests/:requestId/reject', (req, res) => {
    const { requestId } = req.params;
    try {
        db.prepare("UPDATE construction_requests SET status = 'REJECTED' WHERE id = ?").run(requestId);
        res.json({ success: true, message: 'Request rejected.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// 자원 생산 API (Production APIs)
// ============================================

/**
 * @route GET /api/production/pending
 * @description 현재까지 누적된 생산 자원(수확 가능량)을 조회합니다 (미리보기).
 * @analysis 
 * - **방치형(Idle) 로직**: `last_collected_at`과 현재 시간의 차이(`diffMins`)를 계산하여 생산량을 산출합니다.
 * - DB를 업데이트하지 않고 계산 값만 반환합니다.
 */
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
            const diffMins = Math.floor(diffMs / 60000); // 분 단위

            if (diffMins > 0) {
                if (b.type === 'HOUSE') {
                    totalGold += 10 * diffMins;
                } else if (b.type === 'FACTORY') {
                    totalGold += 50 * diffMins;
                } else if (b.type === 'MINE') {
                    // 광산: 분당 1개의 철광석(IRON_ORE) 생산 (하드코딩됨, 추후 DB화 필요)
                    totalItems.push({ code: 'IRON_ORE', qty: 1 * diffMins });
                }
            }
        });

        // 동일 아이템 합치기
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

/**
 * @route POST /api/production/collect
 * @description 건물에 누적된 자원을 실제로 수확합니다.
 * @analysis 
 * - **중요**: 수확 후 `last_collected_at`을 현재 시간으로 갱신하여 중복 수확을 방지합니다.
 * - 트랜잭션으로 자원 지급과 시간 갱신을 묶어 처리합니다.
 */
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
                    // 수확 시간 갱신
                    db.prepare('UPDATE user_buildings SET last_collected_at = ? WHERE id = ?').run(nowStr, b.id);
                }
            });

            // 골드 지급
            if (totalGold > 0) {
                db.prepare('UPDATE user_resources SET gold = gold + ? WHERE user_id = ?').run(totalGold, user_id);
            }

            // 아이템 지급 (인벤토리)
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

// ============================================
// 관리자 도구 API (Admin Tools APIs)
// ============================================

/**
 * @route GET /api/admin/users
 * @description 모든 사용자 정보와 자원, 스탯을 조회합니다.
 * @priority High (보안 주의) - 민감한 사용자 정보를 모두 노출하므로 일반 유저 접근을 엄격히 차단해야 합니다.
 */
app.get('/api/admin/users', (req, res) => {
    res.set('Cache-Control', 'no-store');
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

/**
 * @route GET /api/admin/files
 * @description 데이터베이스(DB) 파일 목록을 조회합니다.
 * @analysis 
 * - **보안 취약점**: DB 파일 경로가 노출될 수 있습니다. 운영 환경에서는 비활성화해야 합니다.
 * - Docker 환경 변수 `DB_PATH`를 우선하여 경로를 찾습니다.
 */
app.get('/api/admin/files', (req, res) => {
    const dbDir = process.env.DB_PATH ? path.resolve(process.env.DB_PATH) : path.join(__dirname, '..', 'terra-data', 'db');
    console.log(`[DB Inspector] Looking for DB files in: ${dbDir}`);

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

// ... (DB Inspection APIs: Tables, Data, Update) ...
// 이 API들은 개발 및 디버깅 용도로, SQL 인젝션 및 데이터 무결성 훼손 위험이 매우 큽니다.
// 운영 배포 시에는 반드시 제거하거나 강력한 인증을 거쳐야 합니다. (이하 생략하지 않고 상세 주석 처리)

/**
 * @route GET /api/admin/db/:filename
 * @description 특정 DB 파일의 테이블 목록을 조회합니다.
 */
app.get('/api/admin/db/:filename', (req, res) => {
    // ... (본문 생략 없이 기존 코드 유지하되 주석만 추가)
    const dbDir = process.env.DB_PATH ? path.resolve(process.env.DB_PATH) : path.join(__dirname, '..', 'terra-data', 'db');
    const dbPath = path.join(dbDir, req.params.filename);
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

/**
 * @route GET /api/admin/db/:filename/:tableName
 * @description 특정 DB 파일의 특정 테이블 데이터를 조회합니다.
 */
app.get('/api/admin/db/:filename/:tableName', (req, res) => {
    const dbDir = process.env.DB_PATH ? path.resolve(process.env.DB_PATH) : path.join(__dirname, '..', 'terra-data', 'db');
    const dbPath = path.join(dbDir, req.params.filename);
    if (!fs.existsSync(dbPath)) return res.status(404).json({ error: 'File not found' });

    try {
        const tempDb = new db.constructor(dbPath);
        const data = tempDb.prepare(`SELECT * FROM ${req.params.tableName} LIMIT 100`).all();
        tempDb.close();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route PUT /api/admin/db/:filename/:tableName/:id
 * @description 특정 DB 파일의 테이블 데이터를 업데이트합니다.
 */
app.put('/api/admin/db/:filename/:tableName/:id', (req, res) => {
    const dbDir = process.env.DB_PATH ? path.resolve(process.env.DB_PATH) : path.join(__dirname, '..', 'terra-data', 'db');
    const dbPath = path.join(dbDir, req.params.filename);
    if (!fs.existsSync(dbPath)) return res.status(404).json({ error: 'File not found' });

    try {
        const tempDb = new db.constructor(dbPath);
        const updates = req.body;
        const keys = Object.keys(updates).filter(k => k !== 'id');
        const setClause = keys.map(k => `${k} = ?`).join(', ');
        const values = keys.map(k => updates[k]);
        tempDb.prepare(`UPDATE ${req.params.tableName} SET ${setClause} WHERE id = ?`).run(...values, req.params.id);
        tempDb.close();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ... (중략: 기타 Admin APIs) ...

/**
 * @route POST /api/admin/users/:id/update
 * @description 관리자 권한으로 특정 사용자의 자원이나 스탯을 강제로 수정합니다.
 * @param {string} id - 대상 사용자 ID
 * @param {Object} body - 변경할 수치들 (gold, gem, strength 등)
 */
app.post('/api/admin/users/:id/update', (req, res) => {
    const userId = req.params.id;
    const { gold, gem, strength, dexterity, constitution, intelligence, wisdom, agility } = req.body;

    try {
        const tx = db.transaction(() => {
            if (gold !== undefined || gem !== undefined) {
                // COALESCE를 사용하여 값이 주어지지 않은 필드는 기존 값을 유지합니다.
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

// Force Seed Planning Data (Emergency Fix)
app.post('/api/admin/force-seed-planning', (req, res) => {
    try {
        const defaultCats = [
            { id: 'ADMIN', label: 'Admin Tools', color: '#ef4444' },
            { id: 'ECONOMY', label: 'Economy', color: '#f97316' },
            { id: 'ITEM', label: 'Items & Inv', color: '#eab308' },
            { id: 'MAP', label: 'Map & World', color: '#22c55e' },
            { id: 'SERVER', label: 'Server/DB', color: '#06b6d4' },
            { id: 'USER', label: 'Users', color: '#3b82f6' },
            { id: 'CHARACTER', label: 'Character', color: '#a855f7' },
            { id: 'SETTINGS', label: 'Settings', color: '#64748b' }
        ];

        const stmt = db.prepare(`
            INSERT INTO admin_categories (id, label, color)
            VALUES (?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
            label = excluded.label,
            color = excluded.color
        `);

        const tx = db.transaction((cats) => {
            for (const c of cats) {
                stmt.run(c.id, c.label, c.color);
            }
        });

        tx(defaultCats);
        console.log("[Admin] Force seeded planning categories.");
        res.json({ success: true, message: "Planning categories seeded." });
    } catch (err) {
        console.error("Force seed failed:", err);
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
// 게임 상태 & 건설 배치 API (Game State & Tech Tree APIs)
// ============================================

/**
 * @route GET /api/game/state
 * @description 클라이언트의 주기적 폴링에 대응하여, 현재 플레이어의 위치와 소유 건물 목록을 반환합니다.
 * @param {string} userId - 사용자 ID
 * @analysis 
 * - **위치 동기화**: `users.current_pos`를 반환하되, 만약 위치가 초기값('10_10' 등)이거나 유효하지 않다면 본부(HQ) 위치로 강제 보정(Fallback)합니다.
 * - Leaflet 지도 상에 건물을 렌더링하기 위한 핵심 API입니다.
 */
app.get('/api/game/state', (req, res) => {
    const { userId } = req.query;

    if (!userId) {
        return res.status(400).json({ error: 'User ID required' });
    }

    try {
        // 1. 플레이어 위치 조회
        const user = db.prepare('SELECT current_pos FROM users WHERE id = ?').get(userId);
        let playerPosition = null;

        if (user && user.current_pos && user.current_pos !== '10_10') {
            const [x, y] = user.current_pos.split('_').map(Number);
            playerPosition = { x, y };
        } else {
            // 위치 정보가 없거나 잘못된 경우: HQ(Command Center)를 찾아 그 위치로 리셋
            const hq = db.prepare("SELECT x, y FROM user_buildings WHERE user_id = ? AND type = 'COMMAND_CENTER'").get(userId);
            if (hq) {
                playerPosition = { x: hq.x, y: hq.y };
                db.prepare("UPDATE users SET current_pos = ? WHERE id = ?").run(`${hq.x}_${hq.y}`, userId);
                console.log(`[GameState] Defaulted user ${userId} to HQ at ${hq.x}, ${hq.y}`);
            } else {
                // HQ도 없으면: 아무 건물이나 하나 잡아서 위치 설정
                const anyBldg = db.prepare("SELECT x, y FROM user_buildings WHERE user_id = ? LIMIT 1").get(userId);
                if (anyBldg) {
                    playerPosition = { x: anyBldg.x, y: anyBldg.y };
                    db.prepare("UPDATE users SET current_pos = ? WHERE id = ?").run(`${anyBldg.x}_${anyBldg.y}`, userId);
                    console.log(`[GameState] Defaulted user ${userId} to Building at ${anyBldg.x}, ${anyBldg.y}`);
                }
            }
        }

        // 2. 사용자 소유 건물 목록 조회
        const buildings = db.prepare(`
            SELECT ub.id, ub.type, ub.x, ub.y, ub.level, ub.user_id, ub.created_at, u.username as owner_name
            FROM user_buildings ub
            LEFT JOIN users u ON ub.user_id = u.id
            WHERE ub.user_id = ?
        `).all(userId);

        res.json({
            playerPosition,
            buildings: buildings.map(b => ({
                id: b.id,
                type: b.type.toLowerCase(), // 클라이언트 호환성을 위해 소문자 변환 (예: HOUSE -> house)
                x: b.x,
                y: b.y,
                level: b.level || 1,
                user_id: b.user_id,
                owner_name: b.owner_name,
                created_at: b.created_at
            }))
        });
    } catch (err) {
        console.error('Game state error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route POST /api/game/build
 * @description 게임 맵(Game Map) 상에 건물을 배치합니다. (Tech Tree 검증 포함)
 * @analysis 
 * - **테크 트리(Tech Tree)**: 상위 건물(Factory 등)을 짓기 위해 특정 건물(Command Center Lv.2 등)이 필요한지 검사합니다.
 * - **건설 제한**: 사령부(COMMANDER/COMMAND_CENTER)는 1개만 지을 수 있도록 제한합니다. (현재 코드상 타입 문자열 혼동이 있어 통일 필요: COMMANDER vs COMMAND_CENTER)
 */
app.post('/api/game/build', (req, res) => {
    const { userId, type, x, y } = req.body;

    if (!userId || !type) {
        return res.status(400).json({ error: 'User ID and building type required' });
    }

    try {
        const buildingType = type.toUpperCase();

        // 1. 테크 트리(Tech Tree) 검증
        if (buildingType === 'FACTORY') {
            // 예: Factory를 지으려면 Command Center 레벨 2 이상 필요
            // FIXME: DB에는 'COMMAND_CENTER'로 저장되는데 코드에선 'COMMANDER'를 조회하고 있음. 확인 필요.
            const commandCenter = db.prepare(`
                SELECT level FROM user_buildings 
                WHERE user_id = ? AND type = 'COMMAND_CENTER'
            `).get(userId);

            if (!commandCenter) {
                return res.status(400).json({ error: 'Requires Command Center to build Factory' });
            }
            if (commandCenter.level < 2) {
                return res.status(400).json({ error: 'Command Center Level 2 required for Factory' });
            }
        }

        // 2. 개수 제한 (Limit Checks)
        if (buildingType === 'COMMAND_CENTER') {
            const existing = db.prepare(`SELECT id FROM user_buildings WHERE user_id = ? AND type = 'COMMAND_CENTER'`).get(userId);
            if (existing) {
                return res.status(400).json({ error: 'You can only have one Command Center' });
            }
        }

        // 3. 건물 생성
        // world_x, world_y는 0으로 고정 (게임 맵 좌표계 사용)
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
    const { tileId } = req.params;

    // Check if tile exists (Legacy check, we now generate dynamic ocean)
    // const tile = db.prepare('SELECT * FROM world_map WHERE id = ?').get(tileId);

    // Dynamic Tile Generation for "Ocean"
    // We assume everything is ocean unless it has specific data (which we don't have for full map yet)
    // So we just return coordinate info.

    const parts = tileId.split('_');
    const x = parseInt(parts[0]);
    const y = parseInt(parts[1]);

    const tileData = {
        id: tileId,
        x: isNaN(x) ? 0 : x,
        y: isNaN(y) ? 0 : y,
        type: 'OCEAN', // Default
        name: null,
        owner_id: null,
        faction: null
    };

    // Check for buildings on this tile
    const buildings = db.prepare('SELECT * FROM user_buildings WHERE x = ? AND y = ?').all(x, y); // Note: user_buildings uses x,y not tileId string in this schema? Checking schema...
    // Schema check: user_buildings has x, y.

    res.json({ tile: tileData, buildings });
});

// Get user owned tiles (Deprecated - world_map removed)
app.get('/api/tiles/user/:userId', (req, res) => {
    res.json({ tiles: [] });
});

// Get all territories (Command Centers)
app.get('/api/territories', (req, res) => {
    try {
        let sql = `
            SELECT ub.id, ub.user_id, ub.x, ub.y, ub.territory_radius, ub.is_territory_center, ub.custom_boundary, ub.level, ub.type, ub.building_type_code,
                   u.username as owner_name, f.name as faction_name, f.type as npc_type, f.color, f.id as faction_id
            FROM user_buildings ub
            LEFT JOIN users u ON ub.user_id = u.id
            LEFT JOIN factions f ON u.faction_id = f.id
            WHERE ub.is_territory_center = 1
        `;

        const { lat, lng, radius } = req.query;
        let params = [];

        // Spatial Optimization (Simple Bounding Box)
        if (lat && lng) {
            const range = parseFloat(radius) || 50; // Default 50km
            // 1 degree lat ~= 111km
            const dLat = range / 111;
            // 1 degree lng ~= 111km * cos(lat)
            const dLng = range / (111 * Math.cos(parseFloat(lat) * Math.PI / 180));

            sql += ` AND ub.x BETWEEN ? AND ? AND ub.y BETWEEN ? AND ?`;
            params.push(parseFloat(lat) - dLat, parseFloat(lat) + dLat, parseFloat(lng) - Math.abs(dLng), parseFloat(lng) + Math.abs(dLng));
            // console.log(`[Territory] Spatial Query: Lat ${lat} Lng ${lng} Range ${range}km`);
        }

        const territories = db.prepare(sql).all(...params);

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

// Get NPC Cyborg Positions
app.get('/api/npcs', (req, res) => {
    try {
        const { lat, lng, radius } = req.query;

        let sql = `
            SELECT 
                cc.id as cyborg_id,
                cc.user_id,
                cc.name as cyborg_name,
                cc.level,
                cc.movement_speed,
                cc.vision_range,
                u.username,
                u.current_pos,
                u.destination_pos,
                u.start_pos,
                u.departure_time,
                u.arrival_time,
                u.npc_type,
                f.name as faction_name,
                f.color as faction_color,
                f.id as faction_id
            FROM character_cyborg cc
            JOIN users u ON cc.user_id = u.id
            LEFT JOIN factions f ON u.faction_id = f.id
            WHERE u.npc_type IN ('ABSOLUTE', 'FREE')
        `;

        const npcs = db.prepare(sql).all();

        // Parse GPS coordinates and filter by range if provided
        const enriched = npcs.map(npc => {
            // Parse current_pos (format: "lat_lng")
            let lat_pos = null;
            let lng_pos = null;

            if (npc.current_pos && npc.current_pos !== '10_10') {
                const parts = npc.current_pos.split('_');
                if (parts.length === 2) {
                    lat_pos = parseFloat(parts[0]);
                    lng_pos = parseFloat(parts[1]);
                }
            }

            // Parse start_pos
            let start_lat = null;
            let start_lng = null;
            if (npc.start_pos) {
                const parts = npc.start_pos.split('_');
                if (parts.length === 2) {
                    start_lat = parseFloat(parts[0]);
                    start_lng = parseFloat(parts[1]);
                }
            }

            // Parse destination if moving
            let dest_lat = null;
            let dest_lng = null;
            if (npc.destination_pos) {
                const dest_parts = npc.destination_pos.split('_');
                if (dest_parts.length === 2) {
                    dest_lat = parseFloat(dest_parts[0]);
                    dest_lng = parseFloat(dest_parts[1]);
                }
            }

            return {
                cyborg_id: npc.cyborg_id,
                user_id: npc.user_id,
                cyborg_name: npc.cyborg_name,
                level: npc.level,
                movement_speed: npc.movement_speed,
                vision_range: npc.vision_range,
                username: npc.username,
                lat: lat_pos,
                lng: lng_pos,
                destination: dest_lat && dest_lng ? { lat: dest_lat, lng: dest_lng } : null,
                start_pos: start_lat && start_lng ? { lat: start_lat, lng: start_lng } : null,
                departure_time: npc.departure_time,
                arrival_time: npc.arrival_time,
                npc_type: npc.npc_type,
                faction_name: npc.faction_name,
                faction_color: npc.faction_color || '#CCCCCC',
                faction_id: npc.faction_id
            };
        }).filter(npc => npc.lat !== null && npc.lng !== null); // Only return NPCs with valid GPS

        // Spatial filtering if lat/lng/radius provided
        if (lat && lng && radius) {
            const centerLat = parseFloat(lat);
            const centerLng = parseFloat(lng);
            const rangeKm = parseFloat(radius);

            const filtered = enriched.filter(npc => {
                const dist = getDistanceFromLatLonInKm(npc.lat, npc.lng, centerLat, centerLng);
                return dist <= rangeKm;
            });

            res.json({ npcs: filtered, total: enriched.length, filtered: filtered.length });
        } else {
            res.json({ npcs: enriched, total: enriched.length });
        }

    } catch (err) {
        console.error('Get NPCs error:', err);
        res.status(500).json({ error: err.message });
    }
});

// API: Update NPC Stats
app.post('/api/admin/npc/:id/update-stats', (req, res) => {
    const { id } = req.params;
    const { movement_speed, vision_range } = req.body;

    try {
        const check = db.prepare('SELECT id FROM character_cyborg WHERE user_id = ?').get(id);
        if (check) {
            db.prepare(`
                UPDATE character_cyborg 
                SET movement_speed = ?, vision_range = ? 
                WHERE user_id = ?
            `).run(movement_speed, vision_range, id);
        } else {
            // If missing, create minimal entry
            // Need name from users table to be safe, or just default
            const user = db.prepare('SELECT username FROM users WHERE id = ?').get(id);
            const name = user ? user.username : 'Cyborg';

            db.prepare(`
                INSERT INTO character_cyborg (user_id, name, movement_speed, vision_range, level, current_hp, max_hp, strength, dexterity, constitution, intelligence)
                VALUES (?, ?, ?, ?, 1, 100, 100, 10, 10, 10, 10)
            `).run(id, name, movement_speed, vision_range);
        }

        res.json({ success: true });
    } catch (err) {
        console.error('Update Stats Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// API: Command NPC
app.post('/api/admin/npc/:id/command', (req, res) => {
    const { id } = req.params;
    const { command } = req.body; // 'PATROL', 'EXPAND', 'STOP', 'RETURN'

    try {
        const npc = db.prepare("SELECT u.id, f.name as faction_name FROM users u JOIN factions f ON u.faction_id = f.id WHERE u.id = ?").get(id);
        if (!npc) return res.status(404).json({ error: 'NPC not found' });

        // Log command
        db.prepare(`
            INSERT INTO npc_action_logs (npc_id, faction_name, action_type, details)
            VALUES (?, ?, 'COMMAND', ?)
        `).run(id, npc.faction_name, `Manual Command: ${command}`);

        // Logic to force interrupt current action
        if (command === 'STOP') {
            db.prepare(`
                UPDATE users 
                SET destination_pos = NULL, start_pos = NULL, departure_time = NULL, arrival_time = NULL 
                WHERE id = ?
            `).run(id);
        } else if (command === 'RETURN' || command === 'PATROL') {
            // 1. Get Base Location (Command Center)
            const base = db.prepare(`
                SELECT x, y FROM user_buildings 
                WHERE user_id = ? AND type = 'COMMAND_CENTER' 
                LIMIT 1
            `).get(id);

            if (base) {
                // 2. Get Speed
                const cyborg = db.prepare('SELECT movement_speed FROM character_cyborg WHERE user_id = ?').get(id);
                const speedKmh = (cyborg && cyborg.movement_speed) ? cyborg.movement_speed : 180;
                const speedKms = speedKmh / 3600;

                // 3. Determine Target
                let targetLat = base.x;
                let targetLng = base.y;

                if (command === 'PATROL') {
                    // Random point within 20km
                    const r = 20.0;
                    const angle = Math.random() * 2 * Math.PI;
                    const dist = Math.random() * r;
                    targetLat += (dist * Math.cos(angle)) / 111;
                    targetLng += (dist * Math.sin(angle)) / (111 * Math.cos(base.x * Math.PI / 180));
                }

                // 4. Calculate Time
                const user = db.prepare('SELECT current_pos FROM users WHERE id = ?').get(id);
                const currentPos = user.current_pos ? user.current_pos.split('_').map(Number) : [base.x, base.y];
                const distanceKm = getDistanceFromLatLonInKm(currentPos[0], currentPos[1], targetLat, targetLng);

                let travelTimeSec = distanceKm / speedKms;
                if (travelTimeSec < 1) travelTimeSec = 1;

                const arrivalTime = new Date(Date.now() + travelTimeSec * 1000);

                // 5. Update Movement
                db.prepare(`
                    UPDATE users 
                    SET start_pos = ?, destination_pos = ?, departure_time = ?, arrival_time = ? 
                    WHERE id = ?
                `).run(
                    `${currentPos[0]}_${currentPos[1]}`,
                    `${targetLat}_${targetLng}`,
                    new Date().toISOString(),
                    arrivalTime.toISOString(),
                    id
                );
            }
        }

        res.json({ success: true, message: `Command ${command} sent` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Helper function for distance calculation (add if not exists)
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    var R = 6371; // Radius of the earth in km
    var dLat = deg2rad(lat2 - lat1);
    var dLon = deg2rad(lon2 - lon1);
    var a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = R * c; // Distance in km
    return d;
}

function deg2rad(deg) {
    return deg * (Math.PI / 180);
}

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
        // Add Cyborg Model
        const cyborgModel = 'EXPLORER';
        const userInfo = db.prepare('INSERT INTO users (username, password, npc_type, personality, tech_focus, faction_id, faction_rank, cyborg_model) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
            .run(username, 'npc_password', 'FREE', 'Aggressive', 'Military', factionId, 2, cyborgModel);
        const userId = userInfo.lastInsertRowid;

        // Link User to Faction Leader
        db.prepare('UPDATE factions SET leader_id = ? WHERE id = ?').run(userId, factionId);

        // Give Resources (Increased from 5000 to 50000)
        db.prepare('INSERT INTO user_resources (user_id, gold, gem) VALUES (?, ?, ?)').run(userId, 3000, 100);

        // 2.5 Generate Random Stats & Create Cyborg
        const randStat = () => Math.floor(Math.random() * 10) + 8; // 8-18 range
        const stats = {
            strength: randStat(),
            dexterity: randStat(),
            constitution: randStat(),
            intelligence: randStat(),
            wisdom: randStat(),
            agility: randStat()
        };

        // Insert Stats
        try {
            db.prepare(`
                INSERT INTO user_stats (user_id, strength, dexterity, constitution, intelligence, wisdom, agility)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(userId, stats.strength, stats.dexterity, stats.constitution, stats.intelligence, stats.wisdom, stats.agility);
        } catch (e) {
            console.warn('Could not insert user_stats for Free NPC:', e.message);
        }

        // Create Cyborg Character
        const hp = (stats.constitution * 10) + (stats.strength * 5);
        const mp = (stats.wisdom * 8) + (stats.intelligence * 6);
        const displayName = name + ' Leader';

        try {
            db.prepare(`
                INSERT INTO character_cyborg (user_id, name, strength, dexterity, constitution, intelligence, wisdom, agility, hp, mp)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(userId, displayName, stats.strength, stats.dexterity, stats.constitution, stats.intelligence, stats.wisdom, stats.agility, hp, mp);
        } catch (e) {
            console.warn('Could not insert character_cyborg for Free NPC:', e.message);
        }

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
            // Calculate world grid from real coords
            worldX = Math.round((spawnX - 36.0) / 0.1);
            worldY = Math.round((spawnY - 127.0) / 0.1);
        }

        // 4. Create COMMAND_CENTER (get radius from building_types)
        const ccType = db.prepare('SELECT territory_radius FROM building_types WHERE code = ?').get('COMMAND_CENTER');
        const ccRadius = ccType ? ccType.territory_radius : 3.0;

        db.prepare(`
            INSERT INTO user_buildings (user_id, type, x, y, world_x, world_y, is_territory_center, territory_radius, level)
            VALUES (?, 'COMMAND_CENTER', ?, ?, ?, ?, 1, ?, 1)
        `).run(userId, spawnX, spawnY, worldX, worldY, ccRadius);

        // 5. Create Cyborg Character
        db.prepare(`
            INSERT INTO character_cyborg (user_id, name, level, strength, dexterity, constitution, agility, intelligence, wisdom, hp, mp)
            VALUES (?, ?, 1, 15, 15, 15, 15, 15, 15, 225, 210)
        `).run(userId, `${name} Commander`);

        // 6. Set initial GPS position
        db.prepare('UPDATE users SET current_pos = ? WHERE id = ?')
            .run(`${spawnX}_${spawnY}`, userId);

        console.log(`[Admin] Spawned Free NPC: ${name} at ${spawnX.toFixed(4)}, ${spawnY.toFixed(4)} with cyborg commander`);

        res.json({
            success: true,
            message: `Spawned ${name} at ${spawnX.toFixed(4)}, ${spawnY.toFixed(4)} with Command Center and Cyborg Commander`,
            factionId,
            userId,
            coordinates: { lat: spawnX, lng: spawnY }
        });

    } catch (err) {
        console.error('Spawn NPC Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Build (Construct Building)
// Get all building types (Public for construction menu)
app.get('/api/buildings/types', (req, res) => {
    try {
        const types = db.prepare('SELECT * FROM building_types ORDER BY tier ASC, construction_cost ASC').all();

        // Parse JSON fields
        const parsedTypes = types.map(t => ({
            ...t,
            construction_cost: JSON.parse(t.construction_cost || '{}'),
            maintenance_cost: JSON.parse(t.maintenance_cost || '{}'),
            prerequisites: JSON.parse(t.prerequisites || '[]')
        }));

        res.json({ types: parsedTypes });
    } catch (err) {
        console.error('Get building types error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/buildings/construct', (req, res) => {
    const { userId, type, x, y, tileId } = req.body; // x, y are Lat/Lng or generic coords
    console.log(`[Construction] Request: User=${userId}, Type=${type}, Pos=(${x}, ${y})`);

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
            // 사령부(COMMAND_CENTER)는 절대 영역 - 다른 사령부로부터 5km 이내 건설 불가
            if (type.toUpperCase() === 'COMMAND_CENTER') {
                const existingCommandCenters = db.prepare(`
                    SELECT x, y, user_id FROM user_buildings 
                    WHERE (type = 'COMMAND_CENTER' OR building_type_code = 'COMMAND_CENTER')
                    AND user_id != ?
                `).all(userId);

                for (const center of existingCommandCenters) {
                    const dist = getDistanceFromLatLonInKm(x, y, center.x, center.y);
                    if (dist < 5.0) {
                        return res.status(400).json({
                            error: `다른 사용자의 사령부로부터 5km 이내에는 사령부를 건설할 수 없습니다. 현재 거리: ${dist.toFixed(2)}km`
                        });
                    }
                }
            } else {
                // 비콘(AREA_BEACON) 등 기타 영토 건물 - 기존 3km 제한
                const existingCenters = db.prepare('SELECT x, y FROM user_buildings WHERE is_territory_center = 1').all();
                for (const center of existingCenters) {
                    const dist = getDistanceFromLatLonInKm(x, y, center.x, center.y);
                    if (dist < 3.0) {
                        return res.status(400).json({ error: `Too close to another territory! Minimum distance is 3km. Current: ${dist.toFixed(2)}km` });
                    }
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
                is_territory_center, territory_radius, hp
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(userId, type, buildingType.code, x, y, gridX, gridY, isTerritoryCenter, radius, buildingType.max_hp || 100);

        const newBuilding = db.prepare('SELECT * FROM user_buildings WHERE id = ?').get(result.lastInsertRowid);

        // 8. Initialize Internal Map Layout if applicable
        if (buildingType.internal_map_size) {
            try {
                db.prepare('INSERT INTO internal_building_layouts (user_building_id, layout_data) VALUES (?, ?)').run(newBuilding.id, '[]');
                console.log(`[Internal Map] Initialized for building ${newBuilding.id} (Size: ${buildingType.internal_map_size})`);
            } catch (e) {
                console.error(`[Internal Map] Failed to initialize layout for ${newBuilding.id}:`, e);
            }
        }

        res.json({
            success: true,
            building: newBuilding,
            message: `Construction complete. Costs: ${deductions.join(', ')}`,
            buildingInfo: {
                name: buildingType.name,
                description: buildingType.description,
                tier: buildingType.tier,
                internal_map_size: buildingType.internal_map_size
            }
        });

    } catch (err) {
        console.error('Construction error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Get Internal Map Data
app.get('/api/internal-map/:userBuildingId', (req, res) => {
    try {
        const { userBuildingId } = req.params;

        // Fetch Building Info first to check eligibility
        const building = db.prepare('SELECT type, building_type_code FROM user_buildings WHERE id = ?').get(userBuildingId);
        if (!building) {
            return res.status(404).json({ error: 'Building not found' });
        }

        const typeCode = building.building_type_code || building.type;
        const buildingType = db.prepare('SELECT internal_map_size FROM building_types WHERE code = ?').get(typeCode);

        // Fetch layout
        let layout = db.prepare('SELECT * FROM internal_building_layouts WHERE user_building_id = ?').get(userBuildingId);

        // Auto-initialize if missing but eligible (Lazy Load for existing buildings)
        if (!layout && buildingType && buildingType.internal_map_size) {
            try {
                db.prepare('INSERT INTO internal_building_layouts (user_building_id, layout_data) VALUES (?, ?)').run(userBuildingId, '[]');
                layout = { layout_data: '[]' };
                console.log(`[Internal Map] Lazy initialized for building ${userBuildingId}`);
            } catch (e) {
                console.error("Auto-init internal map failed:", e);
            }
        }

        if (!layout) {
            if (buildingType && buildingType.internal_map_size) {
                return res.status(500).json({ error: 'Failed to initialize internal map' });
            }
            return res.status(404).json({ error: 'This building does not support an internal map' });
        }

        res.json({
            userBuildingId,
            layout: JSON.parse(layout.layout_data || '[]'),
            size: buildingType ? buildingType.internal_map_size : 15
        });

    } catch (err) {
        console.error('Get internal map error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Save Internal Map Layout
app.post('/api/internal-map/:userBuildingId', (req, res) => {
    try {
        const { userBuildingId } = req.params;
        const { layout } = req.body;

        if (!layout) return res.status(400).json({ error: 'Layout data required' });

        db.prepare('UPDATE internal_building_layouts SET layout_data = ?, updated_at = CURRENT_TIMESTAMP WHERE user_building_id = ?')
            .run(JSON.stringify(layout), userBuildingId);

        res.json({ success: true });
    } catch (err) {
        console.error('Save internal map error:', err);
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
/* DUPLICATE ROUTE - COMMENTED OUT 
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
*/

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
    res.set('Cache-Control', 'no-store');
    try {
        // Fix: Group By user.id to prevent duplicates when NPC has multiple territories
        const npcs = db.prepare(`
            SELECT u.id, u.username, u.npc_type, u.cyborg_model,
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
/**
 * @route POST /api/admin/seed-factions
 * @description 게임 내 주요 NPC 세력(Faction)과 그들의 수도(Capital), 지도자(Leader)를 초기화합니다.
 * @analysis
 * - **팩션 데이터 하드코딩**: 주요 7개 세력(Empire, ROK, Japan, Dragon, US, EU, Slavic)의 데이터가 코드 내에 정의되어 있습니다. 추후 DB나 설정 파일로 분리하는 것이 좋습니다.
 * - **수도 배치**: 각 세력의 수도를 실제 위도/경도(Lat/Lng) 기반으로 배치합니다. (예: 서울, 도쿄, 워싱턴 등)
 * - **초기화 로직**: 
 *   1. 사용자(User) 생성 (시스템 NPC 계정)
 *   2. 팩션(Faction) 생성 및 리더 연결
 *   3. 자원(Resource) 및 스탯(Stats) 지급
 *   4. 사이보그(Cyborg) 지휘관 생성
 *   5. 수도 건물(Command Center) 건설 및 영토 설정 (서울의 경우 특별한 8각형 경계 사용)
 */
app.post('/api/admin/seed-factions', (req, res) => {
    try {
        console.log('Seeding NPC Factions via Admin API...');
        const factions = [
            { name: 'The Empire (NPC)', username: 'empire_npc', desc: 'Global Hegemony', color: '#FF0000', model: 'COMMANDER', stats: { strength: 20, dexterity: 15, constitution: 20, intelligence: 15, wisdom: 15, agility: 10 } },
            { name: 'Republic of Korea (NPC)', username: 'rok_npc', desc: 'Peninsula Defenders', color: '#0000FF', model: 'BUILDER', stats: { strength: 15, dexterity: 10, constitution: 20, intelligence: 15, wisdom: 10, agility: 10 } },
            { name: 'Neo Tokyo (NPC)', username: 'japan_npc', desc: 'Tech Giants', color: '#FFFF00', model: 'EXPLORER', stats: { strength: 10, dexterity: 20, constitution: 10, intelligence: 20, wisdom: 15, agility: 15 } },
            { name: 'Dragon Dynasty (NPC)', username: 'china_npc', desc: 'Eastern Power', color: '#FF0000', model: 'COMMANDER', stats: { strength: 18, dexterity: 12, constitution: 18, intelligence: 12, wisdom: 12, agility: 12 } },
            { name: 'Liberty Union (NPC)', username: 'usa_npc', desc: 'Western Alliance', color: '#0000FF', model: 'COMMANDER', stats: { strength: 15, dexterity: 15, constitution: 15, intelligence: 15, wisdom: 15, agility: 15 } },
            { name: 'European Federation (NPC)', username: 'eu_npc', desc: 'Old World Coalition', color: '#00FF00', model: 'EXPLORER', stats: { strength: 12, dexterity: 12, constitution: 12, intelligence: 18, wisdom: 18, agility: 12 } },
            { name: 'Slavic Bloc (NPC)', username: 'ru_npc', desc: 'Northern Bears', color: '#FF00FF', model: 'BUILDER', stats: { strength: 20, dexterity: 10, constitution: 20, intelligence: 10, wisdom: 10, agility: 10 } }
        ];

        const capitals = [
            { faction: 'rok_npc', name: 'Seoul Command', x: 37.5665, y: 126.9780, radius: 25.0 },
            { faction: 'japan_npc', name: 'Tokyo Fortress', x: 35.6762, y: 139.6503, radius: 25.0 },
            { faction: 'china_npc', name: 'Beijing Citadel', x: 39.9042, y: 116.4074, radius: 30.0 },
            { faction: 'usa_npc', name: 'Washington HQ', x: 38.9072, y: -77.0369, radius: 30.0 },
            { faction: 'eu_npc', name: 'London Beacon', x: 51.5074, y: -0.1278, radius: 15.0 },
            { faction: 'eu_npc', name: 'Paris Bastion', x: 48.8566, y: 2.3522, radius: 15.0 },
            { faction: 'eu_npc', name: 'Berlin Bunker', x: 52.5200, y: 13.4050, radius: 15.0 },
            { faction: 'ru_npc', name: 'Moscow Kremlin', x: 55.7558, y: 37.6173, radius: 30.0 },
            { faction: 'empire_npc', name: 'Antarctica Base', x: -82.8628, y: 135.0000, radius: 50.0 }
        ];

        db.transaction(() => {
            // 1. Update/Create Users with NPC Type, Model, and Stats
            for (const f of factions) {
                let user = db.prepare('SELECT id FROM users WHERE username = ?').get(f.username);
                if (!user) {
                    const info = db.prepare('INSERT INTO users (username, password, npc_type, cyborg_model) VALUES (?, ?, ?, ?)')
                        .run(f.username, 'npc_password', 'ABSOLUTE', f.model);
                    user = { id: info.lastInsertRowid };
                    db.prepare('INSERT INTO user_resources (user_id, gold, gem) VALUES (?, ?, ?)').run(user.id, 999999, 999999);
                } else {
                    db.prepare('UPDATE users SET npc_type = \'ABSOLUTE\', cyborg_model = ? WHERE id = ?').run(f.model, user.id);
                }

                // Update/Create Faction in 'factions' table & Link User
                let factionEntry = db.prepare('SELECT id FROM factions WHERE name = ?').get(f.name);
                if (!factionEntry) {
                    const fInfo = db.prepare('INSERT INTO factions (name, description, color, type, leader_id) VALUES (?, ?, ?, ?, ?)')
                        .run(f.name, f.desc, f.color, 'ABSOLUTE', user.id);
                    factionEntry = { id: fInfo.lastInsertRowid };
                } else {
                    db.prepare('UPDATE factions SET leader_id = ?, color = ?, description = ?, type = ? WHERE id = ?')
                        .run(user.id, f.color, f.desc, 'ABSOLUTE', factionEntry.id);
                }
                // Link User to Faction (Rank 2 = Leader) - Critical for AI
                db.prepare('UPDATE users SET faction_id = ?, faction_rank = 2 WHERE id = ?').run(factionEntry.id, user.id);

                f.id = user.id;

                // Update/Insert Stats
                const statsExist = db.prepare('SELECT user_id FROM user_stats WHERE user_id = ?').get(user.id);
                if (statsExist) {
                    db.prepare(`
                        UPDATE user_stats 
                        SET strength = ?, dexterity = ?, constitution = ?, intelligence = ?, wisdom = ?, agility = ? 
                        WHERE user_id = ?
                    `).run(f.stats.strength, f.stats.dexterity, f.stats.constitution, f.stats.intelligence, f.stats.wisdom, f.stats.agility, user.id);
                } else {
                    // Check if user_stats table exists (it might be removed in some envs but UI relies on it)
                    try {
                        db.prepare(`
                            INSERT INTO user_stats (user_id, strength, dexterity, constitution, intelligence, wisdom, agility)
                            VALUES (?, ?, ?, ?, ?, ?, ?)
                        `).run(user.id, f.stats.strength, f.stats.dexterity, f.stats.constitution, f.stats.intelligence, f.stats.wisdom, f.stats.agility);
                    } catch (e) {
                        console.warn('Could not insert user_stats for NPC (maybe table missing):', e.message);
                    }
                }

                // Update/Insert Character Cyborg (For Active Admin API)
                const charExist = db.prepare('SELECT user_id FROM character_cyborg WHERE user_id = ?').get(user.id);
                // HP = con * 10 + str * 5, MP = wis * 8 + int * 6
                const hp = (f.stats.constitution * 10) + (f.stats.strength * 5);
                const mp = (f.stats.wisdom * 8) + (f.stats.intelligence * 6);

                // Generate distinct name based on faction
                const displayName = f.name.replace(' (NPC)', '');
                const cyborgName = `${displayName} Commander`;

                if (charExist) {
                    db.prepare(`
                        UPDATE character_cyborg 
                        SET name = ?, strength = ?, dexterity = ?, constitution = ?, intelligence = ?, wisdom = ?, agility = ?, hp = ?, mp = ?
                        WHERE user_id = ?
                    `).run(cyborgName, f.stats.strength, f.stats.dexterity, f.stats.constitution, f.stats.intelligence, f.stats.wisdom, f.stats.agility, hp, mp, user.id);
                } else {
                    try {
                        db.prepare(`
                            INSERT INTO character_cyborg (user_id, name, strength, dexterity, constitution, intelligence, wisdom, agility, hp, mp)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        `).run(user.id, cyborgName, f.stats.strength, f.stats.dexterity, f.stats.constitution, f.stats.intelligence, f.stats.wisdom, f.stats.agility, hp, mp);
                    } catch (e) {
                        console.warn('Could not insert character_cyborg for NPC:', e.message);
                    }
                }
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
                    // Also move the Cyborg to the capital
                    db.prepare('UPDATE users SET current_pos = ? WHERE id = ?').run(`${c.x}_${c.y}`, faction.id);
                } else {
                    if (boundary) {
                        updateBoundary.run(boundary, exists.id);
                    } else {
                        updateRadius.run(c.radius, exists.id);
                    }
                    // Reset Cyborg to capital
                    db.prepare('UPDATE users SET current_pos = ? WHERE id = ?').run(`${c.x}_${c.y}`, faction.id);
                }
            }
        })();

        res.json({ success: true, message: 'NPC Factions seeded successfully' });
    } catch (error) {
        console.error('\u001b[31m[SEED-FACTIONS ERROR]\u001b[0m', error);
        console.error('Stack:', error.stack);
        res.status(500).json({ success: false, error: 'Failed to seed factions', details: error.message });
    }
});

// =========================================
// MOVEMENT & PATHFINDING API
// =========================================

// =========================================
// MOVEMENT & PATHFINDING API
// =========================================

/**
 * @route POST /api/game/path
 * @description A* 알고리즘을 사용하여 목적지까지의 최단 경로를 계산합니다.
 * @analysis 
 * - **이동 불가능 지역**: 물(WATER)이나 타 세력 영토를 피해 경로를 생성합니다.
 * - **클라이언트 헬퍼**: 실제 이동 전에 경로를 시각화하거나 이동 가능성을 클라이언트가 미리 확인하는 용도로 사용됩니다.
 */
app.post('/api/game/path', async (req, res) => {
    const { startLat, startLng, endLat, endLng, waypoints } = req.body;

    console.log(`[PATH_REQ] Start: ${startLat},${startLng} -> End: ${endLat},${endLng} | Waypoints: ${waypoints ? waypoints.length : 0}`);

    if (startLat === undefined || endLat === undefined) {
        return res.status(400).json({ error: 'Start and End coordinates required' });
    }

    try {
        const result = await pathfindingService.findPath(startLat, startLng, endLat, endLng, waypoints || [], req.body.userId);
        console.log(`[PATH_RES] Success: ${result.success}, Distance: ${result.distance}`);
        res.json(result);
    } catch (err) {
        console.error('Pathfinding error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route POST /api/game/move
 * @description 사용자를 특정 목적지로 이동시킵니다. (Pathfinding 검증 포함)
 * @analysis
 * - **서버 사이드 검증**: 클라이언트가 요청한 이동이 유효한지(갈 수 있는 곳인지) `pathfindingService`를 통해 재확인합니다.
 * - **도착 시간 계산**: 거리와 유저/관리자 속도를 기반으로 도착 예정 시간(ETA)을 계산하여 DB에 저장합니다. 
 * - **상태 업데이트**: `departure_time`, `arrival_time` 등을 갱신하여 클라이언트 애니메이션과 동기화합니다.
 */
app.post('/api/game/move', async (req, res) => {
    let { userId, x, y, path, targetLat, targetLng } = req.body;

    // Support alias
    if (x === undefined && targetLat !== undefined) x = targetLat;
    if (y === undefined && targetLng !== undefined) y = targetLng;

    console.log(`[MOVE_REQ] User: ${userId} -> Target: ${x}, ${y} | Path Nodes: ${path ? path.length : 'None'}`);

    if (!userId) return res.status(400).json({ error: 'Missing userId' });
    if (x === undefined) return res.status(400).json({ error: 'Missing x (targetLat)' });
    if (y === undefined) return res.status(400).json({ error: 'Missing y (targetLng)' });

    // if (!userId || x === undefined || y === undefined) {
    //    return res.status(400).json({ error: 'Invalid move request' });
    // }

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

        // --- NEW: Validate Path (Terrain & Territory) ---
        // We use the path array if provided, or just start/end if direct
        try {
            const validation = await pathfindingService.findPath(
                startLat, startLng,
                x, y,
                (path && Array.isArray(path)) ? path : [],
                userId // Pass userId for territory checks
            );
            if (!validation.success) {
                return res.status(400).json({ error: validation.error });
            }
        } catch (postMoveErr) {
            console.error("Path validation error during move:", postMoveErr);
            // Optional: Block move if validation fails? For now, we allow fallback or block.
            // Let's block to enforce rules.
            return res.status(500).json({ error: postMoveErr.message });
        }
        // ------------------------------------------------

        // 2. Determine Speed
        // Admin: 1 km/s (3600 km/h)
        // User: 0.1 km/s (360 km/h) -> 100m/s
        let speedKmPerSec = 0.1;
        if (user.role === 'admin') {
            speedKmPerSec = adminConfig.speed; // Use Dynamic Admin Config
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

        // Construct path if missing for animation
        const returnPath = (path && Array.isArray(path)) ? path : [
            { lat: startLat, lng: startLng },
            { lat: x, lng: y }
        ];

        res.json({
            success: true,
            message: `Moving to (${x}, ${y}). Arriving in ${durationSeconds.toFixed(1)}s`,
            arrivalTime: arrival.toISOString(), // Client expects arrivalTime (camelCase)
            startPos: [startLat, startLng],
            durationSeconds: durationSeconds,   // Client expects durationSeconds (camelCase)
            path: returnPath                    // Client expects path
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

// ========================================
// Admin: Building Management
// ========================================

/**
 * @route GET /api/admin/buildings
 * @description 필터링을 지원하는 관리자용 건물 목록 조회 API입니다.
 * @param {string} userId - 관리자 ID (1번)
 * @param {string} [ownerId] - 특정 소유자의 건물만 필터링
 * @param {string} [type] - 건물 타입 필터링
 * @param {boolean} [isTerritoryCenter] - 영토 중심 건물 여부 필터링
 */
app.get('/api/admin/buildings', (req, res) => {
    // ... (본문 생략 없이 유지)
    const { userId } = req.query;

    // Admin check
    if (String(userId) !== '1') {
        return res.status(403).json({ error: 'Admin only' });
    }

    try {
        const {
            ownerId,
            type,
            isTerritoryCenter,
            limit = 100,
            offset = 0
        } = req.query;

        let query = `
            SELECT ub.*, u.username as owner_name
            FROM user_buildings ub
            LEFT JOIN users u ON ub.user_id = u.id
            WHERE 1=1
        `;
        const params = [];

        if (ownerId) {
            query += ` AND ub.user_id = ?`;
            params.push(ownerId);
        }

        if (type) {
            query += ` AND (ub.type = ? OR ub.building_type_code = ?)`;
            params.push(type.toUpperCase(), type.toUpperCase());
        }

        if (isTerritoryCenter !== undefined) {
            query += ` AND ub.is_territory_center = ?`;
            params.push(isTerritoryCenter === 'true' ? 1 : 0);
        }

        query += ` ORDER BY ub.id DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const buildings = db.prepare(query).all(...params);

        // Get total count
        let countQuery = `
            SELECT COUNT(*) as total
            FROM user_buildings ub
            WHERE 1=1
        `;
        const countParams = [];

        if (ownerId) {
            countQuery += ` AND ub.user_id = ?`;
            countParams.push(ownerId);
        }

        if (type) {
            countQuery += ` AND (ub.type = ? OR ub.building_type_code = ?)`;
            countParams.push(type.toUpperCase(), type.toUpperCase());
        }

        if (isTerritoryCenter !== undefined) {
            countQuery += ` AND ub.is_territory_center = ?`;
            countParams.push(isTerritoryCenter === 'true' ? 1 : 0);
        }

        const { total } = db.prepare(countQuery).get(...countParams);

        res.json({
            buildings,
            total,
            limit: parseInt(limit),
            offset: parseInt(offset),
            hasMore: parseInt(offset) + buildings.length < total
        });
    } catch (error) {
        console.error('Error fetching buildings:', error);
        res.status(500).json({ error: 'Failed to fetch buildings' });
    }
});

// =========================================
// ADMIN CONFIG API
// =========================================
app.get('/api/admin/config', (req, res) => {
    res.json(adminConfig);
});

app.post('/api/admin/config', (req, res) => {
    const { speed, viewRange } = req.body;
    console.log(`[AdminConfig] Update Request:`, req.body);

    if (speed !== undefined) adminConfig.speed = parseFloat(speed);
    if (viewRange !== undefined) adminConfig.viewRange = parseFloat(viewRange);

    res.json({ success: true, config: adminConfig });
});

// PUT /api/admin/buildings/:buildingId - Update building
app.put('/api/admin/buildings/:buildingId', (req, res) => {
    const { userId } = req.query;
    const { buildingId } = req.params;

    // Admin check
    if (String(userId) !== '1') {
        return res.status(403).json({ error: 'Admin only' });
    }

    try {
        const { ownerId, x, y, territoryRadius, isTerritoryCenter } = req.body;

        // Build update query dynamically
        const updates = [];
        const params = [];

        if (ownerId !== undefined) {
            if (String(ownerId).trim() === '') {
                return res.status(400).json({ error: 'Owner ID cannot be empty' });
            }
            updates.push('user_id = ?');
            params.push(ownerId);
        }

        if (x !== undefined) {
            updates.push('x = ?');
            params.push(x);
        }

        if (y !== undefined) {
            updates.push('y = ?');
            params.push(y);
        }

        if (territoryRadius !== undefined) {
            updates.push('territory_radius = ?');
            params.push(territoryRadius);
        }

        if (isTerritoryCenter !== undefined) {
            updates.push('is_territory_center = ?');
            params.push(isTerritoryCenter ? 1 : 0);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        params.push(buildingId);

        const query = `UPDATE user_buildings SET ${updates.join(', ')} WHERE id = ?`;
        const result = db.prepare(query).run(...params);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Building not found' });
        }

        // Fetch updated building
        const building = db.prepare(`
            SELECT ub.*, u.username as owner_name
            FROM user_buildings ub
            LEFT JOIN users u ON ub.user_id = u.id
            WHERE ub.id = ?
        `).get(buildingId);

        console.log(`[Admin] Building ${buildingId} updated by admin`);

        res.json({
            success: true,
            building
        });
    } catch (error) {
        console.error('Error updating building:', error);
        res.status(500).json({ error: 'Failed to update building' });
    }
});

// DELETE /api/admin/buildings/:buildingId - Delete building
app.delete('/api/admin/buildings/:buildingId', (req, res) => {
    const { userId } = req.query;
    const { buildingId } = req.params;

    // Admin check
    if (String(userId) !== '1') {
        return res.status(403).json({ error: 'Admin only' });
    }

    try {
        const building = db.prepare('SELECT * FROM user_buildings WHERE id = ?').get(buildingId);

        if (!building) {
            return res.status(404).json({ error: 'Building not found' });
        }

        const result = db.prepare('DELETE FROM user_buildings WHERE id = ?').run(buildingId);

        console.log(`[Admin] Building ${buildingId} (${building.type}) deleted by admin`);

        res.json({
            success: true,
            deletedId: buildingId,
            building: building
        });
    } catch (error) {
        console.error('Error deleting building:', error);
        res.status(500).json({ error: 'Failed to delete building' });
    }
});

// GET /api/admin/users/list - Simple user list for dropdowns
app.get('/api/admin/users/list', (req, res) => {
    const { userId } = req.query;

    // Admin check
    if (String(userId) !== '1') {
        return res.status(403).json({ error: 'Admin only' });
    }

    try {
        const users = db.prepare(`
            SELECT id, username, faction_id
            FROM users
            ORDER BY id ASC
        `).all();

        res.json({ users });
    } catch (error) {
        console.error('Error fetching users list:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});


// Start Server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
