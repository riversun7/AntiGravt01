const axios = require('axios');

async function testOsm() {
    const lat = 35.6473;
    const lng = 126.4904;
    const range = 0.01; // Small box

    const minLat = lat - range;
    const maxLat = lat + range;
    const minLng = lng - range;
    const maxLng = lng + range;

    // The exact query from OsmTerrainService.js
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

    console.log("Sending Query...");
    try {
        const response = await axios.post('https://overpass-api.de/api/interpreter', query, {
            headers: { 'Content-Type': 'text/plain' },
            timeout: 20000
        });

        console.log("Response Status:", response.status);
        console.log("Elements Found:", response.data.elements.length);

        // Print first few elements to check tags and geometry
        response.data.elements.forEach(el => {
            console.log(`[${el.type}] ID:${el.id}`);
            console.log("  Tags:", el.tags);
            if (el.geometry) console.log("  Geometry Points:", el.geometry.length);
            if (el.members) console.log("  Members:", el.members.length);
        });

    } catch (e) {
        console.error("Error:", e.message);
        if (e.response) console.log(e.response.data);
    }
}

testOsm();
