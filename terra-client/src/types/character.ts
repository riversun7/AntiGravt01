export type MinionType = 'human' | 'android' | 'creature';
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export type GrowthStage = 'infant' | 'young' | 'adult' | 'elder';

export interface CharacterStats {
    hp: number;
    mp: number;
    strength: number;
    dexterity: number;
    constitution: number;
    agility: number;
    intelligence: number;
    wisdom: number;
}

export interface BaseCharacter extends CharacterStats {
    id: number;
    user_id: number;
    name: string;
    level: number;
    exp: number;
    created_at: string;
}

export interface CyborgData extends BaseCharacter {
    parts_tier: number;
    genetic_tier: number;
}

export interface MinionData extends BaseCharacter {
    type: MinionType;
    lifespan: number | null;
    age: number;
    growth_stage: GrowthStage;
    parts_tier: number | null;
    genetic_tier: number | null;
    rarity: Rarity;
    species: string | null;
    battery: number;
    fuel: number;
    loyalty: number;
    fatigue: number;
    maintenance_cost: number;
}

export interface Equipment {
    user_id?: number;
    minion_id?: number;
    slot: string;
    item_id: number;
    // Joined fields from market_items
    name: string;
    code: string;
    type: 'EQUIPMENT' | 'RESOURCE' | 'CONSUMABLE';
    rarity: Rarity;
    image: string;
    stats: string; // JSON string in DB
}

export interface Skill {
    skill_id: string;
    level: number;
    exp: number;
}

export interface CyborgResponse {
    cyborg: CyborgData;
    equipment: Equipment[];
}

export interface MinionsResponse {
    minions: MinionData[];
}

export interface MinionDetailResponse {
    minion: MinionData;
    equipment: Equipment[];
    skills: Skill[];
}
