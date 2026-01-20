/**
 * @file seed_rival.js
 * @description 개발 및 테스트 목적으로 플레이어 주변에 적대적 라이벌 사용자를 생성하는 스크립트
 * @role 테스트 데이터 생성 (라이벌 유저, 건물, 사이보그)
 * @dependencies database.js, UserFactory.js
 * @usage node seed_rival.js
 * @status Dev/Test Only (프로덕션 환경에서 실행 금지)
 * 
 * @analysis
 * **목적:**
 * - 전투/외교 시스템 테스트를 위한 적대 세력 생성
 * - 영토 겹침 시나리오 테스트
 * 
 * **좌표 설정:**
 * - 기준점: 서울 (37.5665°N, 126.9780°E)
 * - 라이벌 위치: 기준점에서 북동쪽 약 6km
 *   * +0.05° 위도 ≈ 5.5km 북쪽
 *   * +0.05° 경도 ≈ 4.5km 동쪽 (위도에 따라 다름)
 * 
 * **주의사항:**
 * - `UserFactory`로 유저는 생성하지만, 추가 건물은 직접 SQL 삽입
 * - 향후 Factory에 다중 건물 생성 기능 추가 권장
 * - CASCADE DELETE로 유저 삭제 시 관련 데이터도 자동 삭제됨
 */

const db = require('./database');
const UserFactory = require('./src/factories/UserFactory');

/**
 * @function seedRival
 * @description 라이벌 사용자와 영토를 생성하는 메인 함수
 * 
 * 실행 흐름:
 * 1. 기존 라이벌 유저 존재 확인
 * 2. 없으면 UserFactory로 생성 (사령부 포함)
 * 3. 추가 건물 생성 (배럭, 광산, 창고)
 * 4. 사이보그 누락 체크 및 복구
 */
function seedRival() {
    console.log('🎯 Seeding Rival User and Territory via Factory...');

    try {
        // === 1단계: 라이벌 유저명 정의 ===
        const rivalName = 'Rival_Faction';

        // === 2단계: 기존 유저 확인 ===
        /**
         * 중복 생성 방지:
         * - 이미 존재하면 생성 건너뜀
         * - 하지만 데이터 무결성은 검증 (사이보그 누락 체크)
         */
        let rival = db.prepare('SELECT * FROM users WHERE username = ?').get(rivalName);

        if (!rival) {
            console.log('📍 Creating new rival user...');

            // === 3단계: 라이벌 위치 계산 ===
            /**
             * 좌표 계산:
             * 
             * 기준점 (서울):
             * - Lat: 37.5665°N
             * - Lng: 126.9780°E
             * 
             * 라이벌 위치:
             * - Lat: 37.5665 + 0.05 = 37.6165°N (약 5.5km 북쪽)
             * - Lng: 126.9780 + 0.05 = 127.0280°E (약 4.5km 동쪽)
             * 
             * 위경도 1도당 거리:
             * - 위도 1° ≈ 111km (전 세계 거의 동일)
             * - 경도 1° ≈ 88km (서울 위도 37° 기준, 적도는 111km)
             * 
             * 0.05° 거리:
             * - Δlat 0.05° ≈ 5.5km
             * - Δlng 0.05° ≈ 4.4km (서울 기준)
             */
            const rivalLat = 37.5665 + 0.05; // 약 5.5km 북쪽
            const rivalLng = 126.9780 + 0.05; // 약 4.5km 동쪽

            /**
             * 그리드 좌표 계산:
             * 
             * 전체 맵:
             * - 경도: -180° ~ +180° (360° 범위)
             * - 위도: -90° ~ +90° (180° 범위)
             * 
             * 그리드 크기:
             * - 가로: 160칸
             * - 세로: 80칸
             * 
             * 변환 공식:
             * - gridX = (lng + 180) / 360 * 160
             * - gridY = (90 - lat) / 180 * 80
             * 
             * 예: (127.028, 37.6165)
             * - gridX = (127.028 + 180) / 360 * 160 ≈ 136
             * - gridY = (90 - 37.6165) / 180 * 80 ≈ 23
             */
            const gridX = Math.floor((rivalLng + 180) / 360 * 160);
            const gridY = Math.floor((90 - rivalLat) / 180 * 80);

            // === 4단계: UserFactory로 유저 생성 ===
            /**
             * UserFactory.create() 파라미터:
             * 
             * - username: 유저명
             * - npcType: 'NONE' (플레이어), 'ABSOLUTE' (절대세력 NPC), 'FREE' (자유세력 NPC)
             * - location: 초기 위치 및 그리드 좌표
             * - resources: 초기 자원
             * - initialBuilding: 첫 건물 (보통 사령부)
             * 
             * Factory가 자동으로 생성하는 것:
             * 1. users 테이블 레코드
             * 2. character_cyborg 테이블 레코드 (사이보그)
             * 3. user_resources 테이블 레코드 (자원)
             * 4. user_buildings 테이블 레코드 (사령부)
             */
            rival = UserFactory.create({
                username: rivalName,
                npcType: 'NONE', // 일반 플레이어로 설정 (NPC로 하려면 'ABSOLUTE')
                location: {
                    x: rivalLat,      // 초기 위도
                    y: rivalLng,      // 초기 경도
                    world_x: gridX,   // 그리드 X
                    world_y: gridY    // 그리드 Y
                },
                resources: {
                    gold: 3000,  // 플레이어보다 많은 자원 (테스트용)
                    gem: 100
                },
                initialBuilding: { code: 'COMMAND_CENTER' } // 사령부로 시작
            });

            console.log(`✅ Created rival user: ${rivalName} (ID: ${rival.id})`);
            console.log `   위치: ${rivalLat.toFixed(4)}°N, ${rivalLng.toFixed(4)}°E`);
            console.log(`   그리드: (${gridX}, ${gridY})`);

            // === 5단계: 추가 건물 생성 ===
            /**
             * 추가 건물 배치:
             * 
             * 사령부 주변에 3개 건물 배치
             * - BARRACKS (배럭): 북동쪽 (+0.005, +0.005) ≈ 600m
             * - MINE (광산): 남동쪽 (-0.005, +0.005) ≈ 600m
             * - WAREHOUSE (창고): 서쪽 (0, -0.005) ≈ 500m
             * 
             * 참고: 0.005° ≈ 500-600m
             * 
             * TODO: 향후 개선
             * - UserFactory에 다중 건물 생성 기능 추가
             * - 건물 타입별 기본 HP, 반경 등을 building_types에서 가져오기
             */
            const buildings = [
                { code: 'BARRACKS', dLat: 0.005, dLng: 0.005 },   // 북동쪽
                { code: 'MINE', dLat: -0.005, dLng: 0.005 },      // 남동쪽
                { code: 'WAREHOUSE', dLat: 0, dLng: -0.005 }      // 서쪽
            ];

            /**
             * 건물 삽입 쿼리:
             * 
             * user_buildings 테이블 주요 컬럼:
             * - building_type_code: 새 표준 컬럼 (예: 'BARRACKS')
             * - type: 레거시 컬럼 (호환성 유지)
             * - is_territory_center: 영토 중심 여부 (0 = 일반 건물)
             * - territory_radius: 영토 반경 (0 = 영토 아님)
             * - hp: 내구도 (100으로 초기화)
             */
            const insertBldg = db.prepare(`
                INSERT INTO user_buildings (
                    user_id, building_type_code, type, 
                    x, y, world_x, world_y, 
                    is_territory_center, territory_radius, hp
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            buildings.forEach(b => {
                insertBldg.run(
                    rival.id,        // 라이벌 유저 ID
                    b.code,          // 건물 타입 코드 (표준)
                    b.code,          // 레거시 type 컬럼 (동일하게 설정)
                    rivalLat + b.dLat,  // 건물 위도 (사령부 기준 오프셋)
                    rivalLng + b.dLng,  // 건물 경도
                    gridX, gridY,    // 그리드 좌표 (유저와 동일)
                    0,               // is_territory_center: 일반 건물
                    0,               // territory_radius: 영토 아님
                    100              // hp: 초기 내구도
                );
            });
            console.log(`🏗️  Created ${buildings.length} additional buildings around rival base.`);

        } else {
            // === 6단계: 기존 유저 발견 - 데이터 무결성 검증 ===
            console.log(`ℹ️  Rival user already exists: ${rivalName} (ID: ${rival.id}) - Skipping creation.`);

            /**
             * 사이보그 누락 체크:
             * 
             * 문제 상황:
             * - 과거 코드나 수동 DB 조작으로 유저는 있지만 사이보그가 없을 수 있음
             * - 사이보그 없으면 게임 플레이 불가능 (캐릭터가 없음)
             * 
             * 해결:
             * - 사이보그 누락 감지 시 자동 생성
             * - Factory 로직과 동일한 기본 스탯 사용
             */
            const cyborg = db.prepare('SELECT id FROM character_cyborg WHERE user_id = ?').get(rival.id);
            if (!cyborg) {
                console.warn(`⚠️  [WARNING] Rival user exists but has NO CYBORG! Creating fallback...`);

                /**
                 * 기본 사이보그 스탯:
                 * - 모든 능력치: 10
                 * - HP: 150 (기본 체력)
                 * - MP: 140 (기본 마나)
                 * 
                 * 이 값들은 UserFactory의 기본값과 동일
                 */
                db.prepare(`
                    INSERT INTO character_cyborg (
                        user_id, name, 
                        strength, dexterity, constitution, intelligence, wisdom, 
                        hp, mp
                    )
                    VALUES (?, ?, 10, 10, 10, 10, 10, 150, 140)
                `).run(rival.id, 'Rival Cyborg');

                console.log("✅ Repaired missing cyborg with default stats.");
            }
        }

        console.log('🎉 Rival seed complete!\n');

    } catch (err) {
        /**
         * 에러 처리:
         * 
         * 가능한 에러:
         * - DB 연결 실패
         * - 중복 키 제약 위반
         * - 외래 키 제약 위반
         * - Factory 생성 실패
         * 
         * 스택 트레이스 출력으로 디버깅 용이
         */
        console.error('❌ Seed error:', err);
        throw err; // 재발생시켜 프로세스 종료
    }
}

// === 스크립트 실행 ===
/**
 * 직접 실행 시:
 * $ node seed_rival.js
 * 
 * 결과:
 * - Rival_Faction 유저 생성 (또는 존재 확인)
 * - 사령부 + 3개 건물 생성
 * - 사이보그 자동 생성/복구
 */
seedRival();
