const axios = require('axios'); // Ensure axios is installed or use fetch
const path = require('path');
const fs = require('fs');
const HgtReader = require('./HgtReader');

// Open-Meteo Elevation API
// Docs: https://open-meteo.com/en/docs/elevation-api
const API_URL = 'https://api.open-meteo.com/v1/elevation';

class ElevationService {
    constructor(database) {
        this.db = database;

        // Robust Path Resolution
        // Docker: /app/data/elevation
        // Local:  [ProjectRoot]/terra-data/elevation (Relative to this file: ../../../terra-data/elevation)
        // Note: This file is in terra-server/game/ElevationService.js
        // ../../ goes to terra-server root. ../../../ goes to Project root.

        let defaultPath;
        if (process.env.NODE_ENV === 'production' && process.env.ELEVATION_PATH) {
            defaultPath = process.env.ELEVATION_PATH;
        } else if (fs.existsSync('/app/data/elevation')) {
            defaultPath = '/app/data/elevation';
        } else {
            // Local Fallback: resolve from this file's location to project root
            defaultPath = path.resolve(__dirname, '../../terra-data/elevation');
            // Note: terra-server/game/.. -> terra-server/.. -> terra-server -> 
            // Wait. __dirname is terra-server/game. 
            // path.join(__dirname, '../../terra-data') -> terra-server/game/../../terra-data -> terra-server/../terra-data -> root/terra-data.
            // Correct.
        }

        const dataDir = process.env.ELEVATION_DATA_DIR || defaultPath;

        console.log(`[ElevationService] 🌍 HGT Data Directory: "${dataDir}"`);

        // Debug: Check if directory exists and list sample
        if (fs.existsSync(dataDir)) {
            const files = fs.readdirSync(dataDir).slice(0, 3);
            console.log(`[ElevationService] ✅ Directory found. Sample files: ${files.join(', ')}`);
        } else {
            console.warn(`[ElevationService] ❌ Directory NOT found at "${dataDir}". check paths! usage: ${process.cwd()}`);
        }

        this.hgtReader = new HgtReader(dataDir);
    }

    /**
     * Get elevation for a single point.
     * Priority: Local HGT -> DB Cache -> API
     * @param {number} lat 
     * @param {number} lng 
     * @returns {Promise<number>} Elevation in meters
     */
    async getElevation(lat, lng) {
        // 1. Try Local HGT File (Fastest, High Precision)
        const localHeight = this.hgtReader.getElevation(lat, lng);
        if (localHeight !== null) {
            return localHeight;
        }

        // 2. Check Cache
        const cache = this.db.prepare('SELECT elevation FROM elevation_cache WHERE lat = ? AND lng = ?').get(lat, lng);
        if (cache) {
            return cache.elevation;
        }

        // 3. Fetch from API
        try {
            console.log(`[Elevation] Fetching from API for ${lat.toFixed(4)}, ${lng.toFixed(4)}...`);
            const response = await axios.get(API_URL, {
                params: {
                    latitude: lat,
                    longitude: lng
                },
                timeout: 3000 // 3s timeout
            });

            if (response.data && response.data.elevation && response.data.elevation.length > 0) {
                const elevation = response.data.elevation[0];

                // 4. Save to Cache
                this.db.prepare('INSERT OR REPLACE INTO elevation_cache (lat, lng, elevation) VALUES (?, ?, ?)')
                    .run(lat, lng, elevation);

                return elevation;
            }
            return 0; // Default if no data
        } catch (error) {
            console.error(`[ElevationService] API Error:`, error.message);
            return 0; // Fallback
        }
    }
}

module.exports = ElevationService;
