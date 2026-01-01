export interface AdminUser {
    id: number;
    username: string;
    role: string;
    cyborg_model: string;
    gold: number;
    gem: number;
    strength: number;
    agility: number;
    intelligence: number;
    wisdom: number;
    dexterity: number;
    constitution: number;
    last_login: string;
}

export interface ServerFile {
    name: string;
    path: string;
}
