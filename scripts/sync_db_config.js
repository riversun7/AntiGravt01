import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SEED_SQL_PATH = path.join(__dirname, '../seed.sql');
const OUTPUT_CONFIG_PATH = path.join(__dirname, '../src/data/dbConfig.json');

function syncConfig() {
    try {
        console.log(`Searching for seed.sql at: ${SEED_SQL_PATH}`);
        if (!fs.existsSync(SEED_SQL_PATH)) {
            console.error(`Error: Seed SQL file not found at ${SEED_SQL_PATH}`);
            process.exit(1);
        }

        const sqlContent = fs.readFileSync(SEED_SQL_PATH, 'utf8');

        // Regex to find: INSERT INTO worlds (world_id, width, height) VALUES (1, 500, 500);
        const dimensionsRegex = /INSERT INTO worlds\s*\([^)]+\)\s*VALUES\s*\(\d+,\s*(\d+),\s*(\d+)\);/i;
        const match = sqlContent.match(dimensionsRegex);

        if (match) {
            const width = parseInt(match[1], 10);
            const height = parseInt(match[2], 10);

            if (width !== height) {
                console.warn(`Warning: World is not square (${width}x${height}). Using width as WORLD_SIZE.`);
            }

            const config = {
                WORLD_SIZE: width,
                WORLD_HEIGHT: height,
                generated_at: new Date().toISOString()
            };

            fs.writeFileSync(OUTPUT_CONFIG_PATH, JSON.stringify(config, null, 2));
            console.log(`Successfully synced config from SQL to ${OUTPUT_CONFIG_PATH}`);
            console.log(`Found World Dimensions: ${width}x${height}`);
        } else {
            console.error('Error: Could not find "INSERT INTO worlds" statement in seed.sql');
            process.exit(1);
        }

    } catch (err) {
        console.error('Error syncing config:', err);
        process.exit(1);
    }
}

syncConfig();
