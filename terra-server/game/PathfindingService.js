const TerrainManager = require('./TerrainManager');

class PathfindingService {
    constructor(db) {
        this.db = db;
        this.terrainManager = new TerrainManager(db);
    }

    /**
     * Validate a path defined by user clicks.
     * Checks for obstacles along the direct line segments.
     * "Grid-less" - uses purely Lat/Lng sampling.
     * 
     * @param {number} startLat 
     * @param {number} startLng 
     * @param {number} endLat 
     * @param {number} endLng 
     * @param {Array} waypoints 
     * @returns {Promise<Object>}
     */
    async findPath(startLat, startLng, endLat, endLng, waypoints = []) {
        console.log(`[Pathfinding] Validating direct path...`);

        // Construct full set of points
        const points = [
            { lat: startLat, lng: startLng },
            ...waypoints,
            { lat: endLat, lng: endLng }
        ];

        let totalDistance = 0;
        let validatedPath = [points[0]]; // Start with origin

        // Iterate through segments
        for (let i = 0; i < points.length - 1; i++) {
            const p1 = points[i];
            const p2 = points[i + 1];

            // Check this segment
            const dist = this.calculateDistance(p1.lat, p1.lng, p2.lat, p2.lng);
            totalDistance += dist;

            const valid = await this.checkSegment(p1, p2, dist);
            if (!valid) {
                return {
                    success: false,
                    error: `Path obstructed between [${p1.lat.toFixed(4)}, ${p1.lng.toFixed(4)}] and [${p2.lat.toFixed(4)}, ${p2.lng.toFixed(4)}]`
                };
            }

            // If valid, add end point (start point is already added)
            validatedPath.push(p2);
        }

        return {
            success: true,
            path: validatedPath,
            distance: totalDistance,
            steps: validatedPath.length
        };
    }

    /**
     * Check a line segment for obstacles by sampling
     */
    async checkSegment(p1, p2, distanceKm) {
        // How many samples?
        // User reported small water paths not recognized. 10km is too large.
        // Let's sample every 1km (high precision)
        // Note: Elevation check is fast if cached.

        let samples = Math.max(5, Math.ceil(distanceKm / 1.0)); // Every 1km, min 5 samples

        // Linear Interpolation
        for (let i = 1; i <= samples; i++) {
            const t = i / (samples + 1);
            const lat = p1.lat + (p2.lat - p1.lat) * t;
            const lng = p1.lng + (p2.lng - p1.lng) * t;

            // Check Collision
            const terrain = await this.terrainManager.getTerrainInfo(lat, lng);
            if (terrain.type === 'WATER' || terrain.type === 'MOUNTAIN') {
                // Optimization: Tolerating small "edge" overlaps? 
                // For now strict.
                return false;
            }
        }

        // Also check end point? (Usually covered by next segment or final dest)
        return true;
    }

    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }
}

module.exports = PathfindingService;
