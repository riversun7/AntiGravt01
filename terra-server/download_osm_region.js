const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Target Regions
const REGIONS = [
    { name: "Buan (Korea)", lat: 35.6473, lng: 126.4904 },
    { name: "Xiashan (China)", lat: 36.4743, lng: 119.4839 }, // From previous screenshot
    { name: "China Test 2", lat: 34.0265, lng: 118.4120 }     // From current screenshot
];
const RADIUS_KM = 15; // 15km radius

function kmToDeg(km) {
    return km / 111;
}

const vectorRange = kmToDeg(RADIUS_KM);
const OUTPUT_FILE = path.join(__dirname, '../terra-data/osm/region_data.json');

async function downloadRegion(region) {
    const minLat = region.lat - vectorRange;
    const maxLat = region.lat + vectorRange;
    const minLng = region.lng - vectorRange;
    const maxLng = region.lng + vectorRange;

    console.log(`Downloading ${region.name}: [${minLat.toFixed(4)}, ${minLng.toFixed(4)}]...`);

    const query = `
        [out:json][timeout:300];
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
            maxBodyLength: Infinity,
            timeout: 300000
        });
        if (response.status !== 200) throw new Error(`Status ${response.status}`);
        return response.data.elements;
    } catch (e) {
        console.error(`Failed ${region.name}:`, e.message);
        return [];
    }
}

async function run() {
    let allElements = [];
    for (const region of REGIONS) {
        const elements = await downloadRegion(region);
        console.log(`  Fetched ${elements.length} items.`);
        allElements = allElements.concat(elements);
    }

    console.log(`Total Elements: ${allElements.length}`);
    // Wrap in standard OSM JSON structure
    const finalJson = { version: 0.6, generator: "TerraDownloader", elements: allElements };

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalJson, null, 2));
    console.log(`Saved merged data to ${OUTPUT_FILE}`);
}

run();
