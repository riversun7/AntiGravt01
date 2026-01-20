const fs = require('fs');
const path = require('path');

/**
 * @file HgtReader.js
 * @description SRTM HGT 포맷(지형 고도 데이터) 파일 리더입니다.
 * @role HGT 바이너리 파일 파싱 및 고도 추출
 * @dependencies fs, path
 * @referenced_by ElevationService.js
 * @status Active
 * @analysis 
 * - Big-Endian 16-bit Signed Integer 포맷을 직접 읽어 처리합니다.
 * - 파일 읽기 시 Sync 방식을 사용하므로 대량 요청 시 이벤트 루프 블로킹 주의가 필요하지만, 현재는 캐싱(Map)으로 완화하고 있습니다.
 * - 2.8MB(SRTM3) 파일 크기는 메모리에 캐싱해도 부담이 적습니다.
 */
/**
 * @class HgtReader
 * @description SRTM(Shuttle Radar Topography Mission) 고도 데이터를 읽는 클래스
 * 
 * SRTM HGT 파일 설명:
 * - 파일명 형식: NxxEyyy.hgt (예: N37E127.hgt는 북위 37~38도, 동경 127~128도 지역)
 * - 데이터 형식: 16비트 부호있는 정수(Signed Int16), Big-Endian 바이트 순서
 * - 그리드 크기:
 *   * SRTM1 (1 arc-second, 약 30m 해상도): 3601 x 3601 픽셀
 *   * SRTM3 (3 arc-seconds, 약 90m 해상도): 1201 x 1201 픽셀
 * 
 * @referenced_by ElevationService.js - 실제 고도 조회 시 이 클래스를 사용
 * @references fs (Node.js 파일시스템), path (경로 유틸리티)
 */
class HgtReader {
    /**
     * @constructor
     * @param {string} dataDir - HGT 파일들이 저장된 디렉토리 경로
     * 
     * 초기화 작업:
     * 1. 데이터 디렉토리 경로 저장
     * 2. 파일 캐시용 Map 객체 생성
     * 3. 디렉토리 존재 여부 확인 및 생성
     */
    constructor(dataDir) {
        // HGT 파일들이 있는 디렉토리 경로 (예: './terra-data')
        this.dataDir = dataDir;

        /**
         * @property {Map} cache - 로드된 HGT 파일 버퍼를 메모리에 캐싱
         * 
         * 캐싱 이유:
         * - HGT 파일은 SRTM3 기준 약 2.8MB로 작아서 메모리에 보관 가능
         * - 동일 지역 반복 조회 시 디스크 I/O를 줄여 성능 향상
         * - Key: 파일명 (예: 'N37E127.hgt')
         * - Value: Buffer 객체 (파일 전체 내용)
         * 
         * 개선 가능 사항:
         * - LRU(Least Recently Used) 캐시로 메모리 사용량 제한
         * - 현재는 한번 로드된 파일은 프로세스 종료까지 메모리에 유지됨
         */
        this.cache = new Map();

        // 데이터 디렉토리가 없으면 자동 생성
        // (지형 데이터 파일을 수동으로 넣어야 하므로 빈 폴더라도 미리 만듦)
        if (!fs.existsSync(dataDir)) {
            try {
                fs.mkdirSync(dataDir, { recursive: true });
                console.log(`[HgtReader] Created data directory: ${dataDir}`);
            } catch (e) {
                console.error("[HgtReader] Failed to create data dir:", e);
            }
        }
    }

    /**
     * @function getElevation
     * @description 특정 위경도의 고도를 HGT 파일에서 추출합니다.
     * @param {number} lat - 위도
     * @param {number} lng - 경도
     * @returns {number|null} 고도(m) 또는 파일 없음 시 null
     * @analysis 
     * - 파일명을 위경도 기반으로 계산하여 매핑합니다. (예: N37E127.hgt)
     * - `readFromBuffer`를 통해 바이너리 오프셋을 계산합니다.
     */
    /**
     * @method getElevation
     * @description 특정 위경도 좌표의 지표 고도를 미터 단위로 반환
     * 
     * @param {number} lat - 위도 (Latitude, -90 ~ +90)
     * @param {number} lng - 경도 (Longitude, -180 ~ +180)
     * @returns {number|null} 해당 지점의 고도(미터) 또는 데이터 없음 시 null
     * 
     * @example
     * const reader = new HgtReader('./terra-data');
     * const elevation = reader.getElevation(37.5665, 126.9780); // 서울 시청 약 38m
     * 
     * 처리 흐름:
     * 1. 위경도를 정수로 내림하여 해당하는 1도 타일 결정
     * 2. 타일 파일명 생성 (예: N37E126.hgt)
     * 3. 캐시에서 버퍼 찾기
     * 4. 없으면 파일 로드 후 캐시에 저장
     * 5. 버퍼에서 정확한 픽셀 위치 계산하여 고도 추출
     */
    getElevation(lat, lng) {
        // === 1단계: 타일 파일명 계산 ===
        // 위도 37.5665 -> 37, 경도 126.9780 -> 126
        // 각 HGT 파일은 정수 위경도 기준 1도 x 1도 영역을 커버함
        const floorLat = Math.floor(lat);
        const floorLng = Math.floor(lng);

        // 파일명 접두사 결정: 북위/남위, 동경/서경
        // 예: 북위는 'N', 남위는 'S', 동경은 'E', 서경은 'W'
        const latPrefix = floorLat >= 0 ? 'N' : 'S';
        const lngPrefix = floorLng >= 0 ? 'E' : 'W';

        // 절대값으로 변환 후 자릿수 맞추기
        // 위도: 2자리 (00~90), 경도: 3자리 (000~180)
        const latStr = Math.abs(floorLat).toString().padStart(2, '0');
        const lngStr = Math.abs(floorLng).toString().padStart(3, '0');

        // 최종 파일명 조합 (예: N37E126.hgt)
        const filename = `${latPrefix}${latStr}${lngPrefix}${lngStr}.hgt`;
        const tileKey = filename; // 캐시 키로도 사용

        // === 2단계: 메모리 캐시 확인 ===
        // 이미 로드된 타일이면 즉시 반환 (디스크 I/O 생략)
        if (this.cache.has(tileKey)) {
            return this.readFromBuffer(this.cache.get(tileKey), lat, lng);
        }

        // === 3단계: 파일 시스템에서 로드 시도 ===
        const filePath = path.join(this.dataDir, filename);
        if (fs.existsSync(filePath)) {
            try {
                /**
                 * 파일 전체를 메모리로 읽기
                 * 
                 * 파일 크기:
                 * - SRTM3 (1201x1201): 1201 * 1201 * 2 = 2,884,802 bytes (약 2.8MB)
                 * - SRTM1 (3601x3601): 3601 * 3601 * 2 = 25,934,402 bytes (약 25MB)
                 * 
                 * 각 픽셀은 2바이트(16비트 정수)이므로 크기 = 픽셀수 * 2
                 * 
                 * 메모리 사용량:
                 * - SRTM3 파일 10개 캐싱해도 약 28MB로 허용 가능
                 * - 실제로는 플레이어 주변 타일 2~3개만 캐싱됨
                 */
                const buffer = fs.readFileSync(filePath);

                // === 4단계: 파일 유효성 검증 ===
                // 예상 크기와 다르면 손상된 파일로 간주
                const validSRTM3 = buffer.length === 1201 * 1201 * 2; // 2.8MB
                const validSRTM1 = buffer.length === 3601 * 3601 * 2; // 25MB

                if (!validSRTM3 && !validSRTM1) {
                    console.warn(`[HgtReader] Invalid HGT file size for ${filename}: ${buffer.length} bytes`);
                    console.warn(`[HgtReader] Expected: ${1201 * 1201 * 2} (SRTM3) or ${3601 * 3601 * 2} (SRTM1)`);
                    return null;
                }

                console.log(`[HgtReader] Loaded terrain tile: ${filename} (${buffer.length} bytes)`);

                // === 5단계: 캐시에 저장 ===
                this.cache.set(tileKey, buffer);

                // === 6단계: 버퍼에서 고도 추출 ===
                return this.readFromBuffer(buffer, lat, lng);

            } catch (e) {
                console.error(`[HgtReader] Error reading ${filename}:`, e);
                return null;
            }
        } else {
            // 파일이 없는 경우 (바다이거나 데이터 미다운로드)
            // 스팸 방지를 위해 로그 주석 처리
            // console.log(`[HgtReader] File not found: ${filePath}`);
        }

        // 파일을 찾지 못함 - 기본 고도로 처리됨 (호출측에서 0으로 처리)
        return null;
    }

    /**
     * @method readFromBuffer
     * @description 메모리에 로드된 HGT 버퍼에서 특정 좌표의 고도값을 읽기
     * 
     * @param {Buffer} buffer - HGT 파일의 전체 내용 (바이너리 버퍼)
     * @param {number} lat - 조회할 위도
     * @param {number} lng - 조회할 경도
     * @returns {number} 해당 지점의 고도(미터)
     * 
     * SRTM 데이터 구조:
     * - 2차원 그리드로 배열됨 (행렬 형태)
     * - Row(행): 북쪽에서 남쪽 방향 (0번 행 = 최북단, 마지막 행 = 최남단)
     * - Col(열): 서쪽에서 동쪽 방향 (0번 열 = 최서단, 마지막 열 = 최동단)
     * - 각 픽셀: 16비트 부호있는 정수(Big-Endian), 고도(미터) 표현
     * 
     * 예시: N37E127.hgt 파일
     * - Row 0, Col 0 = 북위 38.0도, 동경 127.0도
     * - Row 1200, Col 1200 = 북위 37.0도, 동경 128.0도 (SRTM3 기준)
     */
    readFromBuffer(buffer, lat, lng) {
        // === 1단계: 해상도 자동 감지 ===
        // 버퍼 크기로부터 그리드 크기 역산
        // size = sqrt(버퍼길이 / 2) → SRTM3이면 1201, SRTM1이면 3601
        const size = Math.sqrt(buffer.length / 2);

        // === 2단계: 타일 내 상대 위치 계산 ===
        // 예: lat=37.5665, floor(lat)=37 → latDiff=0.5665
        // 0.0(남쪽 경계) ~ 1.0(북쪽 경계) 범위의 값
        const latDiff = lat - Math.floor(lat); // 위도의 소수 부분 (0~1)
        const lngDiff = lng - Math.floor(lng); // 경도의 소수 부분 (0~1)

        // === 3단계: 행(Row) 계산 ===
        /**
         * SRTM 데이터는 북쪽부터 시작하므로 위도 보정 필요
         * 
         * 예시 (SRTM3, size=1201):
         * - latDiff=0.0 (타일 남쪽) → row = (1-0.0)*1200 = 1200 (마지막 행)
         * - latDiff=0.5 (타일 중앙) → row = (1-0.5)*1200 = 600
         * - latDiff=1.0 (타일 북쪽) → row = (1-1.0)*1200 = 0 (첫 행)
         * 
         * 1을 빼는 이유: 인덱스는 0부터 시작 (0~1200)
         */
        const row = Math.round((1 - latDiff) * (size - 1));

        // === 4단계: 열(Col) 계산 ===
        /**
         * 경도는 서쪽에서 동쪽이므로 그대로 사용
         * 
         * 예시:
         * - lngDiff=0.0 (타일 서쪽) → col = 0*1200 = 0 (첫 열)
         * - lngDiff=0.5 (타일 중앙) → col = 0.5*1200 = 600
         * - lngDiff=1.0 (타일 동쪽) → col = 1.0*1200 = 1200 (마지막 열)
         */
        const col = Math.round(lngDiff * (size - 1));

        // === 5단계: 범위 검증 및 보정 ===
        // 반올림 오차나 경계 케이스로 인한 범위 초과 방지
        // 0 <= row, col < size 범위로 제한
        const validRow = Math.max(0, Math.min(size - 1, row));
        const validCol = Math.max(0, Math.min(size - 1, col));

        // === 6단계: 바이너리 오프셋 계산 ===
        /**
         * 2차원 그리드를 1차원 배열로 접근
         * 
         * 공식: offset = (row * 열개수 + col) * 2
         * - row * size: 해당 행까지 건너뜀
         * - + col: 해당 열 위치
         * - * 2: 각 값이 2바이트이므로
         * 
         * 예: row=600, col=500, size=1201
         * offset = (600 * 1201 + 500) * 2 = 1,441,200 바이트
         */
        const offset = (validRow * size + validCol) * 2;

        // === 7단계: 16비트 정수 읽기 ===
        /**
         * Big-Endian 형식으로 2바이트 읽기
         * 
         * Big-Endian: 상위 바이트가 먼저 옴
         * 예: 0x0100 = 256 (Little-Endian이면 1)
         * 
         * readInt16BE: Buffer 메서드로 부호있는 16비트 정수 반환
         * 범위: -32768 ~ +32767 (미터)
         */
        const elevation = buffer.readInt16BE(offset);

        // === 8단계: 특수값 처리 ===
        /**
         * SRTM Void Value: -32768
         * 
         * 의미: 데이터 없음 (바다, 호수, 데이터 수집 실패 등)
         * 처리: 해수면(0m)으로 대체
         * 
         * 참고: 일부 지역은 실제 음수 고도도 있음 (사해: -430m)
         * 하지만 -32768은 특별한 값으로 예약됨
         */
        if (elevation === -32768) {
            return 0; // Void 값은 해수면으로 간주
        }

        // === 9단계: 고도 반환 ===
        return elevation; // 미터 단위 고도
    }
}

module.exports = HgtReader;
