const axios = require('axios'); // Ensure axios is installed or use fetch
const db = require('../database');

// Open-Meteo Elevation API
// Docs: https://open-meteo.com/en/docs/elevation-api
const API_URL = 'https://api.open-meteo.com/v1/elevation';

class ElevationService {
    constructor(database) {
        this.db = database;
    }

    /**
     * Get elevation for a single point.
     * Checks cache first, then API.
     * @param {number} lat 
     * @param {number} lng 
     * @returns {Promise<number>} Elevation in meters
     */
    async getElevation(lat, lng) {
        // 1. Check Cache
        // Round to 4 decimal places to group close requests? 
        // For game tiles, exact lat/lng from grid center is best.
        const cache = this.db.prepare('SELECT elevation FROM elevation_cache WHERE lat = ? AND lng = ?').get(lat, lng);
        if (cache) {
            return cache.elevation;
        }

        // 2. Fetch from API
        try {
            // Rate limit handling might be needed for bulk, but for single clicks it's fine.
            const response = await axios.get(API_URL, {
                params: {
                    latitude: lat,
                    longitude: lng
                }
            });

            if (response.data && response.data.elevation && response.data.elevation.length > 0) {
                const elevation = response.data.elevation[0];

                // 3. Save to Cache
                this.db.prepare('INSERT OR REPLACE INTO elevation_cache (lat, lng, elevation) VALUES (?, ?, ?)')
                    .run(lat, lng, elevation);

                return elevation;
            }
            return 0; // Default if no data
        } catch (error) {
            console.error(`[ElevationService] API Error for ${lat},${lng}:`, error.message);
            return 0; // Fallback
        }
    }

    /**
     * Bulk fetch elevation (Optimization)
     * Not implemented yet, but API supports arrays.
     */
}

module.exports = ElevationService;
