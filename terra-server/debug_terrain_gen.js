
const db = require('./database');
const TerrainManager = require('./game/TerrainManager');
const terrainManager = new TerrainManager(db);

async function runDebug() {
    const userBuildingId = 1539; // The failed one
    console.log(`Debugging Terrain Gen for Building ${userBuildingId}`);

    const building = db.prepare('SELECT * FROM user_buildings WHERE id = ?').get(userBuildingId);
    if (!building) {
        console.error("Building not found");
        return;
    }
    console.log("Building Data:", building);

    const typeCode = building.building_type_code || building.type;
    const buildingType = db.prepare('SELECT internal_map_size FROM building_types WHERE code = ?').get(typeCode);
    console.log("Building Type Data:", buildingType);

    if (!buildingType || !buildingType.internal_map_size) {
        console.error("No internal map size");
        return;
    }

    try {
        const size = buildingType.internal_map_size;
        const center = Math.floor(size / 2);
        const scale = 0.0003;
        const points = [];

        console.log(`Generating points for ${size}x${size} grid...`);
        for (let gx = 0; gx < size; gx++) {
            for (let gy = 0; gy < size; gy++) {
                const dLng = (gx - center) * scale;
                const dLat = (gy - center) * scale;
                points.push({ lat: building.x + dLat, lng: building.y + dLng });
            }
        }
        console.log(`Generated ${points.length} points. Fetching terrain...`);

        // This is where it likely fails
        const terrains = await terrainManager.getTerrainInfos(points);
        console.log(`Fetched ${terrains.length} terrain infos.`);
        console.log("Sample:", terrains[0]);

    } catch (e) {
        console.error("CAPTURE ERROR:", e);
    }
}

runDebug();
