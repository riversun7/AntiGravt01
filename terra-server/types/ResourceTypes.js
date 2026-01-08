// Resource Types for Terra In-Cognita

const ResourceType = {
    // 1차 자원 (Primary Resources)
    WOOD: 'WOOD',
    ORE: 'ORE',
    FOOD: 'FOOD',
    STONE: 'STONE',

    // 2차 자원 (Refined Resources) - 추후 확장
    METAL: 'METAL',
    PLANKS: 'PLANKS',

    // 특수 자원
    ENERGY: 'ENERGY',
    MANA_CRYSTAL: 'MANA_CRYSTAL'
};

const ResourceRarity = {
    COMMON: 'COMMON',       // 무한 재생
    UNCOMMON: 'UNCOMMON',   // 빠른 재생
    RARE: 'RARE',           // 느린 재생
    EPIC: 'EPIC',           // 매우 느린 재생
    LEGENDARY: 'LEGENDARY'  // 거의 재생 안됨
};

const RESOURCE_DEFINITIONS = {
    [ResourceType.WOOD]: {
        type: ResourceType.WOOD,
        name: '목재',
        rarity: ResourceRarity.COMMON,
        baseRegenRate: 1.0,
        maxAmount: 1000,
        gatherTime: 5
    },
    [ResourceType.ORE]: {
        type: ResourceType.ORE,
        name: '광석',
        rarity: ResourceRarity.UNCOMMON,
        baseRegenRate: 0.5,
        maxAmount: 500,
        gatherTime: 8
    },
    [ResourceType.FOOD]: {
        type: ResourceType.FOOD,
        name: '식량',
        rarity: ResourceRarity.COMMON,
        baseRegenRate: 0.8,
        maxAmount: 800,
        gatherTime: 4
    },
    [ResourceType.STONE]: {
        type: ResourceType.STONE,
        name: '석재',
        rarity: ResourceRarity.COMMON,
        baseRegenRate: 0.6,
        maxAmount: 600,
        gatherTime: 6
    },
    [ResourceType.METAL]: {
        type: ResourceType.METAL,
        name: '금속',
        rarity: ResourceRarity.RARE,
        baseRegenRate: 0.1,
        maxAmount: 200,
        gatherTime: 15
    },
    [ResourceType.PLANKS]: {
        type: ResourceType.PLANKS,
        name: '판자',
        rarity: ResourceRarity.COMMON,
        baseRegenRate: 0,
        maxAmount: 0,
        gatherTime: 10
    },
    [ResourceType.ENERGY]: {
        type: ResourceType.ENERGY,
        name: '에너지',
        rarity: ResourceRarity.UNCOMMON,
        baseRegenRate: 0.3,
        maxAmount: 300,
        gatherTime: 10
    },
    [ResourceType.MANA_CRYSTAL]: {
        type: ResourceType.MANA_CRYSTAL,
        name: '마나석',
        rarity: ResourceRarity.EPIC,
        baseRegenRate: 0.05,
        maxAmount: 100,
        gatherTime: 30
    }
};

module.exports = {
    ResourceType,
    ResourceRarity,
    RESOURCE_DEFINITIONS
};
