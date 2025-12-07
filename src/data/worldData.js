// Enhanced World Data based on Earth and RPG elements

export const TILE_TYPES = {
    // Terrain
    EMPTY: 'plains', // Default traversable
    OCEAN: 'ocean',  // Hard to traverse
    MOUNTAIN: 'mountain', // High cost, minerals
    FOREST: 'forest', // Wood

    // Resources
    RESOURCE_MINERAL: 'mineral',
    RESOURCE_ENERGY: 'energy',

    // Structures
    CITY: 'city',
    FACILITY_MINE: 'facility_mine',
    FACILITY_PLANT: 'facility_plant',
    FACILITY_WAREHOUSE: 'facility_warehouse' // Increases storage
};

export const WORLD_WIDTH = 20; // Expanded for prototype
export const WORLD_HEIGHT = 15;

// Real-world inspired major cities (Approximate relative locations on a grid)
export const NPC_CITIES = [
    { id: 'city_seoul', name: 'Neo-Seoul', x: 16, y: 5, type: 'Tech', desc: 'Advanced cybernetics hub.', population: 9800000 },
    { id: 'city_tokyo', name: 'Cyber-Tokyo', x: 17, y: 5, type: 'Trade', desc: 'The eastern economic capital.', population: 14000000 },
    { id: 'city_shanghai', name: 'New-Shanghai', x: 15, y: 6, type: 'Industrial', desc: 'Massive production facilities.', population: 26000000 },
    { id: 'city_ny', name: 'Mega-NYC', x: 4, y: 5, type: 'Finance', desc: 'Global financial center.', population: 8500000 },
    { id: 'city_london', name: 'Iron-London', x: 9, y: 3, type: 'Diplomacy', desc: 'Political neutral ground.', population: 9000000 },
];

export const generateInitialMap = () => {
    const map = [];
    for (let y = 0; y < WORLD_HEIGHT; y++) {
        const row = [];
        for (let x = 0; x < WORLD_WIDTH; x++) {
            // 1. Check for cities
            const city = NPC_CITIES.find(c => c.x === x && c.y === y);
            if (city) {
                row.push({ x, y, type: TILE_TYPES.CITY, data: city });
                continue;
            }

            // 2. Generate varied terrain (Simple noise-like logic)
            // Oceans on edges or specific bands
            if (x < 2 || x > 18 || y > 12) {
                row.push({ x, y, type: TILE_TYPES.OCEAN });
                continue;
            }

            // 3. Random Resources & biomes
            const rand = Math.random();
            if (rand < 0.05) {
                row.push({ x, y, type: TILE_TYPES.RESOURCE_MINERAL, amount: 500, regenRate: 1 });
            } else if (rand < 0.1) {
                row.push({ x, y, type: TILE_TYPES.RESOURCE_ENERGY, amount: 1000, regenRate: 5 });
            } else if (rand < 0.2) {
                row.push({ x, y, type: TILE_TYPES.FOREST, amount: 2000, regenRate: 2 });
            } else if (rand < 0.3) {
                row.push({ x, y, type: TILE_TYPES.MOUNTAIN }); // Obstacle/Mineral potential
            } else {
                row.push({ x, y, type: TILE_TYPES.EMPTY });
            }
        }
        map.push(row);
    }
    return map;
};

export const getMovementCost = (tileType) => {
    switch (tileType) {
        case TILE_TYPES.OCEAN: return 10; // Hard to swim/fly
        case TILE_TYPES.MOUNTAIN: return 5; // Hard to climb
        case TILE_TYPES.FOREST: return 2;
        default: return 1;
    }
}
