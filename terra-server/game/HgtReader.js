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
 * HGT Reader for SRTM Data (SRTM1 or SRTM3).
 * SRTM files are named NxxEyyy.hgt.
 * Data is signed 16-bit integer, big-endian.
 * 
 * Grid sizes:
 * SRTM1 (1 arc-second): 3601 x 3601
 * SRTM3 (3 arc-seconds): 1201 x 1201
 */
class HgtReader {
    constructor(dataDir) {
        this.dataDir = dataDir;
        this.cache = new Map(); // Cache file descriptors or small chunks if needed?
        // Actually, for random access, fs.open -> fs.read is best.
        // We can keep file descriptors open for active tiles?
        // For simplicity and stability, let's open/read/close or use fs.readFileSync if files are small (2.8MB).
        // 2.8MB is small enough to keep in memory if frequently accessed.
        // Let's implement a simple memory cache for loaded tiles.

        // Ensure directory exists
        if (!fs.existsSync(dataDir)) {
            try {
                fs.mkdirSync(dataDir, { recursive: true });
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
    getElevation(lat, lng) {
        const floorLat = Math.floor(lat);
        const floorLng = Math.floor(lng);

        // Construct filename: N37E127.hgt
        const latPrefix = floorLat >= 0 ? 'N' : 'S';
        const lngPrefix = floorLng >= 0 ? 'E' : 'W';

        const latStr = Math.abs(floorLat).toString().padStart(2, '0');
        const lngStr = Math.abs(floorLng).toString().padStart(3, '0');

        const filename = `${latPrefix}${latStr}${lngPrefix}${lngStr}.hgt`;
        const tileKey = filename;

        // Check Memory Cache
        if (this.cache.has(tileKey)) {
            return this.readFromBuffer(this.cache.get(tileKey), lat, lng);
        }

        // Try Load File
        const filePath = path.join(this.dataDir, filename);
        if (fs.existsSync(filePath)) {
            try {
                // Read entire file into buffer (2.8MB or 25MB)
                // SRTM3 = 1201*1201*2 = 2.8MB. 
                // SRTM1 = 3601*3601*2 = 25MB.
                // It's safe to cache a few of these.

                // LRU Cache or Size Limit Logic could be added here.
                // For now, just cache.
                const buffer = fs.readFileSync(filePath);

                // Validate size to determine resolution
                if (buffer.length !== 1201 * 1201 * 2 && buffer.length !== 3601 * 3601 * 2) {
                    console.warn(`[HgtReader] Invalid HGT file size for ${filename}: ${buffer.length}`);
                    return null;
                }

                console.log(`[HgtReader] Loaded local terrain tile: ${filename}`);
                this.cache.set(tileKey, buffer);
                return this.readFromBuffer(buffer, lat, lng);

            } catch (e) {
                console.error(`[HgtReader] Error reading ${filename}:`, e);
                return null;
            }
        } else {
            // Debug log (Only print once per file to avoid spam? Or just print for now to debug user issue)
            // console.log(`[HgtReader] File not found: ${filePath}`); 
        }

        return null; // File not found
    }

    readFromBuffer(buffer, lat, lng) {
        const size = Math.sqrt(buffer.length / 2); // 1201 or 3601

        // SRTM data is arranged from North to South, West to East.
        // Row 0 is the Northernmost latitude (e.g. 38.000)
        // Col 0 is the Westernmost longitude (e.g. 127.000)

        const latDiff = lat - Math.floor(lat);
        const lngDiff = lng - Math.floor(lng);

        // Row calculation: (1 - latDiff) * (size - 1)
        // Because Row 0 is Top (High Lat), Row Max is Bottom (Low Lat)
        const row = Math.round((1 - latDiff) * (size - 1));
        const col = Math.round(lngDiff * (size - 1));

        // Safety Clamp
        const validRow = Math.max(0, Math.min(size - 1, row));
        const validCol = Math.max(0, Math.min(size - 1, col));

        const offset = (validRow * size + validCol) * 2;

        // Read Int16 Big Endian
        const elevation = buffer.readInt16BE(offset);

        // SRTM void value is often -32768
        if (elevation === -32768) return 0; // Void fill (Sea or Unknown)

        return elevation;
    }
}

module.exports = HgtReader;
