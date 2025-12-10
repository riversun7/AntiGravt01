
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateWorldMap, MAJOR_CITIES } from '../src/data/worldData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const OUTPUT_FILE = path.join(projectRoot, 'seed.sql');

console.log('Generating World Data...');
const map = generateWorldMap();
const worldSize = map.length;

console.log(`Map Size: ${worldSize}x${worldSize}`);
console.log(`Writing to ${OUTPUT_FILE}...`);

const stream = fs.createWriteStream(OUTPUT_FILE, { flags: 'w' });

// Helper to escape strings for SQL
const escape = (str) => {
    if (!str) return 'NULL';
    return "'" + str.replace(/'/g, "''") + "'";
};

// 1. Insert World
// We assume World ID 1 for this seed
stream.write(`-- Seed Data for Terra In-cognita
-- Generated automatically by scripts/generate_seed_data.js

-- 1. Insert Default World
INSERT INTO worlds (world_id, width, height) VALUES (1, ${worldSize}, ${worldSize});
`);

// 2. Insert Tiles
// This is a large operation. We will generate bulk inserts.
// INSERT INTO world_tiles (world_id, x_coord, y_coord, tile_type) VALUES ...
let buffer = [];
const BATCH_SIZE = 1000;

stream.write(`\n-- 2. Insert World Tiles\n`);

let count = 0;
for (let y = 0; y < worldSize; y++) {
    for (let x = 0; x < worldSize; x++) {
        const tile = map[y][x];
        const val = `(1, ${tile.x}, ${tile.y}, '${tile.type}')`;
        buffer.push(val);

        if (buffer.length >= BATCH_SIZE) {
            stream.write(`INSERT INTO world_tiles (world_id, x_coord, y_coord, tile_type) VALUES ${buffer.join(',')};\n`);
            buffer = [];
        }
        count++;
    }
}
// Flush remaining
if (buffer.length > 0) {
    stream.write(`INSERT INTO world_tiles (world_id, x_coord, y_coord, tile_type) VALUES ${buffer.join(',')};\n`);
}

console.log(`Wrote ${count} tiles.`);

// 3. Insert Cities
stream.write(`\n-- 3. Insert Cities\n`);
// We need to find the tile_id for these cities. 
// Since we generated IDs sequentially or by (x,y), but in SQL auto-inc might be different.
// However, since we inserted tiles logically, we can lookup by coordinates if we had to.
// OR, we can just assume consistent ordering if we didn't use auto_increment for tile_id in the script?
// But the schema uses AUTO_INCREMENT. 
// Standard approach: select id from world_tiles where x=... and y=...
// BUT for a seed file, we can't do SELECTs inside VALUES of other inserts easily in one go without subqueries.
// Subquery approach:
// INSERT INTO cities (tile_id, name, specialization, population, description)
// SELECT tile_id, 'Name', 'Spec', 100, 'Desc' FROM world_tiles WHERE world_id=1 AND x_coord=X AND y_coord=Y;

MAJOR_CITIES.forEach(city => {
    stream.write(`
INSERT INTO cities (tile_id, name, specialization, population, description)
SELECT tile_id, ${escape(city.name)}, ${escape(city.type)}, ${city.population}, ${escape(city.desc)}
FROM world_tiles 
WHERE world_id = 1 AND x_coord = ${city.x} AND y_coord = ${city.y};
`);
});

stream.end();
console.log('Done.');
