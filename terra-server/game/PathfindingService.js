/**
 * @file PathfindingService.js
 * @description 유닛의 이동 경로 유효성을 검사하고 장애물을 판별하는 서비스
 * @role 경로 검증(Validation), 지형 및 영토 충돌 체크
 * @dependencies TerrainManager (지형 정보), database (영토 데이터)
 * @referenced_by server.js - POST /api/move 라우트에서 사용
 * @references TerrainManager.js, database.js
 * @status Active
 * 
 * @analysis
 * 경로 찾기 알고리즘 특징:
 * - **Grid-less 방식**: 출발지와 목적지 사이를 직선으로 샘플링하여 검증
 * - **A* 알고리즘 미사용**: 복잡한 경로 탐색은 불가능하지만 성능은 빠름
 * - **장애물 감지**: 물(WATER) 지형 및 타인 영토 통과 불가
 * 
 * 장단점:
 * - 장점: 빠른 성능, 간단한 구현
 * - 단점: 중간에 장애물이 있으면 우회 불가 (향후 A* 도입 고려)
 * 
 * 경로 검증 흐름:
 * 1. 출발지 -> 목적지 사이를 1km 단위로 샘플링
 * 2. 모든 샘플 위치의 지형 일괄 조회 (Batch)
 * 3. 각 샘플에 대해:
 *    a. 물(WATER) 지형 체크
 *    b. 안전지대(Safe Zone, 내 사령부 3km) 체크
 *    c. 영토 권한(Territory Access) 체크
 * 4. 모두 통과하면 success, 하나라도 실패하면 error
 */

const TerrainManager = require('./TerrainManager');

/**
 * @class PathfindingService
 * @description 경로 검증 매니저 클래스
 */
class PathfindingService {
    /**
     * @constructor
     * @param {object} db - SQLite 데이터베이스 인스턴스
     */
    constructor(db) {
        this.db = db;
        // 지형 정보 관리자 초기화
        this.terrainManager = new TerrainManager(db);
    }

    /**
     * @method findPath
     * @description 출발지에서 목적지로의 경로가 유효한지 검증하고 최종 경로를 반환
     * 
     * @param {number} startLat - 출발 위도
     * @param {number} startLng - 출발 경도
     * @param {number} endLat - 도착 위도
     * @param {number} endLng - 도착 경도
     * @param {Array} waypoints - 경유지 배열 (현재는 미사용, 향후 확장 가능)
     * @param {number|null} userId - 이동 주체 사용자 ID (영토 통행 권한 확인용)
     * @returns {Promise<Object>} { success: boolean, path?: Array, error?: string, distance?: number }
     * 
     * @example
     * const result = await pathfinder.findPath(37.5, 126.9, 37.6, 127.0, [], userId);
     * if (result.success) {
     *   console.log(`\uacbd\ub85c \uc720\ud6a8! \uac70\ub9ac: ${result.distance}km`);
     * } else {
     *   console.log(`\uc774\ub3d9 \ubd88\uac00: ${result.error}`);
     * }
     * 
     * @analysis
     * **BATCH OPTIMIZATION 전략:**
     * - 경로 전체를 1km 단위로 샘플링하여 한 번에 지형/영토 정보를 조회
     * - 개별 조회: N번 * (DB조회 + 고도API) = 매우 느림
     * - 배치 조회: 1번 * (DB조회 + 고도API) = 빠름
     * 
     * **영토 권한 체크 (Power Diagram):**
     * - 한 좌표가 여러 영토 범위에 겹칠 수 있음
     * - 이 경우 "가장 가까운 사령부"의 소유자를 확인
     * - 가장 가까운 사령부가 타인의 것이면 통과 불가
     */
    async findPath(startLat, startLng, endLat, endLng, waypoints = [], userId = null) {
        console.log(`[Pathfinding] Validating path: [${startLat.toFixed(4)}, ${startLng.toFixed(4)}] -> [${endLat.toFixed(4)}, ${endLng.toFixed(4)}]`);

        // === 1단계: 경로 지점 구성 ===
        /**
         * 경로 구조:
         * [출발지] -> [경유지1] -> [경유지2] -> ... -> [목적지]
         * 
         * 현재는 waypoints가 비어있으므로:
         * [출발지] -> [목적지] (직선)
         */
        const points = [
            { lat: startLat, lng: startLng }, // 출발지
            ...waypoints,                      // 경유지 (현재 빈 배열)
            { lat: endLat, lng: endLng }       // 목적지
        ];

        let totalDistance = 0; // 총 이동 거리 (km)
        let validatedPath = [points[0]]; // 검증된 경로 (출발지부터 시작)

        console.time("PathfindingDuration"); // 성능 측정 시작

        // === 2단계: 경로 샘플링 (1km 단위) ===
        /**
         * 샘플링 전략:
         * 
         * 각 구간(segment)을 등간격으로 나누어 체크포인트 생성
         * - 구간 거리가 10km면 10개 샘플
         * - 구간 거리가 0.5km라도 최소 5개 샘플 (안전성)
         * 
         * 이유:
         * - 직선 경로 상에 숨어있는 장애물(물, 타인 영토) 감지
         * - 1km 간격은 최소 해상도와 성능의 균형
         */
        let allSamples = [];       // 샘플 좌표 + 구간 정보
        let allSampleCoords = [];  // 샘플 좌표만 (TerrainManager에 전달용)

        // 각 구간에 대해 샘플 생성
        for (let i = 0; i < points.length - 1; i++) {
            const p1 = points[i];     // 구간 시작점
            const p2 = points[i + 1]; // 구간 끝점

            // 구간 거리 계산 (Haversine 공식)
            const dist = this.calculateDistance(p1.lat, p1.lng, p2.lat, p2.lng);

            /**
             * 샘플 개수 결정:
             * - 기본: 1km당 1개 (dist / 1.0)
             * - 최소: 5개 (짧은 구간도 충분히 검사)
             * 
             * 예시:
             * - 10km 구간: Math.max(5, ceil(10/1.0)) = 10개
             * - 0.3km 구간: Math.max(5, ceil(0.3/1.0)) = 5개
             */
            let samples = Math.max(5, Math.ceil(dist / 1.0));

            // 구간 내 샘플 위치 계산
            for (let k = 1; k <= samples; k++) {
                /**
                 * 선형 보간(Linear Interpolation):
                 * 
                 * t: 0~1 사이의 비율
                 * - k=1, samples=10 일 때: t = 1/11 ≈ 0.09 (출발지에 가까움)
                 * - k=10, samples=10 일 때: t = 10/11 ≈ 0.91 (목적지에 가까움)
                 * 
                 * 새 좌표 = 시작점 + ((끝점 - 시작점) * t)
                 */
                const t = k / (samples + 1); // 0 < t < 1 (시작/끝점 제외)
                const lat = p1.lat + (p2.lat - p1.lat) * t;
                const lng = p1.lng + (p2.lng - p1.lng) * t;

                // 샘플 저장 (구간 인덱스 포함)
                allSamples.push({ lat, lng, segmentIndex: i });
                allSampleCoords.push({ lat, lng });
            }

            // 구간 끝점을 경로에 추가
            validatedPath.push(p2);
            totalDistance += dist;
        }

        // === 3단계: 배치 지형/영토 조회 ===
        if (allSampleCoords.length > 0) {
            console.log(`[Pathfinding] Batch checking ${allSampleCoords.length} sample points...`);

            // 3-1. 모든 샘플의 지형 정보 일괄 조회
            const terrainResults = await this.terrainManager.getTerrainInfos(allSampleCoords);

            // 3-2. 모든 영토 중심점(Territory Center) 조회
            /**
             * user_buildings 테이블에서 영토 중심으로 설정된 건물들:
             * - is_territory_center = 1인 건물들 (보통 사령부)
             * - territory_radius: 영토 반경 (km 단위)
             * 
             * TODO 최적화:
             * - 현재는 모든 영토를 로드 (미래에는 Spatial Query 권장)
             * - 예: 경로 부근의 영토만 조회 (Bounding Box)
             */
            const territories = this.db.prepare(`
                SELECT id, user_id, type, x, y, territory_radius 
                FROM user_buildings 
                WHERE is_territory_center = 1
            `).all();

            // 3-3. 내 안전지대(Safe Zone) 조회
            /**
             * 안전지대 개념:
             * - 내 사령부(COMMAND_CENTER) 주변 3km는 항상 통과 허용
             * - 이유: 자기 기지 근처에서 이동 불가 방지
             * 
             * 예시:
             * - 내 사령부 A: (37.5, 126.9), 반경 10km
             * - 다른 플레이어 사령부 B: (37.51, 126.92), 반경 8km
             * - 겹치는 지역에서도 A 주변 3km는 내가 통과 가능
             */
            let mySafeZones = [];
            if (userId) {
                mySafeZones = this.db.prepare(`
                    SELECT x, y FROM user_buildings 
                    WHERE user_id = ? AND (type = 'COMMAND_CENTER' OR is_territory_center = 1)
                `).all(userId);
            }

            // === 4단계: 각 샘플 위치 검증 ===
            for (let i = 0; i < terrainResults.length; i++) {
                const terrain = terrainResults[i];
                const sample = allSamples[i];

                // 4-1. 지형 체크: 물(WATER)은 통과 불가
                /**
                 * 지형 타입:
                 * - WATER: 바다, 호수 (통과 불가)
                 * - MOUNTAIN: 산악 (통과 가능, 이동 속도만 감소 가능)
                 * - PLAIN: 평지 (통과 가능)
                 * 
                 * 참고: 현재 MOUNTAIN은 통과를 허용하지만,
                 * 추후 산악 지형에서 이동 속도 패널티를 추가할 수 있음
                 */
                if (terrain.type === 'WATER') {
                    console.timeEnd("PathfindingDuration");
                    return {
                        success: false,
                        error: `🌊 경로 차단: ${terrain.type} 지형 (물) 감지 - 위치: [${sample.lat.toFixed(4)}, ${sample.lng.toFixed(4)}]`
                    };
                }

                // 4-2. 안전지대 체크: 내 사령부 3km 내면 영토 검사 생략
                if (mySafeZones.length > 0) {
                    const inSafeZone = mySafeZones.some(mz =>
                        this.calculateDistance(sample.lat, sample.lng, mz.x, mz.y) <= 3.0
                    );
                    if (inSafeZone) {
                        continue; // 안전지대 내면 통과
                    }
                }

                // 4-3. 영토 접근 권한 체크 (Power Diagram 로직)
                /**
                 * Power Diagram (Voronoi Diagram의 확장):
                 * 
                 * 문제 상황:
                 * - 사령부 A: (37.5, 126.9), 반경 10km
                 * - 사령부 B: (37.52, 126.95), 반경 8km
                 * - 테스트 좌표 P: (37.51, 126.92)
                 * 
                 * 분석:
                 * 1. P는 A 반경 내에 있음 (distance_to_A = 1.5km < 10km)
                 * 2. P는 B 반경 내에도 있음 (distance_to_B = 0.8km < 8km)
                 * 3. 겹치는 지역이므로 "가장 가까운 사령부"를 찾음
                 * 4. distance_to_B (0.8km) < distance_to_A (1.5km)
                 * 5. 결론: P는 B의 영토로 간주
                 * 6. B의 소유자가 나인지 확인 후 통과/차단 결정
                 */
                if (userId) {
                    // 현재 위치에서 모든 영토 중심까지의 거리 계산
                    const territoriesWithDistance = territories.map(t => ({
                        ...t,
                        distance: this.calculateDistance(sample.lat, sample.lng, t.x, t.y)
                    }));

                    // 영역 내에 있는 것들만 필터링 (territory_radius 이내)
                    const withinRange = territoriesWithDistance.filter(t => t.distance <= t.territory_radius);

                    if (withinRange.length > 0) {
                        // 가장 가까운 사령부 찾기
                        const closest = withinRange.reduce((prev, curr) =>
                            prev.distance < curr.distance ? prev : curr
                        );

                        // Admin Bypass (User ID 1)
                        if (String(userId) === '1') {
                            // Admin passes through everything
                        }
                        // 가장 가까운 사령부가 자신의 것이 아니면 차단
                        else if (closest.user_id && String(closest.user_id) !== String(userId)) {
                            console.timeEnd("PathfindingDuration");
                            return {
                                success: false,
                                error: `🚫 접근 거부: 타인의 영토 (${closest.type}, 중심에서 ${closest.distance.toFixed(2)}km, 반경 ${closest.territory_radius}km) 입니다. 차단 지점: [${sample.lat.toFixed(4)}, ${sample.lng.toFixed(4)}]`
                            };
                        }
                        // 가장 가까운 사령부가 자신의 것이면 통과
                    }
                    // withinRange가 비어있으면 (아무 영토에도 속하지 않음) 통과
                }
            }
        }

        // === 5단계: 모든 검증 통과 - 성공 반환 ===
        console.timeEnd("PathfindingDuration");

        return {
            success: true,
            path: validatedPath,        // 검증된 경로 좌표 배열
            distance: totalDistance,    // 총 거리 (km)
            steps: validatedPath.length // 경로 지점 개수
        };
    }

    /**
     * @method checkSegment
     * @deprecated 더 이상 사용하지 않음 - 배치 최적화로 대체됨
     * @description (구버전) 경로 구간의 장애물 체크
     */
    async checkSegment(p1, p2, distanceKm) {
        return true; // 항상 통과 (현재 미사용)
    }

    /**
     * @method calculateDistance
     * @description 두 좌표 간의 거리를 Haversine 공식으로 계산
     * 
     * @param {number} lat1 - 시작 위도
     * @param {number} lon1 - 시작 경도
     * @param {number} lat2 - 끝 위도
     * @param {number} lon2 - 끝 경도
     * @returns {number} 거리 (km)
     * 
     * @analysis
     * **Haversine 공식:**
     * 
     * 지구를 완벽한 구체로 가정하고 두 지점 간의 대원 거리를 계산하는 공식
     * 
     * 단계별 설명:
     * 1. 위경도 차이를 라디안으로 변환
     * 2. Haversine 함수 적용: hav(θ) = sin²(θ/2)
     * 3. 중심각 계산
     * 4. 지구 반지름 곱하여 km로 변환
     * 
     * 정확도:
     * - 오차: 약 0.3% (지구가 완벽한 구가 아니므로)
     * - 게임 용도로는 충분히 정확함
     * 
     * 참고:
     * - 지구 반지름 (R): 6371 km
     * - 극지방 및 거리가 먼 경우 조금 덜 정확할 수 있음
     * - 더 정확한 공식: Vincenty's formulae (하지만 계산량 많음)
     */
    calculateDistance(lat1, lon1, lat2, lon2) {
        // 지구 반지름 (km)
        const R = 6371;

        // 위경도 차이를 라디안으로 변환 (도 -> 라디안: * π/180)
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;

        /**
         * Haversine 공식의 핵심:
         * 
         * a = sin²(Δlat/2) + cos(lat1) * cos(lat2) * sin²(Δlon/2)
         * 
         * 의미:
         * - sin(Δlat/2): 위도 차이의 절반을 사인으로 변환
         * - cos(lat1) * cos(lat2): 위도에 따른 경도 척도 보정
         * - sin(Δlon/2): 경도 차이의 절반을 사인으로 변환
         */
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);

        /**
         * 중심각 계산:
         * 
         * c = 2 * atan2(√a, √(1-a))
         * 
         * 의미:
         * - atan2: 동경의 각도를 구하는 함수
         * - c: 두 지점을 잇는 직선이 지구 중심에서 이루는 각도 (라디안)
         */
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        // 거리 = 반지름 * 중심각
        return R * c; // km 단위
    }
}

module.exports = PathfindingService;
