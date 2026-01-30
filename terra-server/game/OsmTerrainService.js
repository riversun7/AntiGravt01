const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { isPointInPolygon, isPointInSegments } = require('../utils/geom');

class OsmTerrainService {
    constructor() {
        this.cache = new Map(); // key="lat,lng" val={ waterSegments, concreteSegments, forestSegments, dirtSegments }
        this.localData = null;
        this.loadLocalData();
    }

    loadLocalData() {
        try {
            const filePath = path.join(__dirname, '../../terra-data/osm/region_data.json');
            if (fs.existsSync(filePath)) {
                console.log('[OsmTerrainService] Loading local OSM data from region_data.json...');
                const rawData = fs.readFileSync(filePath, 'utf8');
                const json = JSON.parse(rawData);
                this.localData = this.parseOsmData(json);
                console.log(`[OsmTerrainService] Local Data Loaded! Water Segments: ${this.localData.waterSegments.length}`);
            }
        } catch (e) {
            console.error('[OsmTerrainService] Failed to load local data:', e.message);
        }
    }

    parseOsmData(data) {
        const result = {
            waterSegments: [],
            concreteSegments: [],
            forestSegments: [],
            dirtSegments: []
        };

        const addSegments = (targetArray, geometry) => {
            if (!geometry || geometry.length < 2) return;
            for (let i = 0; i < geometry.length - 1; i++) {
                targetArray.push([
                    { lat: geometry[i].lat, lng: geometry[i].lon },
                    { lat: geometry[i + 1].lat, lng: geometry[i + 1].lon }
                ]);
            }
        };

        for (const element of data.elements) {
            let geometries = [];

            if (element.type === 'way' && element.geometry) {
                geometries.push(element.geometry);
            } else if (element.type === 'relation' && element.members) {
                element.members.forEach(m => {
                    if (m.role === 'outer' && m.geometry) {
                        geometries.push(m.geometry);
                    }
                });
            }

            if (geometries.length > 0) {
                const tags = element.tags || {};
                let target = null;

                if (tags.natural === 'water' || tags.natural === 'wetland' || tags.natural === 'mud' || tags.natural === 'coastline' || tags.natural === 'bay'
                    || tags.waterway === 'riverbank' || tags.landuse === 'reservoir' || tags.landuse === 'basin') {
                    target = result.waterSegments;
                } else if (tags.landuse && /residential|commercial|industrial|retail|harbour|port/.test(tags.landuse)) {
                    target = result.concreteSegments;
                } else if (/wood|scrub|forest|grass/.test(tags.natural) || /forest|farm|meadow|grass/.test(tags.landuse)) {
                    target = result.forestSegments;
                } else if (tags.natural && /sand|scree|bare_rock|beach/.test(tags.natural)) {
                    target = result.dirtSegments;
                }

                if (target) {
                    geometries.forEach(geo => addSegments(target, geo));
                }
            }
        }
        return result;
    }

    /**
     * Fetch standard terrain features as segments
     */
    async fetchTerrainPolygons(minLat, minLng, maxLat, maxLng) {
        // Define Local Data Bounds (approx 15km radius)
        const LOCAL_ZONES = [
            { name: "Buan", minLat: 35.55, maxLat: 35.74, minLng: 126.39, maxLng: 126.59 },
            { name: "China_Xiashan", minLat: 36.33, maxLat: 36.60, minLng: 119.34, maxLng: 119.62 },
            { name: "China_Test", minLat: 33.89, maxLat: 34.20, minLng: 118.27, maxLng: 118.55 }
        ];

        const centerLat = (minLat + maxLat) / 2;
        const centerLng = (minLng + maxLng) / 2;

        const isLocal = LOCAL_ZONES.some(zone =>
            centerLat >= zone.minLat && centerLat <= zone.maxLat &&
            centerLng >= zone.minLng && centerLng <= zone.maxLng
        );

        if (this.localData && isLocal) {
            // console.log(`[OsmTerrainService] Using Local Data (Inside ${isLocal.name || 'Local Zone'})`);
            return this.localData;
        }

        const key = `${minLat.toFixed(3)},${minLng.toFixed(3)}`;
        if (this.cache.has(key)) return this.cache.get(key);

        console.log(`[OsmTerrainService] Fetching OSM data from Remote API (Outside Local Zone): ${minLat}, ${minLng}`);

        // Tags to query
        // Water: natural=water, landuse=reservoir, waterway=riverbank
        // Concrete (Urban): landuse=residential, landuse=commercial, landuse=industrial, landuse=retail
        // Forest (Grass): natural=wood, landuse=forest
        // Dirt (Barren): natural=sand, natural=scree, natural=bare_rock, natural=beach

        const query = `
            [out:json][timeout:25];
            (
              way["natural"~"water|wetland|mud|coastline|bay"](${minLat},${minLng},${maxLat},${maxLng});
              relation["natural"~"water|wetland|mud|bay"](${minLat},${minLng},${maxLat},${maxLng});
              
              way["waterway"~"riverbank|dock|canal"](${minLat},${minLng},${maxLat},${maxLng});
              relation["waterway"~"riverbank|dock|canal"](${minLat},${minLng},${maxLat},${maxLng});

              way["landuse"~"reservoir|basin|salt_pond"](${minLat},${minLng},${maxLat},${maxLng});
              relation["landuse"~"reservoir|basin|salt_pond"](${minLat},${minLng},${maxLat},${maxLng});

              way["landuse"~"residential|commercial|industrial|retail|harbour|port"](${minLat},${minLng},${maxLat},${maxLng});
              
              way["natural"~"wood|scrub|heath|grassland|fell"](${minLat},${minLng},${maxLat},${maxLng});
              way["landuse"~"forest|farmland|farm|meadow|orchard|vineyard|grass"](${minLat},${minLng},${maxLat},${maxLng});

              way["natural"~"sand|scree|bare_rock|beach|shingle"](${minLat},${minLng},${maxLat},${maxLng});
            );
            out geom;
        `;

        try {
            const response = await axios.post('https://overpass-api.de/api/interpreter', query, {
                headers: { 'Content-Type': 'text/plain' },
                timeout: 20000 // 20 seconds
            });

            if (response.status !== 200) throw new Error(`Overpass API error: ${response.status}`);

            const result = this.parseOsmData(response.data);

            console.log(`[OsmTerrainService] Parsed: Water Segments:${result.waterSegments.length}, Urban Segments:${result.concreteSegments.length}, Forest Segments:${result.forestSegments.length}, Dirt Segments:${result.dirtSegments.length}`);
            this.cache.set(key, result);
            return result;

        } catch (error) {
            console.error('[OsmTerrainService] Error:', error.message);
            return { waterSegments: [], concreteSegments: [], forestSegments: [], dirtSegments: [] }; // Fallback
        }
    }

    /**
     * Check batch of points against all terrain types
     */
    async classifyTerrainBatch(centerLat, centerLng, points) {
        const margin = 0.03;
        const polygons = await this.fetchTerrainPolygons(
            centerLat - margin, centerLng - margin,
            centerLat + margin, centerLng + margin
        );

        console.log(`[OsmTerrainService] Classifying ${points.length} points against ${polygons.water.length} water polygons...`);

        return points.map((pt, idx) => {
            // Debug first point only to reduce spam
            const debug = (idx === 0);

            // Priority: Water > Forest > Dirt > Urban
            // This ensures parks/hills inside cities are shown as Nature

            // Check Water
            for (const p of polygons.water) {
                if (isPointInPolygon(pt, p)) {
                    if (debug) console.log(`[OsmDebug] Point 0 HIT Water Polygon (Size: ${p.length})`);
                    return 'WATER';
                }
            }
            // Check Forest (Prioritize Nature over generic Residential zones)
            for (const p of polygons.forest) {
                if (isPointInPolygon(pt, p)) return 'FOREST';
            }
            // Check Dirt
            for (const p of polygons.dirt) {
                if (isPointInPolygon(pt, p)) return 'DIRT';
            }
            // Check Urban (Lowest priority for landuse polygons)
            for (const p of polygons.concrete) {
                if (isPointInPolygon(pt, p)) return 'CONCRETE';
            }

            if (debug) console.log(`[OsmDebug] Point 0 missed all polygons`);
            return null; // No OSM match
        });
    }
}

module.exports = OsmTerrainService;
