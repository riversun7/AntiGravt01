import dbConfig from './dbConfig.json';

// Configuration
export const WORLD_SIZE = dbConfig.WORLD_SIZE || 500;
export const INNER_MAP_SIZE = 20;
export const VIEWPORT_SIZE = 15;

export const TILE_TYPES = {
    OCEAN: 'ocean',
    PLAINS: 'plains',
    FOREST: 'forest',
    MOUNTAIN: 'mountain',
    CITY: 'city'
};

export const BUILDING_TYPES = {
    HQ: 'command_center',
    SOLAR: 'solar_panel',
    MINE: 'extraction_drill',
    FACTORY: 'material_factory'
};

export const GRID_SIZES = {
    SMALL: 10,
    MEDIUM: 20,
    LARGE: 50
};

// City Database (Major Cities)
export const MAJOR_CITIES = [
    { id: 'seoul', name: 'Neo-Seoul', x: 250, y: 250, type: 'Tech', population: 15000000, desc: 'The heart of cybernetics.' },
    { id: 'ny', name: 'Mega-NYC', x: 140, y: 200, type: 'Finance', population: 12000000, desc: 'Global commerce hub.' },
    { id: 'london', name: 'Iron-London', x: 240, y: 190, type: 'Diplomacy', population: 9500000, desc: 'Political neutral zone.' },
    { id: 'tokyo', name: 'Cyber-Tokyo', x: 260, y: 250, type: 'Trade', population: 30000000, desc: 'Eastern trade capital.' }
];
