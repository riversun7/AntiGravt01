
const axios = require('axios'); // Use axios which is already installed
const { isPointInPolygon } = require('../utils/geom');


class WaterService {
    constructor() {
        this.cache = new Map(); // Simple memory cache key="lat,lng" val=polygons
    }

    /**
     * Fetch water features for a bounding box
     * @param {number} minLat 
     * @param {number} minLng 
     * @param {number} maxLat 
     * @param {number} maxLng 
     */
    async fetchWaterPolygons(minLat, minLng, maxLat, maxLng) {
        // Create a cache key roughly
        const key = `${minLat.toFixed(3)},${minLng.toFixed(3)}`;
        if (this.cache.has(key)) return this.cache.get(key);

        console.log(`[WaterService] Fetching OSM data for bounds: ${minLat}, ${minLng}, ${maxLat}, ${maxLng}`);

        const query = `
            [out:json][timeout:5];
            (
              way["natural"="water"](${minLat},${minLng},${maxLat},${maxLng});
              way["landuse"="reservoir"](${minLat},${minLng},${maxLat},${maxLng});
              way["waterway"="riverbank"](${minLat},${minLng},${maxLat},${maxLng});
              relation["natural"="water"](${minLat},${minLng},${maxLat},${maxLng});
            );
            out geom;
        `;

        try {
            const response = await axios.post('https://overpass-api.de/api/interpreter', query, {
                headers: { 'Content-Type': 'text/plain' },
                timeout: 5000
            });

            if (response.status !== 200) throw new Error(`Overpass API error: ${response.status}`);

            const data = response.data;
            const polygons = [];

            for (const element of data.elements) {
                if (element.type === 'way' && element.geometry) {
                    polygons.push(element.geometry.map(p => ({ lat: p.lat, lng: p.lon })));
                }
                // Relations (complex polygons) simplified: just take member ways
                else if (element.type === 'relation' && element.members) {
                    for (const m of element.members) {
                        if (m.geometry) {
                            polygons.push(m.geometry.map(p => ({ lat: p.lat, lng: p.lon })));
                        }
                    }
                }
            }

            console.log(`[WaterService] Found ${polygons.length} water bodies.`);
            this.cache.set(key, polygons);
            return polygons;

        } catch (error) {
            console.error('[WaterService] Error:', error.message);
            return [];
        }
    }

    /**
     * Check if a list of points contains water
     * @param {Array<{lat, lng}>} points 
     * @returns {Promise<boolean[]>} array matching input points
     */
    async checkWaterBatch(centerLat, centerLng, points) {
        // Define bounds with margin (approx 0.05 deg ~ 5km)
        const margin = 0.03;
        const polygons = await this.fetchWaterPolygons(
            centerLat - margin, centerLng - margin,
            centerLat + margin, centerLng + margin
        );

        if (polygons.length === 0) return points.map(() => false);

        return points.map(pt => {
            for (const poly of polygons) {
                if (isPointInPolygon(pt, poly)) return true;
            }
            return false;
        });
    }
}

module.exports = WaterService;
