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
    async findPath(startLat, startLng, endLat, endLng, waypoints = [], userId = null) {
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

            // Batch Fetch Terrain
            const terrainResults = await this.terrainManager.getTerrainInfos(allSampleCoords);

            // Fetch All Territories (Optimization: Cache this or use spatial query in future)
            const territories = this.db.prepare(`
                SELECT id, user_id, type, x, y, territory_radius 
                FROM user_buildings 
                WHERE is_territory_center = 1
            `).all();

            // Fetch My Safe Zones (Command Centers) - 3km Radius
            let mySafeZones = [];
            if (userId) {
                mySafeZones = this.db.prepare(`
                    SELECT x, y FROM user_buildings 
                    WHERE user_id = ? AND (type = 'COMMAND_CENTER' OR is_territory_center = 1)
                `).all(userId);
            }

            // Validate
            for (let i = 0; i < terrainResults.length; i++) {
                const terrain = terrainResults[i];
                const sample = allSamples[i];

                // 1. Terrain Check (Only WATER is blocked, MOUNTAIN is allowed)
                if (terrain.type === 'WATER') {
                    console.timeEnd("PathfindingDuration");
                    return {
                        success: false,
                        error: `Path obstructed by terrain (${terrain.type}) at [${sample.lat.toFixed(4)}, ${sample.lng.toFixed(4)}]`
                    };
                }

                // 2. Safe Zone Check (My Command Center 3km)
                if (mySafeZones.length > 0) {
                    const inSafeZone = mySafeZones.some(mz => this.calculateDistance(sample.lat, sample.lng, mz.x, mz.y) <= 3.0);
                    if (inSafeZone) continue; // Skip territory check if inside my safe zone
                }

                // 2. Territory Access Check (Power Diagram Logic)
                // 겹치는 영역에서는 "가장 가까운 사령부"가 누구 것인지 확인
                if (userId) {
                    // 현재 위치에서 모든 영토 센터까지의 거리 계산
                    const territoriesWithDistance = territories.map(t => ({
                        ...t,
                        distance: this.calculateDistance(sample.lat, sample.lng, t.x, t.y)
                    }));

                    // 영역 내에 있는 것들만 필터링 (territory_radius 이내)
                    const withinRange = territoriesWithDistance.filter(t => t.distance <= t.territory_radius);

                    if (withinRange.length > 0) {
                        // 가장 가까운 사령부 찾기
                        const closest = withinRange.reduce((prev, curr) =>
                            prev.distance < curr.distance ? prev : curr
                        );

                        // 가장 가까운 사령부가 자신의 것이 아니면 차단
                        if (closest.user_id && String(closest.user_id) !== String(userId)) {
                            console.timeEnd("PathfindingDuration");
                            return {
                                success: false,
                                error: `🚫 접근 거부: ${closest.owner_name ? closest.owner_name : '알 수 없는 세력'}의 영토 (${closest.type}) 입니다. (거리: ${closest.distance.toFixed(2)}km)`
                            };
                        }
                        // 가장 가까운 사령부가 자신의 것이면 통과
                    }
                    // withinRange가 비어있으면 (아무 영토에도 속하지 않음) 통과
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
