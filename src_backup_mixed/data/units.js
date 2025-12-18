export const UNIT_TYPES = {
    human_engineer: {
        id: 'human_engineer',
        name: 'Engineer',
        species: 'human',
        cost: { money: 500, food: 10 },
        maintenance: { food: 1, money: 5 },
        skill_bonus: { production: 1.5, energy: 1.2 },
        description: 'Skilled worker. Boosts production efficiency.'
    },
    android_miner: {
        id: 'android_miner',
        name: 'Mining Droid T-1',
        species: 'android',
        cost: { money: 300, energy: 50 },
        maintenance: { energy: 2 },
        skill_bonus: { production: 1.8 }, // Specialized
        description: 'Automated labor force. Requires energy.'
    },
    creature_scout: {
        id: 'creature_scout',
        name: 'Cyber-Wolf',
        species: 'creature',
        cost: { money: 200, food: 20 },
        maintenance: { food: 2 },
        skill_bonus: { exploration: 2.0 },
        description: 'Biological companion enhanced for scouting.'
    }
};
