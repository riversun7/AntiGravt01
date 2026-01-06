export interface Item {
    id: number;
    name: string;
    code: string;
    description: string;
    type: 'RESOURCE' | 'EQUIPMENT' | 'CONSUMABLE';
    slot?: string;
    stats?: string;
    quantity?: number;
    rarity?: string;
    image?: string;
    base_price?: number;
    current_price?: number;
}
