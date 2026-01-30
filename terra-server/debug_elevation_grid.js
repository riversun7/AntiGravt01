
const db = require('./database');
const ElevationService = require('./game/ElevationService');
const service = new ElevationService(db);

async function run() {
    // User Building ID 2343
    // Coords from previous step: 35.9028, 126.7118
    const centerLat = 35.902817;
    const centerLng = 126.711845;
    const size = 30;
    const scale = 0.0003;

    console.log(`Sampling ${size}x${size} elevations around ${centerLat}, ${centerLng}`);

    const locations = [];
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const dLat = (y - size / 2) * scale;
            const dLng = (x - size / 2) * scale;
            locations.push({ lat: centerLat + dLat, lng: centerLng + dLng });
        }
    }

    const elevations = await service.getElevations(locations);

    // Print Grid
    console.log("=== Elevation Grid (m) ===");
    let min = 9999, max = -9999;
    let waterCount = 0;

    for (let y = 0; y < size; y++) {
        let rowStr = "";
        for (let x = 0; x < size; x++) {
            const val = elevations[y * size + x];
            min = Math.min(min, val);
            max = Math.max(max, val);
            if (val <= 0) waterCount++;

            // Format for readability
            const s = val.toString().padStart(3, ' ');
            rowStr += s + " ";
        }
        // Print every other row to save space/time if needed, but 30 is fine
        console.log(rowStr);
    }

    console.log("============================");
    console.log(`Min: ${min}, Max: ${max}`);
    console.log(`Water (<=0): ${waterCount}`);
}

run();
