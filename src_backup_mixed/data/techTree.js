export const TECH_TREE = {
    basic_logistics: {
        id: 'basic_logistics',
        name: 'Basic Logistics',
        cost: { money: 100, energy: 50 },
        time: 5, // seconds for testing
        prereq: [],
        description: 'Optimized supply chains. Unlocks Warehouses.',
        unlocks_building: 'warehouse'
    },
    sustainable_energy: {
        id: 'sustainable_energy',
        name: 'Sustainable Energy',
        cost: { money: 300, energy: 100 },
        time: 10,
        prereq: [],
        description: 'Advanced solar and wind capture. Boosts energy output.',
        unlocks_building: 'adv_solar'
    },
    ai_robotics: {
        id: 'ai_robotics',
        name: 'AI Robotics',
        cost: { money: 1000, materials: 200 },
        time: 15,
        prereq: ['basic_logistics'],
        description: 'Autonomous worker units. Unlocks Android Miner.',
        unlocks_unit: 'android_miner'
    },
    xeno_biology: {
        id: 'xeno_biology',
        name: 'Xeno-Biology',
        cost: { money: 800, food: 100 },
        time: 20,
        prereq: ['sustainable_energy'],
        description: 'Study of local lifeforms. Unlocks Creature Domestication.',
        unlocks_unit: 'creature_scout'
    },
    defense_systems: {
        id: 'defense_systems',
        name: 'Defense Systems',
        cost: { money: 2000, materials: 500 },
        time: 30,
        prereq: ['ai_robotics'],
        description: 'Automated turret defenses against hostiles.',
        unlocks_building: 'turret'
    }
};
