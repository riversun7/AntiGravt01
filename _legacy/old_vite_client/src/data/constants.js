export const TILE_TYPES = {
    OCEAN: 'ocean',
    PLAINS: 'plains',
    FOREST: 'forest',
    MOUNTAIN: 'mountain',
    CITY: 'city',
};

export const GRID_SIZES = {
    [TILE_TYPES.CITY]: 3,     // 3x3
    [TILE_TYPES.MOUNTAIN]: 2, // 2x2 (Base)
    [TILE_TYPES.PLAINS]: 1,   // 1x1 (Outpost)
    [TILE_TYPES.FOREST]: 1,
    'default': 1
};

export const BUILDING_TYPES = {
    SOLAR_PANEL: { id: 'solar_panel', name: 'Solar Panel', cost: { money: 100, materials: 10 }, output: { energy: 5 }, desc: 'Basic energy generation.' },
    MINE: { id: 'mine', name: 'Mineral Extractor', cost: { money: 200, materials: 50 }, output: { materials: 10 }, desc: 'Extracts minerals from the ground.' },
    HABITAT: { id: 'habitat', name: 'Habitation Module', cost: { money: 500, materials: 100 }, output: { money: 1 }, desc: 'Living space for colonists.' }
};
