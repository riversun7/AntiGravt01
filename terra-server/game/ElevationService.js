/**
 * @file ElevationService.js
 * @description 전세계 지형 고도 데이터를 제공하는 서비스
 * @role 고도 데이터 조회 (로컬 HGT 파일 우선, 없을 시 Open-Meteo API, DB 캠싱)
 * @dependencies axios (외부 API 요청), HgtReader (로컬 파일 읽기), database (SQLite 캠싱)
 * @referenced_by server.js - API 라우트에서 사용
 * @references HgtReader.js, database.js
 * @status Active
 * 
 * @analysis
 * 고도 데이터 조회 전략 (3단 폴백):
 * 1. **로컬 HGT 파일**: 가장 빠르고 정확함 (메모리 캠싱)
 * 2. **DB 캠시**: 이전에 API로 가져온 데이터 재사용 (디스크 I/O)
 * 3. **Open-Meteo API**: 외부 서비스 호출 (네트워크 비용)
 * 
 * 장점:
 * - 네트워크 없이 오프라인 실행 가능 (HGT 파일만 있으면)
 * - API 제한(Rate Limit)에서 자유로운 대량 조회
 * - DB 캠싱으로 반복 조회 최적화
 * 
 * Open-Meteo API 정보:
 * - 무료 타일: https://open-meteo.com/en/docs/elevation-api
 * - 요청 예시: GET https://api.open-meteo.com/v1/elevation?latitude=37.5&longitude=126.9
 * - 응답 형식: {"elevation": [38.2]}
 */

const axios = require('axios'); // HTTP 요청 라이브러리
const path = require('path'); // 파일 경로 유틸리티
const fs = require('fs'); // 파일시스템 접근
const HgtReader = require('./HgtReader'); // 로컬 HGT 파일 리더

// Open-Meteo 고도 API 엔드포인트
// 공식 문서: https://open-meteo.com/en/docs/elevation-api
const API_URL = 'https://api.open-meteo.com/v1/elevation';

/**
 * @class ElevationService
 * @description 고도 데이터 조회를 관리하는 메인 서비스 클래스
 */
class ElevationService {
    /**
     * @constructor
     * @param {object} database - SQLite 데이터베이스 인스턴스 (better-sqlite3)
     * 
     * 초기화 작업:
     * 1. 데이터베이스 참조 저장
     * 2. HGT 데이터 디렉토리 경로 결정
     * 3. HgtReader 인스턴스 생성
     */
    constructor(database) {
        // DB 캐시 존장을 위한 데이터베이스 참조
        this.db = database;

        /**
         * HGT 데이터 디렉토리 경로 결정 로직
         * 
         * 우선순위:
         * 1. 환경변수 ELEVATION_DATA_DIR (사용자 명시적 설정)
         * 2. Docker 환경: /app/data/elevation
         * 3. 로컬 개발: 프로젝트루트/terra-data/elevation
         * 
         * 경로 구조:
         * - 현재 파일: terra-server/game/ElevationService.js
         * - __dirname: terra-server/game
         * - ../../terra-data: terra-server/game/../../terra-data = 프로젝트루트/terra-data
         */
        let defaultPath;

        // 1단계: 프로덕션 환경 및 환경변수 확인
        if (process.env.NODE_ENV === 'production' && process.env.ELEVATION_PATH) {
            defaultPath = process.env.ELEVATION_PATH;
            console.log(`[ElevationService] Using ELEVATION_PATH: ${defaultPath}`);
        }
        // 2단계: Docker 환경 감지
        else if (fs.existsSync('/app/data/elevation')) {
            defaultPath = '/app/data/elevation';
            console.log(`[ElevationService] Detected Docker environment`);
        }
        // 3단계: 로컬 개발 폴백
        else {
            /**
             * 프로젝트 구조:
             * AntiGravt01/
             * ├── terra-server/
             * │   ├── game/
             * │   │   └── ElevationService.js  ← 현재 파일
             * │   └── ...
             * └── terra-data/
             *     └── elevation/
             *         ├── N37E126.hgt
             *         ├── N37E127.hgt
             *         └── ...
             * 
             * __dirname = /Users/.../AntiGravt01/terra-server/game
             * ../.. = /Users/.../AntiGravt01
             * ../../terra-data/elevation = /Users/.../AntiGravt01/terra-data/elevation
             */
            defaultPath = path.resolve(__dirname, '../../terra-data/elevation');
            console.log(`[ElevationService] Using local path: ${defaultPath}`);
        }

        // 최종 경로 결정: 환경변수 > defaultPath
        const dataDir = process.env.ELEVATION_DATA_DIR || defaultPath;

        console.log(`[ElevationService] 🌍 HGT Data Directory: "${dataDir}"`);

        // 디렉토리 존재 여부 확인 및 디버깅 정보 출력
        if (fs.existsSync(dataDir)) {
            // 디렉토리 내 파일 목록 일부 출력 (최대 3개)
            const files = fs.readdirSync(dataDir).slice(0, 3);
            console.log(`[ElevationService] ✅ Directory found. Sample files: ${files.join(', ')}`);
        } else {
            /**
             * 디렉토리가 없는 경우:
             * - HGT 파일을 수동으로 다운로드하여 배치해야 함
             * - 또는 Open-Meteo API만 사용 (네트워크 필수)
             */
            console.warn(`[ElevationService] ❌ Directory NOT found at "${dataDir}"`);
            console.warn(`[ElevationService] Current working directory: ${process.cwd()}`);
            console.warn(`[ElevationService] HGT files needed! Download from: https://srtm.csi.cgiar.org/`);
        }

        // HGT 파일 리더 초기화
        this.hgtReader = new HgtReader(dataDir);
    }

    /**
     * Get elevation for a single point.
     * Priority: Local HGT -> DB Cache -> API
     * @param {number} lat 
     * @param {number} lng 
     * @returns {Promise<number>} Elevation in meters
     */
    /**
     * @method getElevations
     * @description 다수 좌표의 고도를 일괄 조회 (배치 처리 최적화)
     * 
     * @param {Array<{lat: number, lng: number}>} locations - 조회할 좌표 배열
     * @returns {Promise<Array<number>>} 입력 순서와 일치하는 고도(미터) 배열
     * 
     * @example
     * const service = new ElevationService(db);
     * const elevations = await service.getElevations([
     *   {lat: 37.5665, lng: 126.9780}, // 서울 시청
     *   {lat: 35.1796, lng: 129.0756}  // 부산 시청
     * ]);
     * // 결과: [38, 2] (미터)
     * 
     * 처리 전략:
     * 1. **로컬 HGT 검색**: 가장 빠름 (메모리 접근)
     * 2. **DB 캠시 검색**: 빠름 (디스크 I/O)
     * 3. **API 배치 요청**: 누락된 데이터만 일괄 요청
     * 4. **안전 폴백**: 모든 방법 실패 시 10m (평지) 반환
     * 
     * @analysis
     * - 50개 묶음(Chunk)으로 나누어 API 요청하는 것은 URL 길이 제한 및 타임아웃 방지
     * - Transaction 사용으로 DB 삽입 성능 향상
     * - 실패 시 10m로 반환하는 것은 0m(바다)보다 안전한 기본값
     */
    async getElevations(locations) {
        // === 1단계: 결과 배열 초기화 ===
        // 입력 순서와 동일한 인덱스로 결과 저장
        const results = new Array(locations.length).fill(null);

        // API 요청이 필요한 위치들의 인덱스
        const missingIndices = [];

        // === 2단계: 로컬 HGT 및 DB 캠시 검색 ===
        /**
         * 각 좌표에 대해:
         * 1. HGT 파일에서 검색 (가장 빠름)
         * 2. DB 캠시에서 검색 (빠름)
         * 3. 둘 다 없으면 missingIndices에 추가
         */
        for (let i = 0; i < locations.length; i++) {
            const { lat, lng } = locations[i];

            // 시도 1: 로컬 HGT 파일에서 읽기
            const localHeight = this.hgtReader.getElevation(lat, lng);
            if (localHeight !== null) {
                results[i] = localHeight;
                continue; // 다음 좌표로
            }

            // 시도 2: DB 캠시에서 조회
            /**
             * elevation_cache 테이블 구조:
             * - lat: 위도 (REAL)
             * - lng: 경도 (REAL)
             * - elevation: 고도 (INTEGER, 미터)
             * - PRIMARY KEY: (lat, lng)
             */
            const cache = this.db.prepare('SELECT elevation FROM elevation_cache WHERE lat = ? AND lng = ?').get(lat, lng);
            if (cache) {
                results[i] = cache.elevation;
                continue;
            }

            // 시도 3: 둘 다 실패 - API 요청 목록에 추가
            missingIndices.push(i);
        }

        // === 3단계: 누락된 데이터 API로 배치 조회 ===
        if (missingIndices.length > 0) {
            console.log(`[ElevationService] Need to fetch ${missingIndices.length} points from API`);

            try {
                /**
                 * Chunk 분할 이유:
                 * 
                 * 1. **URL 길이 제한**: 브라우저/서버는 일반적으로 2048자 제한
                 *    - 예: latitude=37.5,37.6,37.7,... 형식이 길어질 수 있음
                 * 
                 * 2. **타임아웃 방지**: 대량 데이터 요청 시 응답 시간 초과
                 * 
                 * 3. **에러 격리**: 한 명령어 실패해도 다른 명령어는 정상 처리
                 * 
                 * CHUNK_SIZE = 50: 경험적으로 안정적인 크기
                 * - 50 좌표 * 약 20자/좌표 = 1000자 (안전)
                 */
                const CHUNK_SIZE = 50;

                // 메락 단위로 API 요청
                for (let c = 0; c < missingIndices.length; c += CHUNK_SIZE) {
                    // 현재 콘크의 인덱스들 추출
                    const chunkIndices = missingIndices.slice(c, c + CHUNK_SIZE);

                    /**
                     * API 요청 형식:
                     * GET /v1/elevation?latitude=37.5,37.6,37.7&longitude=126.9,127.0,127.1
                     * 
                     * 응답 형식:
                     * {
                     *   "elevation": [38.2, 42.1, 15.7],
                     *   "latitude": [37.5, 37.6, 37.7],
                     *   "longitude": [126.9, 127.0, 127.1]
                     * }
                     */
                    const lats = chunkIndices.map(idx => locations[idx].lat).join(',');
                    const lngs = chunkIndices.map(idx => locations[idx].lng).join(',');

                    console.log(`[ElevationService] Batch fetching chunk ${Math.floor(c / CHUNK_SIZE) + 1}: ${chunkIndices.length} points`);

                    // API 요청 (타임아웃 5초)
                    const response = await axios.get(API_URL, {
                        params: { latitude: lats, longitude: lngs },
                        timeout: 5000 // 5초 타임아웃
                    });

                    // === 4단계: 응답 데이터 처리 및 DB 캠싱 ===
                    if (response.data && response.data.elevation) {
                        const elevations = response.data.elevation;

                        /**
                         * Transaction 사용 이유:
                         * - 다수 INSERT를 한 번에 커밋하여 성능 향상
                         * - 일반 INSERT: 1개당 수밀리초
                         * - Transaction: 50개를 한 번에 커밋, 전체 1밀리초
                         * 
                         * INSERT OR REPLACE:
                         * - 동일 좌표가 이미 있으면 업데이트
                         * - 없으면 새로 삽입
                         */
                        const insert = this.db.prepare('INSERT OR REPLACE INTO elevation_cache (lat, lng, elevation) VALUES (?, ?, ?)');
                        const tx = this.db.transaction(() => {
                            chunkIndices.forEach((originalIdx, k) => {
                                const val = elevations[k]; // 해당 크의 k번째 고도
                                results[originalIdx] = val; // 결과에 저장
                                insert.run(locations[originalIdx].lat, locations[originalIdx].lng, val); // DB에 캠싱
                            });
                        });
                        tx(); // Transaction 실행

                        console.log(`[ElevationService] Cached ${chunkIndices.length} elevations to DB`);
                    }
                }
            } catch (error) {
                // === 5단계: 에러 처리 및 폴백 ===
                console.error(`[ElevationService] Batch API Error:`, error.message);

                /**
                 * 폴백 전략:
                 * - 0m(바다) 대신 10m(평지)
                 * 
                 * 이유:
                 * - 대부분의 육지는 해수면 이상
                 * - 0m은 '데이터 없음'으로 오해 가능
                 * - 10m는 '대략 평지'로 합리적인 기본값
                 */
                missingIndices.forEach(idx => {
                    if (results[idx] === null) {
                        results[idx] = 10; // 평지 기본값
                    }
                });
            }
        }

        // === 6단계: 최종 null 체크 및 반환 ===
        /**
         * 예상 케이스:
         * - 모든 데이터가 정상 조회된 경우: results에 null 없음
         * 
         * 비정상 케이스:
         * - API 실패 후에도 null이 남아있는 경우 (드물지만 불가능하지 않음)
         * - 안전하게 10m로 변환
         */
        return results.map(r => r === null ? 10 : r);
    }

    /**
     * Get elevation for a single point.
     * Priority: Local HGT -> DB Cache -> API
     * @param {number} lat 
     * @param {number} lng 
     * @returns {Promise<number>} Elevation in meters
     */
    async getElevation(lat, lng) {
        return (await this.getElevations([{ lat, lng }]))[0];
    }
}

module.exports = ElevationService;
