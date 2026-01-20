/**
 * @file test_factory.js
 * @description UserFactory의 무결성을 검증하는 테스트 스크립트
 * @role 자동화된 통합 테스트 - Factory 생성 로직 검증
 * @dependencies database.js, UserFactory.js
 * @usage node test_factory.js
 * @status Test Script (CI/CD에서 실행 가능)
 * 
 * @analysis
 * **테스트 목적:**
 * - UserFactory가 유저 생성 시 모든 필수 데이터를 제대로 생성하는지 확인
 * - 데이터베이스 무결성 검증 (CASCADE, 외래 키 등)
 * 
 * **테스트 항목:**
 * 1. 유저 레코드 생성 확인
 * 2. 사이보그 자동 생성 확인
 * 3. 초기 건물 (사령부) 생성 확인
 * 4. 자원 레코드 생성 확인
 * 5. building_type_code와 legacy type 일치 여부
 * 
 * **테스트 패턴:**
 * - 테스트 데이터 생성 → 검증 → 즉시 삭제 (Cleanup)
 * - 타임스탬프로 고유 유저명 생성하여 충돌 방지
 * 
 * **성공 조건:**
 * - 모든 [PASS] 메시지 출력
 * - Exit code 0
 * 
 * **실패 조건:**
 * - [FAIL] 메시지 출력 시 즉시 종料 (exit code 1)
 */

const db = require('./database');
const UserFactory = require('./src/factories/UserFactory');

// === 테스트 유저명 생성 ===
/**
 * 타임스탬프 사용 이유:
 * - 매 실행마다 고유한 유저명 생성
 * - 이전 테스트 실패로 인한 잔존 데이터 충돌 방지
 * 
 * 형식: Factory_Test_User_1705724400000
 */
const TEST_USER = 'Factory_Test_User_' + Date.now();

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🧪 STARTING FACTORY INTEGRITY TEST');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log(`📝 Test User: ${TEST_USER}\n`);

try {
    // ═══ TEST 1: 유저 생성 ═══
    /**
     * UserFactory.create() 테스트:
     * 
     * 최소 필수 파라미터로 유저 생성
     * - username: 고유 식별자
     * - location: 초기 위치 (서울 인근)
     * - initialBuilding: 사령부
     * 
     * 자원은 기본값 사용 (Factory 내부 로직)
     */
    console.log('1️⃣  Creating user via Factory...');
    const user = UserFactory.create({
        username: TEST_USER,
        location: {
            x: 37.5,    // 서울 인근
            y: 127.0,
            world_x: 0, // 그리드는 테스트용 더미값
            world_y: 0
        },
        initialBuilding: { code: 'COMMAND_CENTER' }
    });

    if (user && user.id) {
        console.log(`✅ [PASS] User created with ID: ${user.id}\n`);
    } else {
        console.error('❌ [FAIL] User object is invalid!');
        process.exit(1);
    }

    // ═══ TEST 2: 사이보그 존재 확인 ═══
    /**
     * character_cyborg 테이블 검증:
     * 
     * Factory는 유저 생성 시 자동으로 사이보그를 생성해야 함
     * - user_id: 방금 생성한 유저 ID와 일치
     * - 기본 스탯: strength, dexterity 등
     * - HP/MP: 초기 생명력/마나
     * 
     * 사이보그 없으면 게임 플레이 불가 → 치명적 오류
     */
    console.log('2️⃣  Verifying cyborg creation...');
    const cyborg = db.prepare('SELECT * FROM character_cyborg WHERE user_id = ?').get(user.id);

    if (cyborg) {
        console.log(`✅ [PASS] Cyborg found: ${cyborg.name}`);
        console.log(`   Stats: HP=${cyborg.hp}, MP=${cyborg.mp}, STR=${cyborg.strength}\n`);
    } else {
        console.error('❌ [FAIL] Cyborg NOT created!');
        console.error('   This is a CRITICAL failure - users need cyborgs to play.');
        process.exit(1);
    }

    // ═══ TEST 3: 초기 건물 존재 확인 ═══
    /**
     * user_buildings 테이블 검증:
     * 
     * 체크 항목:
     * 1. 사령부(COMMAND_CENTER) 존재 여부
     * 2. building_type_code 새 컬럼 사용 확인
     * 3. legacy type 컬럼과의 일치 여부
     * 
     * 불일치 시 경고만 출력 (의도적 불일치 가능)
     */
    console.log('3️⃣  Verifying initial building...');
    const bldg = db.prepare(
        'SELECT * FROM user_buildings WHERE user_id = ? AND building_type_code = ?'
    ).get(user.id, 'COMMAND_CENTER');

    if (bldg) {
        console.log(`✅ [PASS] Building found: ${bldg.building_type_code}`);
        console.log(`   Location: (${bldg.x.toFixed(4)}, ${bldg.y.toFixed(4)})`);

        // building_type_code와 legacy type 비교
        if (bldg.building_type_code === bldg.type) {
            console.log('✅ [PASS] building_type_code matches legacy type.\n');
        } else {
            console.warn('⚠️  [WARN] Legacy type mismatch:');
            console.warn(`   building_type_code: ${bldg.building_type_code}`);
            console.warn(`   type (legacy): ${bldg.type}`);
            console.warn('   This is acceptable if intentional migration.\n');
        }
    } else {
        console.error('❌ [FAIL] Initial building (COMMAND_CENTER) NOT created!');
        console.error('   Users need at least one building to start the game.');
        process.exit(1);
    }

    // ═══ TEST 4: 자원 레코드 확인 ═══
    /**
     * user_resources 테이블 검증:
     * 
     * 게임 필수 자원:
     * - gold: 골드 (기본 화폐)
     * - gem: 보석 (프리미엄 화폐)
     * - (추가 자원: 식량, 철, 나무 등)
     * 
     * 자원 레코드 없으면 경제 시스템 작동 불가
     */
    console.log('4️⃣  Verifying resource records...');
    const res = db.prepare('SELECT * FROM user_resources WHERE user_id = ?').get(user.id);

    if (res) {
        console.log(`✅ [PASS] Resources found:`);
        console.log(`   Gold: ${res.gold}`);
        console.log(`   Gem: ${res.gem || 0}\n`);
    } else {
        console.error('❌ [FAIL] Resources NOT created!');
        console.error('   Users need resources to perform actions.');
        process.exit(1);
    }

    // ═══ CLEANUP: 테스트 데이터 삭제 ═══
    /**
     * 테스트 후 정리:
     * 
     * users 테이블에서 테스트 유저 삭제
     * - ON DELETE CASCADE로 관련 데이터도 자동 삭제:
     *   * character_cyborg
     *   * user_buildings
     *   * user_resources
     *   * 기타 외래 키로 연결된 모든 데이터
     * 
     * DB를 깨끗하게 유지하여 다음 테스트 영향 방지
     */
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🧹 CLEANUP');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
    console.log('✅ Test user and all related data deleted.');

    // ═══ 테스트 성공 ═══
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 ALL TESTS PASSED!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    process.exit(0); // 성공 종료

} catch (e) {
    /**
     * 예외 처리:
     * 
     * 가능한 에러:
     * - DB 연결 실패
     * - Factory 내부 오류
     * - SQL 구문 오류
     * - 제약 조건 위반
     * 
     * 상세한 스택 트레이스 출력으로 디버깅 지원
     */
    console.error('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('💥 FATAL ERROR');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.error(e);
    console.error('\n❌ TEST FAILED\n');

    process.exit(1); // 실패 종료
}
