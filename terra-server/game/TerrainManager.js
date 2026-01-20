/**
 * @file TerrainManager.js
 * @description 게임 내 지형 정보(타입, 고도)를 관리하는 매니저
 * @role 고도 서비스(ElevationService)를 추상화하여 게임 로직에 필요한 지형 타입 반환
 * @dependencies ElevationService (고도 데이터)
 * @referenced_by server.js, PathfindingService.js
 * @references ElevationService.js, database.js
 * @status Active
 * 
 * @analysis
 * 지형 분류 시스템:
 * - **현재**: 고도(Elevation)만으로 단순 판별
 *   * 0m 미만: WATER (물)
 *   * 1000m 이상: MOUNTAIN (산)
 *   * 그 외: PLAIN (평지)
 * 
 * - **추후 확장 계획**: 타일 오버라이드 (Tile Overrides)
 *   * DB에 특정 좌표의 지형을 강제 설정 가능
 *   * 예: 작은 섬, 교량, 특수 지형 등
 *   * 현재 코드는 주석 처리됨
 * 
 * 게임 밸런스 조정:
 * - 임계값 변경으로 지형 분포 조정 가능
 * - 예: MOUNTAIN 기준을 800m로 낮추면 산악지형 증가
 */

const ElevationService = require('./ElevationService');

/**
 * @class TerrainManager
 * @description 지형 정보 관리자 클래스
 */
class TerrainManager {
    /**
     * @constructor
     * @param {object} db - SQLite 데이터베이스 인스턴스
     */
    constructor(db) {
        this.db = db;
        // 고도 서비스 초기화 (내부적으로 ElevationService 사용)
        this.elevationService = new ElevationService(db);
    }

    /**
     * @method getTerrainInfo
     * @description 단일 좌표의 지형 정보를 조회
     * 
     * @param {number} lat - 위도
     * @param {number} lng - 경도
     * @returns {Promise<Object>} { type: 'PLAIN'|'MOUNTAIN'|'WATER', elevation: number, isOverride: boolean }
     * 
     * @example
     * const terrain = await terrainManager.getTerrainInfo(37.5665, 126.9780);
     * console.log(`지형: ${terrain.type}, 고도: ${terrain.elevation}m`);
     * // 출력: 지형: PLAIN, 고도: 38m
     */
    async getTerrainInfo(lat, lng) {
        // 내부적으로 getTerrainInfos를 호출하여 배치 처리 재사용
        return (await this.getTerrainInfos([{ lat, lng }]))[0];
    }

    /**
     * @method getTerrainInfos
     * @description 다수 좌표의 지형 정보를 일괄 조회
     * 
     * @param {Array<{lat: number, lng: number}>} locations - 조회할 좌표 배열
     * @returns {Promise<Array<{type: string, elevation: number, isOverride: boolean}>>} 지형 정보 배열
     * 
     * @example
     * const terrains = await terrainManager.getTerrainInfos([
     *   {lat: 37.5, lng: 126.9},  // 서울
     *   {lat: 35.1, lng: 129.0}   // 부산
     * ]);
     * // 결과: [{type: 'PLAIN', elevation: 38, ...}, {type: 'PLAIN', elevation: 2, ...}]
     * 
     * @analysis
     * **지형 분류 기준:**
     * 
     * 고도를 기준으로 세 가지 타입으로 분류:
     * 
     * 1. **WATER (물)**: elevation < 0m
     *    - 바다, 호수, 강
     *    - 이동 불가 지형
     *    - 예: 동해 평균 고도 -200m
     * 
     * 2. **MOUNTAIN (산)**: elevation >= 1000m
     *    - 산악 지형
     *    - 현재는 통과 가능 (추후 속도 패널티 가능)
     *    - 예: 히말라야 산맥 8000m+, 한국 지리산 1915m
     * 
     * 3. **PLAIN (평지)**: 0m <= elevation < 1000m
     *    - 대부분의 육지
     *    - 자유롭게 이동 가능
     *    - 예: 서울 38m, 대구 60m
     * 
     * **게임 밸런스 조정:**
     * - 임계값 0, 1000을 변경하여 지형 분포 조정 가능
     * - 예: MOUNTAIN 기준을 800m로 낮추면 산악 지역 증가
     * - 예: WATER 기준을 -10m로 변경하면 얼읍은 호수 포함
     */
    async getTerrainInfos(locations) {
        // === 1단계: (미래) 타일 오버라이드 로직 (TODO) ===
        /**
         * TODO: 향후 구현 예정
         * 
         * tile_overrides 테이블 구조:
         * - lat, lng: 좌표
         * - terrain_type: 'PLAIN' | 'MOUNTAIN' | 'WATER' | ...
         * - reason: 오버라이드 사유
         * 
         * 사용 예시:
         * - 작은 섬을 PLAIN으로 설정 (고도는 음수지만 육지)
         * - 교량을 PLAIN으로 설정 (강을 건널 수 있게)
         * - 특수 미션 지역 설정
         * 
         * 코드 예시:
         * const override = db.prepare(
         *   'SELECT terrain_type FROM tile_overrides WHERE lat = ? AND lng = ?'
         * ).get(lat, lng);
         * if (override) return { type: override.terrain_type, isOverride: true };
         */
        // 현재는 생략됨

        // === 2단계: 고도 기반 자동 분류 ===
        // 모든 좌표의 고도를 일괄 조회 (배치 성능 최적화)
        const elevations = await this.elevationService.getElevations(locations);

        // 각 고도를 지형 타입으로 변환
        return elevations.map(elevation => {
            let type = 'PLAIN'; // 기본값: 평지

            /**
             * 지형 타입 로직:
             * 
             * if-else 순서가 중요:
             * 1. 먼저 WATER 확인 (elevation < 0)
             * 2. 그 다음 MOUNTAIN 확인 (elevation >= 1000)
             * 3. 나머지는 PLAIN (0 <= elevation < 1000)
             */
            if (elevation < 0) {
                type = 'WATER'; // 물: 해수면 아래
            } else if (elevation >= 1000) {
                type = 'MOUNTAIN'; // 산: 1000m 이상
            }
            // else: PLAIN은 이미 기본값으로 설정됨

            return {
                type: type,              // 지형 타입
                elevation: elevation,    // 고도 (미터)
                isOverride: false        // 오버라이드 여부 (현재 false)
            };
        });
    }
}

module.exports = TerrainManager;
