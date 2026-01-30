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
        // === 1. Fetch Elevation (Always needed for height) ===
        const elevations = await this.elevationService.getElevations(locations);

        // === 2. Fetch OSM Data (The Truth for Type) ===
        let osmTypes = [];
        if (this.osmTerrainService && locations.length > 0) {
            try {
                // Heuristic: Use the center of the request
                const centerLat = locations[0].lat;
                const centerLng = locations[0].lng;
                osmTypes = await this.osmTerrainService.classifyTerrainBatch(centerLat, centerLng, locations);
            } catch (e) {
                console.error("[TerrainManager] OSM Fetch failed, falling back to elevation only", e);
                // Fallback array of nulls
                osmTypes = new Array(locations.length).fill(null);
            }
        } else {
            osmTypes = new Array(locations.length).fill(null);
        }

        // === 3. Merge Strategies (Hybrid: OSM > Elevation for Sea) ===
        return elevations.map((elevation, i) => {
            const osmType = osmTypes[i];
            let type = 'PLAIN';

            // Strategy: OSM Type takes precedence
            if (osmType === 'WATER') {
                type = 'WATER';
            } else if (osmType === 'CONCRETE') {
                type = 'CONCRETE';
            } else if (osmType === 'FOREST') {
                type = 'FOREST';
            } else if (osmType === 'DIRT') {
                type = 'DIRT';
            } else {
                // If OSM is silent (Unmapped or Open Ocean)
                if (elevation >= 50) {
                    type = 'MOUNTAIN';
                } else if (elevation <= 0.5) {
                    // Fallback for Open Ocean / Sea Level where OSM polygon is missing
                    type = 'WATER';
                }
            }

            return {
                type: type,
                elevation: elevation,
                isOverride: !!osmType,
                lat: locations[i].lat,
                lng: locations[i].lng
            };
        });
    }
}

module.exports = TerrainManager;
