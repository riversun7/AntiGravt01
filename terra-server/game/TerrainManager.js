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
     * Get Terrain Info for multiple coordinates in batch.
     * @param {Array<{lat: number, lng: number}>} locations 
     * @returns {Promise<Array<{type: string, elevation: number, isOverride: boolean}>>}
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
