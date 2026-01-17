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

        console.time("PathfindingDuration");
        // Iterate through segments
        // If valid, add end point (start point is already added)
        // The original code had a misplaced `validatedPath.push(p2);` here.
        // The new logic will handle path construction and validation in a batch.


        // --- BATCH OPTIMIZATION START ---
        // Collect ALL sample points for the entire path
        let allSamples = [];
        let allSampleCoords = [];

        // Re-calculate samples for batch processing validation
        for (let i = 0; i < points.length - 1; i++) {
            const p1 = points[i];
            const p2 = points[i + 1];
            const dist = this.calculateDistance(p1.lat, p1.lng, p2.lat, p2.lng);

            // Sample every 1km
            let samples = Math.max(5, Math.ceil(dist / 1.0));

            for (let k = 1; k <= samples; k++) {
                const t = k / (samples + 1);
                const lat = p1.lat + (p2.lat - p1.lat) * t;
                const lng = p1.lng + (p2.lng - p1.lng) * t;
                allSamples.push({ lat, lng, segmentIndex: i });
                allSampleCoords.push({ lat, lng });
            }
            // Add the end point of the segment to the validated path
            validatedPath.push(p2);
            totalDistance += dist;
        }

        if (allSampleCoords.length > 0) {
            console.log(`[Pathfinding] Batch checking ${allSampleCoords.length} points...`);

            // Batch Fetch
            const terrainResults = await this.terrainManager.getTerrainInfos(allSampleCoords);

            // Validate
            for (let i = 0; i < terrainResults.length; i++) {
                const terrain = terrainResults[i];
                const sample = allSamples[i];

                if (terrain.type === 'WATER' || terrain.type === 'MOUNTAIN') {
                    console.timeEnd("PathfindingDuration");
                    return {
                        success: false,
                        error: `Path obstructed at [${sample.lat.toFixed(4)}, ${sample.lng.toFixed(4)}]`
                    };
                }
            }
        }
        // --- BATCH OPTIMIZATION END ---

        console.timeEnd("PathfindingDuration");

        return {
            success: true,
            path: validatedPath,
            distance: totalDistance,
            steps: validatedPath.length
        };
    }

    /**
     * Check a line segment for obstacles by sampling (DEPRECATED)
     */
    async checkSegment(p1, p2, distanceKm) {
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
