export const BUILDINGS = {
    solar_panel: {
        id: 'solar_panel',
        name: 'Solar Array',
        type: 'energy',
        cost: { money: 100, materials: 20 },
        production: { energy: 10 },
        consumption: {},
        description: 'Generates renewable energy from sunlight.'
    },
    mineral_drill: {
        id: 'mineral_drill',
        name: 'Auto-Drill',
        type: 'production',
        cost: { money: 200, materials: 50 },
        production: { materials: 2 },
        consumption: { energy: 5 },
        description: 'Extracts minerals from the ground automatically.'
    },
    hydro_farm: {
        id: 'hydro_farm',
        name: 'Hydroponics',
        type: 'food',
        cost: { money: 150, materials: 30 },
        production: { food: 5 }, // For units later
        consumption: { energy: 2, water: 1 },
        description: 'Grows food for biological units.'
    },
    warehouse: {
        id: 'warehouse',
        name: 'Supply Depot',
        type: 'storage',
        cost: { money: 300, materials: 100 },
        storage: { materials: 500 },
        production: {},
        consumption: { energy: 1 },
        description: 'Increases material storage capacity.'
    },
    housing_module: {
        id: 'housing_module',
        name: 'Habitation Unit',
        type: 'housing',
        cost: { money: 500, materials: 200 },
        capacity: 10, // Humans
        production: {},
        consumption: { energy: 5 },
        description: 'Living space for human employees.'
    },
    turret: {
        id: 'turret',
        name: 'Auto-Turret',
        type: 'defense',
        cost: { money: 400, materials: 150 },
        defense: 10,
        production: {},
        consumption: { energy: 10 },
        description: 'Basic defense against drone attacks.'
    },
    shield_gen: {
        id: 'shield_gen',
        name: 'Shield Generator',
        type: 'defense',
        cost: { money: 1000, energy: 500 },
        defense: 50,
        production: {},
        consumption: { energy: 50 },
        description: 'Advanced energy shield. High defense.'
    }
};
