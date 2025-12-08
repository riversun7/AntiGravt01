import { TILE_TYPES, GRID_SIZES, BUILDING_TYPES } from './constants';
export { TILE_TYPES, GRID_SIZES, BUILDING_TYPES };

import dbConfig from './dbConfig.json';

// 1. Configuration
export const WORLD_SIZE = dbConfig.WORLD_SIZE || 500; // 500x500
export const INNER_MAP_SIZE = 20; // 20x20 for local sectors
export const VIEWPORT_SIZE = 15; // Viewport size for the web view

// 2. City Database (Major Cities)
export const MAJOR_CITIES = [
    { id: 'seoul', name: 'Neo-Seoul', x: 250, y: 250, type: 'Tech', population: 15000000, desc: 'The heart of cybernetics.' },
    { id: 'ny', name: 'Mega-NYC', x: 140, y: 200, type: 'Finance', population: 12000000, desc: 'Global commerce hub.' },
    { id: 'london', name: 'Iron-London', x: 240, y: 190, type: 'Diplomacy', population: 9500000, desc: 'Political neutral zone.' },
    { id: 'tokyo', name: 'Cyber-Tokyo', x: 260, y: 250, type: 'Trade', population: 30000000, desc: 'Eastern trade capital.' },
    // Add more to fill the map
];

// 3. World Generation Logic (Procedural)
// Uses simple noise-like math for prototype. In real proejct, use Perlin Noise.
export const generateWorldMap = () => {
    // We will represent the map as a sparse system or just a large array for now.
    // Optimized: flattened array or 2D array. 2D array is easier for XY access.
    // WARNING: 500x500 = 250,000 objects. Light objects are fine.

    const map = [];

    for (let y = 0; y < WORLD_SIZE; y++) {
        const row = [];
        for (let x = 0; x < WORLD_SIZE; x++) {
            // Biome Generation Logic
            let type = TILE_TYPES.OCEAN;

            // Simple geographic shapes (Pseudo-Earth)
            // Center huge continent
            const dx = x - 250;
            const dy = y - 250;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Noise function simulation (sin waves)
            const noise = Math.sin(x * 0.05) + Math.cos(y * 0.05) + Math.sin(x * 0.01 + y * 0.01);

            if (dist < 150 + (noise * 20)) {
                type = TILE_TYPES.PLAINS;

                // Forests
                if (Math.sin(x * 0.1) * Math.cos(y * 0.1) > 0.3) {
                    type = TILE_TYPES.FOREST;
                }

                // Mountains
                if (Math.abs(noise) > 1.5) {
                    type = TILE_TYPES.MOUNTAIN;
                }
            }

            row.push({
                x, y,
                type: type,
                explored: x > 240 && x < 260 && y > 240 && y < 260 // Start area revealed
            });
        }
        map.push(row);
    }

    // Plant Cities
    MAJOR_CITIES.forEach(city => {
        if (city.x >= 0 && city.x < WORLD_SIZE && city.y >= 0 && city.y < WORLD_SIZE) {
            map[city.y][city.x].type = TILE_TYPES.CITY;
            map[city.y][city.x].data = city;
        }
    });

    return map;
};

// 4. Inner Map Generation (Drill-down)
// Generates a local map based on the World Tile properties



// 4. Inner Map Generation (Drill-down)
// Generates a local map based on the World Tile properties
export const generateInnerMap = (worldTile) => {
    // Reverted to 20x20 fixed size for detail
    // const seed = worldTile.x * 1000 + worldTile.y; 
    const localMap = [];

    for (let y = 0; y < INNER_MAP_SIZE; y++) {
        const row = [];
        for (let x = 0; x < INNER_MAP_SIZE; x++) {
            let type = 'empty'; // usable land
            let building = null;

            // Simple pre-generation logic (Restore 20x20 logic)
            // If World Tile was City, generate city blocks
            if (worldTile.type === TILE_TYPES.CITY) {
                type = 'city_block';
                if (x === 10 && y === 10) type = 'city_hall';
            }
            // If Mountain, rocky terrain
            else if (worldTile.type === TILE_TYPES.MOUNTAIN) {
                if (Math.random() > 0.7) type = 'rock_obstacle';
                else type = 'mineral_deposit';
            }
            // If Forest, trees
            else if (worldTile.type === TILE_TYPES.FOREST) {
                if (Math.random() > 0.6) type = 'tree';
                else type = 'empty';
            }

            row.push({ x, y, type, building });
        }
        localMap.push(row);
    }

    return {
        parentTile: worldTile,
        tiles: localMap
    };
};

export const getMovementCost = (tileType) => {
    switch (tileType) {
        case TILE_TYPES.OCEAN: return 10;
        case TILE_TYPES.MOUNTAIN: return 5;
        case TILE_TYPES.FOREST: return 2;
        default: return 1;
    }
};
