const axios = require('axios'); // Ensure axios is installed or use fetch
const path = require('path');
const HgtReader = require('./HgtReader');

// Open-Meteo Elevation API
// Docs: https://open-meteo.com/en/docs/elevation-api
const API_URL = 'https://api.open-meteo.com/v1/elevation';

class ElevationService {
    constructor(database) {
        this.db = database;
        // Data directory mapped in Docker
        const dataDir = process.env.ELEVATION_PATH || path.join(__dirname, '../../data/elevation');
        // In Docker: /app/data/elevation. Locally: ../../terra-data/elevation via relative path if running locally outside docker?
        // Let's use absolute path for Docker, or relative for local dev.
        // Dockerfile WORKDIR is /app.
        // So /app/data/elevation is good.
        // Local dev: project_root/terra-data/elevation.
        // server.js is in project_root/terra-server.
        // So ../../terra-data/elevation seems correct for local dev structure if running from terra-server folder.

        // Better: Use an env var or default to absolute path in container, relative in dev.
        // Just use the mapped path logic.
        this.hgtReader = new HgtReader(process.env.ELEVATION_DATA_DIR || '/app/data/elevation');
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
