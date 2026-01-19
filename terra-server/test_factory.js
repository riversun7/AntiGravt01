const db = require('./database');
const UserFactory = require('./src/factories/UserFactory');
// Use a test user name to avoid conflicts
const TEST_USER = 'Factory_Test_User_' + Date.now();

console.log('--- STARTING FACTORY INTEGRITY TEST ---');

try {
    // 1. Create User via Factory
    const user = UserFactory.create({
        username: TEST_USER,
        location: { x: 37.5, y: 127.0, world_x: 0, world_y: 0 },
        initialBuilding: { code: 'COMMAND_CENTER' }
    });

    console.log(`[PASS] User created with ID: ${user.id}`);

    // 2. Verify Cyborg Existence
    const cyborg = db.prepare('SELECT * FROM character_cyborg WHERE user_id = ?').get(user.id);
    if (cyborg) {
        console.log(`[PASS] Cyborg found for user: ${cyborg.name} (HP: ${cyborg.hp})`);
    } else {
        console.error('[FAIL] Cyborg NOT created!');
        process.exit(1);
    }

    // 3. Verify Building Existence
    const bldg = db.prepare('SELECT * FROM user_buildings WHERE user_id = ? AND building_type_code = ?').get(user.id, 'COMMAND_CENTER');
    if (bldg) {
        console.log(`[PASS] Building found: ${bldg.building_type_code} (Legacy Type: ${bldg.type})`);
        if (bldg.building_type_code === bldg.type) {
            console.log('[PASS] building_type_code matches legacy type.');
        } else {
            console.warn('[WARN] Legacy type mismatch (acceptable if intentional)');
        }
    } else {
        console.error('[FAIL] Initial building NOT created!');
        process.exit(1);
    }

    // 4. Verify Resources
    const res = db.prepare('SELECT * FROM user_resources WHERE user_id = ?').get(user.id);
    if (res) {
        console.log(`[PASS] Resources found: Gold=${res.gold}`);
    } else {
        console.error('[FAIL] Resources NOT created!');
        process.exit(1);
    }

    // Cleanup
    console.log('--- CLEANUP ---');
    db.prepare('DELETE FROM users WHERE id = ?').run(user.id); // Cascade should handle the rest
    console.log('Test user deleted.');
    console.log('--- TEST SUCCESS ---');

} catch (e) {
    console.error('[FATAL ERROR]', e);
    process.exit(1);
}
