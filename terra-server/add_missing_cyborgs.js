/**
 * @file add_missing_cyborgs.js
 * @description 기존 NPC 사용자들에게 사이보그 캐릭터가 누락된 경우 생성해주는 마이그레이션 스크립트
 * @role 데이터 마이그레이션, 레거시 호환성 확보
 * @dependencies database.js
 * @status Maintenance (1회성 실행 권장)
 * 
 * @analysis
 * - NPC(ABSOLUTE, FREE) 중 `character_cyborg` 레코드가 없는 경우 기본 스탯으로 생성합니다.
 * - 또한 위치(GPS) 정보가 없으면 첫 번째 건물 위치로 동기화합니다.
 * - FREE NPC의 경우 자원 밸런싱(Gold 50,000)도 수행합니다.
 */

const db = require('./database');

console.log('=== Adding Cyborg Characters to Existing NPCs ===\n');

// Get all NPCs without cyborg characters
const npcsWithoutCyborg = db.prepare(`
    SELECT u.*, f.name as faction_name
    FROM users u
    LEFT JOIN character_cyborg cc ON u.id = cc.user_id
    LEFT JOIN factions f ON u.faction_id = f.id
    WHERE u.npc_type IN ('ABSOLUTE', 'FREE')
    AND cc.id IS NULL
`).all();

console.log(`Found ${npcsWithoutCyborg.length} NPCs without cyborg characters:\n`);

npcsWithoutCyborg.forEach(npc => {
    console.log(`- ${npc.username} (${npc.npc_type}): ${npc.faction_name}`);

    // 1. Create Cyborg Character
    const cyborgName = npc.faction_name ? `${npc.faction_name} Commander` : `${npc.username} Commander`;

    db.prepare(`
        INSERT INTO character_cyborg (user_id, name, level, strength, dexterity, constitution, agility, intelligence, wisdom, hp, mp)
        VALUES (?, ?, 1, 15, 15, 15, 15, 15, 15, 225, 210)
    `).run(npc.id, cyborgName);

    console.log(`  ✓ Created cyborg: ${cyborgName}`);

    // 2. Set GPS position based on first building
    const firstBuilding = db.prepare('SELECT x, y FROM user_buildings WHERE user_id = ? ORDER BY id ASC LIMIT 1').get(npc.id);

    if (firstBuilding) {
        const gpsPos = `${firstBuilding.x}_${firstBuilding.y}`;
        db.prepare('UPDATE users SET current_pos = ? WHERE id = ?').run(gpsPos, npc.id);
        console.log(`  ✓ Set GPS position: ${gpsPos}`);
    } else {
        console.log(`  ⚠ No buildings found, keeping default position`);
    }

    // 3. Update resources for better balance (only for FREE NPCs)
    if (npc.npc_type === 'FREE') {
        const resources = db.prepare('SELECT gold, gem FROM user_resources WHERE user_id = ?').get(npc.id);
        if (resources && resources.gold < 50000) {
            db.prepare('UPDATE user_resources SET gold = 50000, gem = 1000 WHERE user_id = ?').run(npc.id);
            console.log(`  ✓ Updated resources: 50,000 Gold, 1,000 Gems`);
        }
    }

    console.log('');
});

console.log('=== Cyborg Creation Complete ===\n');

// Verify results
const verification = db.prepare(`
    SELECT u.username, u.npc_type, cc.name as cyborg_name, u.current_pos
    FROM users u
    LEFT JOIN character_cyborg cc ON u.id = cc.user_id
    WHERE u.npc_type IN ('ABSOLUTE', 'FREE')
    ORDER BY u.npc_type, u.username
`).all();

console.log('Verification:');
console.table(verification);
