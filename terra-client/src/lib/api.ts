import { CyborgResponse, MinionsResponse, MinionDetailResponse, MinionType } from '@/types/character';

import { API_BASE_URL } from './config';

const API_BASE = `${API_BASE_URL}/api`;

export const characterApi = {
    // Cyborg
    getCyborg: async (userId: string | number): Promise<CyborgResponse> => {
        const res = await fetch(`${API_BASE}/character/${userId}/cyborg`);
        if (!res.ok) throw new Error('Failed to fetch cyborg');
        return res.json();
    },

    updateCyborg: async (userId: string | number, name: string) => {
        const res = await fetch(`${API_BASE}/character/${userId}/cyborg`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        if (!res.ok) throw new Error('Failed to update cyborg');
        return res.json();
    },

    // Minions
    getMinions: async (userId: string | number): Promise<MinionsResponse> => {
        const res = await fetch(`${API_BASE}/character/${userId}/minions`);
        if (!res.ok) throw new Error('Failed to fetch minions');
        return res.json();
    },

    getMinion: async (userId: string | number, minionId: number): Promise<MinionDetailResponse> => {
        const res = await fetch(`${API_BASE}/character/${userId}/minion/${minionId}`);
        if (!res.ok) throw new Error('Failed to fetch minion details');
        return res.json();
    },

    createMinion: async (userId: string | number, type: MinionType, name: string, species?: string) => {
        const res = await fetch(`${API_BASE}/character/${userId}/minion`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type, name, species })
        });
        if (!res.ok) throw new Error('Failed to create minion');
        return res.json();
    },

    deleteMinion: async (userId: string | number, minionId: number) => {
        const res = await fetch(`${API_BASE}/character/${userId}/minion/${minionId}`, {
            method: 'DELETE'
        });
        if (!res.ok) throw new Error('Failed to delete minion');
        return res.json();
    },

    // Mechanics
    restMinion: async (userId: string | number, minionId: number) => {
        const res = await fetch(`${API_BASE}/character/${userId}/minion/${minionId}/rest`, {
            method: 'POST'
        });
        if (!res.ok) throw new Error('Failed to rest minion');
        return res.json();
    },

    chargeMinion: async (userId: string | number, minionId: number) => {
        const res = await fetch(`${API_BASE}/character/${userId}/minion/${minionId}/charge`, {
            method: 'POST'
        });
        if (!res.ok) throw new Error('Failed to charge android');
        return res.json();
    },

    feedMinion: async (userId: string | number, minionId: number) => {
        const res = await fetch(`${API_BASE}/character/${userId}/minion/${minionId}/feed`, {
            method: 'POST'
        });
        if (!res.ok) throw new Error('Failed to feed minion');
        return res.json();
    },

    // Equipment
    equipItem: async (userId: string | number, itemId: number, slot: string) => {
        const res = await fetch(`${API_BASE}/equipment/equip`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, itemId, slot })
        });
        if (!res.ok) throw new Error('Failed to equip item');
        return res.json();
    },

    unequipItem: async (userId: string | number, slot: string) => {
        const res = await fetch(`${API_BASE}/equipment/unequip`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, slot })
        });
        if (!res.ok) throw new Error('Failed to unequip item');
        return res.json();
    }
};
