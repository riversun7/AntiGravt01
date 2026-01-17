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
    /**
     * Get elevation for multiple points in batch.
     * @param {Array<{lat: number, lng: number}>} locations 
     * @returns {Promise<Array<number>>} Array of elevations matching input order
     */
    async getElevations(locations) {
        const results = new Array(locations.length).fill(null);
        const missingIndices = [];

        // 1. Try Local HGT & Cache
        for (let i = 0; i < locations.length; i++) {
            const { lat, lng } = locations[i];

            // Local HGT
            const localHeight = this.hgtReader.getElevation(lat, lng);
            if (localHeight !== null) {
                results[i] = localHeight;
                continue;
            }

            // DB Cache
            const cache = this.db.prepare('SELECT elevation FROM elevation_cache WHERE lat = ? AND lng = ?').get(lat, lng);
            if (cache) {
                results[i] = cache.elevation;
                continue;
            }

            // Mark for API
            missingIndices.push(i);
        }

        // 2. Batch API Fetch for missing
        if (missingIndices.length > 0) {
            try {
                // Split into chunks if too large (Open-Meteo limit is high, but URL length matters)
                // We'll stick to a reasonable chunk size, e.g., 50
                const CHUNK_SIZE = 50;

                for (let c = 0; c < missingIndices.length; c += CHUNK_SIZE) {
                    const chunkIndices = missingIndices.slice(c, c + CHUNK_SIZE);
                    const lats = chunkIndices.map(idx => locations[idx].lat).join(',');
                    const lngs = chunkIndices.map(idx => locations[idx].lng).join(',');

                    console.log(`[Elevation] Batch fetching ${chunkIndices.length} points...`);

                    const response = await axios.get(API_URL, {
                        params: { latitude: lats, longitude: lngs },
                        timeout: 5000
                    });

                    if (response.data && response.data.elevation) {
                        const elevations = response.data.elevation;

                        // Process results
                        // Transaction for cache inserts
                        const insert = this.db.prepare('INSERT OR REPLACE INTO elevation_cache (lat, lng, elevation) VALUES (?, ?, ?)');
                        const tx = this.db.transaction(() => {
                            chunkIndices.forEach((originalIdx, k) => {
                                const val = elevations[k];
                                results[originalIdx] = val; // Store result
                                insert.run(locations[originalIdx].lat, locations[originalIdx].lng, val); // Cache
                            });
                        });
                        tx();
                    }
                }
            } catch (error) {
                console.error(`[ElevationService] Batch API Error:`, error.message);
                // Fallback for failed fetches: remain null or 0? 0 is safe/water.
                missingIndices.forEach(idx => {
                    if (results[idx] === null) results[idx] = 0;
                });
            }
        }

        // Fill any remaining nulls with 0
        return results.map(r => r === null ? 0 : r);
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
