
const db = require('./database');
const ElevationService = require('./game/ElevationService');
const service = new ElevationService(db);

async function run() {
    // Center: 35.9028, 126.7118 (Gunsan/Seocheon area likely, near Geum River?)
    const centerLat = 35.902817;
    const centerLng = 126.711845;

    // Search Radius: 0.1 degrees (~10km)
    const searchRadius = 0.05;
    const step = 0.002; // Coarse search

    console.log(`Probing for water (<= 0m) around ${centerLat}, ${centerLng}...`);

    let foundWater = false;
    let nearestDist = 9999;
    let nearestLoc = null;

    const locations = [];
    for (let lat = centerLat - searchRadius; lat <= centerLat + searchRadius; lat += step) {
        for (let lng = centerLng - searchRadius; lng <= centerLng + searchRadius; lng += step) {
            locations.push({ lat, lng });
        }
    }

    const elevations = await service.getElevations(locations);

    for (let i = 0; i < locations.length; i++) {
        const val = elevations[i];
        if (val <= 0) {
            const loc = locations[i];
            const dLat = loc.lat - centerLat;
            const dLng = loc.lng - centerLng;
            const distDeg = Math.sqrt(dLat * dLat + dLng * dLng);
            // Approx km (1 deg ~ 111km)
            const distKm = distDeg * 111;

            if (distKm < nearestDist) {
                nearestDist = distKm;
                nearestLoc = { loc, val, distKm };
            }
            foundWater = true;
        }
        // Also log "low" terrain (1-5m) which might be river
        if (val > 0 && val <= 5) {
            // console.log(`Lowland found: ${val}m at ${distKm.toFixed(2)}km`);
        }
    }

    if (nearestLoc) {
        console.log(`✅ NEAREST WATER FOUND!`);
        console.log(`Distance: ${nearestLoc.distKm.toFixed(2)} km`);
        console.log(`Elevation: ${nearestLoc.val} m`);
        console.log(`Location: ${nearestLoc.loc.lat}, ${nearestLoc.loc.lng}`);
    } else {
        console.log(`❌ NO WATER found in ~5km radius (Search grid size: ${locations.length})`);
        console.log("Closest lowland might be the river, but data says elevation > 0.");
    }
}

run();
