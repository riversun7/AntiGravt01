/**
 * @file TerrainManager.js
 * @description 게임 내 지형 정보(타입, 고도)를 관리하는 매니저입니다.
 * @role 고도 서비스(ElevationService)를 추상화하여 게임 로직에 필요한 지형 타입(PLAIN, MOUNTAIN, WATER)을 반환
 * @dependencies ElevationService
 * @referenced_by server.js, PathfindingService.js
 * @status Active
 * @analysis 
 * - 현재는 고도(Elevation)만으로 지형 타입을 단순 판별하고 있습니다.
 * - 추후 타일 오버라이드(Tile Overrides, DB) 로직이 추가되면 특정 좌표의 지형을 강제 설정하는 기능이 활성화될 예정입니다 (현재 코드 주석 처리됨).
 */

const ElevationService = require('./ElevationService');

class TerrainManager {
    constructor(db) {
        this.db = db;
        this.elevationService = new ElevationService(db);
    }

    /**
     * Get Terrain Info for a coordinate.
     * @param {number} lat 
     * @param {number} lng 
     * @returns {Promise<Object>} { type: 'PLAIN'|'MOUNTAIN'|'WATER', elevation: number }
     */
    async getTerrainInfo(lat, lng) {
        return (await this.getTerrainInfos([{ lat, lng }]))[0];
    }

    /**
     * @function getTerrainInfos
     * @description 다수 좌표의 지형 정보를 일괄 조회합니다.
     * @param {Array<{lat: number, lng: number}>} locations - 좌표 배열
     * @returns {Promise<Array<{type: string, elevation: number, isOverride: boolean}>>} 지형 정보 배열
     * @analysis 
     * - 고도를 기준으로 0 미만은 WATER(물), 1000 이상은 MOUNTAIN(산), 그 외는 PLAIN(평지)으로 판정합니다.
     * - 게임 밸런스에 맞춰 임계값을 조정할 수 있습니다.
     */
    async getTerrainInfos(locations) {
        // 1. Grid Override Logic (Skipped as requested)

        // 2. Automated Check via Elevation (Batch)
        const elevations = await this.elevationService.getElevations(locations);

        return elevations.map(elevation => {
            let type = 'PLAIN';
            if (elevation < 0) {
                type = 'WATER';
            } else if (elevation >= 1000) {
                type = 'MOUNTAIN';
            }

            return {
                type: type,
                elevation: elevation,
                isOverride: false
            };
        });
    }
}

module.exports = TerrainManager;
