/**
 * @file test_free_npc.js
 * @description FreeNpcManager AI 시스템의 동작을 테스트하는 간단한 스크립트
 * @role AI 로직 수동 테스트 - 1회 틱(Tick) 실행
 * @dependencies FreeNpcManager.js
 * @usage node test_free_npc.js
 * @status Test/Debug Script
 * 
 * @analysis
 * **테스트 목적:**
 * - FreeNpcManager의 `run()` 메서드가 정상 작동하는지 확인
 * - AI 로직 디버깅 및 로그 출력 확인
 * 
 * **FreeNpcManager란:**
 * - 자유 세력 NPC(Free Faction)의 자동 행동을 관리하는 AI
 * - 주기적으로 실행되어 NPC 행동 결정 (건설, 이동, 자원 수집 등)
 * - 실제 게임에서는 서버가 주기적으로 호출 (예: 60초마다)
 * 
 * **이 스크립트의 역할:**
 * - AI 1회 실행 (틱 1회)
 * - 로그 출력으로 동작 확인
 * - 빠른 디버깅 용도
 * 
 * **실행 결과 예시:**
 * ```
 * === Testing FreeNpcManager ===
 * 
 * [FreeNPC] Processing 3 free NPCs...
 * [FreeNPC] NPC 'free_merchant' - Action: GATHER_RESOURCES
 * [FreeNPC] NPC 'free_scorpion' - Action: BUILD_BARRACKS
 * [FreeNPC] NPC 'free_battalion' - Action: IDLE
 * 
 * === Test Complete ===
 * ```
 * 
 * @example
 * # 터미널에서 실행:
 * $ node test_free_npc.js
 * 
 * # 결과 확인:
 * - AI가 정상 실행되면 NPC 행동 로그 출력
 * - 에러 발생 시 스택 트레이스 확인
 */

// FreeNpcManager AI 시스템 임포트
const FreeNpcManager = require('./ai/FreeNpcManager');

// === 테스트 시작 ===
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🤖 Testing FreeNpcManager');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

/**
 * FreeNpcManager.run() 실행:
 * 
 * 동작:
 * 1. DB에서 npc_type = 'FREE'인 모든 NPC 조회
 * 2. 각 NPC의 현재 상태 분석 (자원, 건물, 위치 등)
 * 3. AI 로직으로 다음 행동 결정
 * 4. 행동 실행 (DB 업데이트)
 * 
 * 주의사항:
 * - 실제 DB를 수정하므로 테스트 환경에서 실행 권장
 * - 프로덕션 DB에서 실행 시 주의
 */
try {
    FreeNpcManager.run();
    console.log('\n✅ AI tick completed successfully.');
} catch (error) {
    /**
     * 에러 처리:
     * 
     * 가능한 에러:
     * - FreeNpcManager 모듈 로드 실패
     * - DB 연결 오류
     * - AI 로직 내부 오류
     */
    console.error('\n❌ Error during AI execution:');
    console.error(error);
    process.exit(1);
}

// === 테스트 완료 ===
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🎉 Test Complete');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

/**
 * 다음 단계:
 * 
 * 1. 로그 확인:
 *    - NPC가 몇 개 발견되었는지
 *    - 각 NPC가 어떤 행동을 했는지
 * 
 * 2. DB 검증:
 *    - user_buildings 테이블에 새 건물 추가되었는지
 *    - user_resources 테이블 자원 변동 확인
 *    - users 테이블 위치 변경 확인
 * 
 * 3. 여러 번 실행:
 *    - AI가 시간에 따라 다른 결정을 하는지
 *    - 무한 루프나 동일 행동 반복 발생하지 않는지
 * 
 * 4. 디버깅:
 *    - FreeNpcManager.js에 console.log 추가
 *    - 의사결정 트리 추적
 */
