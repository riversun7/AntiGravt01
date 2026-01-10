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
        // 1. Grid Override Logic REMOVED (User requested No Grid)
        // const x = Math.floor((lng + 180) / 360 * 160);
        // const y = Math.floor((90 - lat) / 180 * 80);

        // const override = this.db.prepare('SELECT terrain_type FROM tile_overrides WHERE x = ? AND y = ?').get(x, y);
        // if (override && override.terrain_type) { ... }

        // 2. Automated Check via Elevation
        const elevation = await this.elevationService.getElevation(lat, lng);

        // Logic:
        // <= 0 : WATER
        // > 1000 : MOUNTAIN
        // Else : PLAIN (or FOREST based on Lat/Noise in future Phase 2)

        let type = 'PLAIN';
        if (elevation <= 0) {
            type = 'WATER';
        } else if (elevation >= 1000) {
            type = 'MOUNTAIN';
        }

        return {
            type: type,
            elevation: elevation,
            isOverride: false
        };
    }
}

module.exports = TerrainManager;
