import { TILE_TYPES, MAJOR_CITIES, WORLD_SIZE, INNER_MAP_SIZE } from '../data/worldData';

export const MapService = {
    generateWorldMap: () => {
        const map = [];
        console.log("MapService: Generating New World...");

        // Optimized flat generation for performance, mapped to 2D
        for (let y = 0; y < WORLD_SIZE; y++) {
            const row = [];
            for (let x = 0; x < WORLD_SIZE; x++) {
                let type = TILE_TYPES.OCEAN;

                const dx = x - 250;
                const dy = y - 250;
                const dist = Math.sqrt(dx * dx + dy * dy);

                // Simple Perlin-ish noise approximation
                const noise = Math.sin(x * 0.05) + Math.cos(y * 0.05) + Math.sin(x * 0.01 + y * 0.01);

                if (dist < 150 + (noise * 20)) {
                    type = TILE_TYPES.PLAINS;
                    if (Math.sin(x * 0.1) * Math.cos(y * 0.1) > 0.3) type = TILE_TYPES.FOREST;
                    if (Math.abs(noise) > 1.5) type = TILE_TYPES.MOUNTAIN;
                }

                row.push({
                    x, y,
                    type: type,
                    explored: x > 240 && x < 260 && y > 240 && y < 260
                });
            }
            map.push(row);
        }

        // Place Cities
        MAJOR_CITIES.forEach(city => {
            if (city.x >= 0 && city.x < WORLD_SIZE && city.y >= 0 && city.y < WORLD_SIZE) {
                map[city.y][city.x].type = TILE_TYPES.CITY;
                map[city.y][city.x].data = city;
            }
        });

        return map;
    },

    generateInnerMap: (worldTile) => {
        const tiles = [];
        for (let y = 0; y < INNER_MAP_SIZE; y++) {
            const row = [];
            for (let x = 0; x < INNER_MAP_SIZE; x++) {
                let type = 'empty';
                let building = null;

                if (worldTile.type === TILE_TYPES.CITY) {
                    type = 'city_block';
                    if (x === 10 && y === 10) type = 'city_hall';
                } else if (worldTile.type === TILE_TYPES.MOUNTAIN) {
                    if (Math.random() > 0.7) type = 'rock_obstacle';
                    else type = 'mineral_deposit';
                } else if (worldTile.type === TILE_TYPES.FOREST) {
                    if (Math.random() > 0.6) type = 'tree';
                    else type = 'empty';
                }

                row.push({ x, y, type, building });
            }
            tiles.push(row);
        }
        return { parentTile: worldTile, tiles };
    },

    getMovementCost: (tileType) => {
        switch (tileType) {
            case TILE_TYPES.OCEAN: return 10;
            case TILE_TYPES.MOUNTAIN: return 5;
            case TILE_TYPES.FOREST: return 2;
            default: return 1;
        }
    }
};
