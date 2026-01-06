"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { CyborgData, MinionData, Equipment, CyborgResponse, MinionsResponse, MinionType } from "@/types/character";
import { characterApi } from "@/lib/api";

interface CharacterContextType {
    cyborg: CyborgData | null;
    cyborgEquipment: Equipment[];
    minions: MinionData[];
    loading: boolean;
    error: string | null;
    refreshData: () => Promise<void>;
    produceMinion: (type: MinionType, name: string, species?: string) => Promise<void>;
    restMinion: (id: number) => Promise<void>;
    chargeMinion: (id: number) => Promise<void>;
    feedMinion: (id: number) => Promise<void>;
}

const CharacterContext = createContext<CharacterContextType | undefined>(undefined);

export function CharacterProvider({ children }: { children: ReactNode }) {
    const [cyborg, setCyborg] = useState<CyborgData | null>(null);
    const [cyborgEquipment, setCyborgEquipment] = useState<Equipment[]>([]);
    const [minions, setMinions] = useState<MinionData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const getUserId = () => localStorage.getItem("terra_user_id");

    const refreshData = useCallback(async () => {
        const userId = getUserId();
        if (!userId) {
            setLoading(false);
            return;
        }

        try {
            setError(null);
            // Fetch concurrently
            const [cyborgRes, minionsRes] = await Promise.all([
                characterApi.getCyborg(userId),
                characterApi.getMinions(userId)
            ]);

            setCyborg(cyborgRes.cyborg);
            setCyborgEquipment(cyborgRes.equipment);
            setMinions(minionsRes.minions);
        } catch (err: any) {
            console.error("Failed to load character data:", err);
            setError(err.message || "Failed to load character data");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refreshData();
    }, [refreshData]);

    const produceMinion = async (type: MinionType, name: string, species?: string) => {
        const userId = getUserId();
        if (!userId) return;
        await characterApi.createMinion(userId, type, name, species);
        await refreshData();
    };

    const restMinion = async (id: number) => {
        const userId = getUserId();
        if (!userId) return;
        await characterApi.restMinion(userId, id);
        // Optimistic update or refresh? Refresh is safer for calculated fields like fatigue
        await refreshData();
    };

    const chargeMinion = async (id: number) => {
        const userId = getUserId();
        if (!userId) return;
        await characterApi.chargeMinion(userId, id);
        await refreshData();
    };

    const feedMinion = async (id: number) => {
        const userId = getUserId();
        if (!userId) return;
        await characterApi.feedMinion(userId, id);
        await refreshData();
    };

    return (
        <CharacterContext.Provider value={{
            cyborg,
            cyborgEquipment,
            minions,
            loading,
            error,
            refreshData,
            produceMinion,
            restMinion,
            chargeMinion,
            feedMinion
        }}>
            {children}
        </CharacterContext.Provider>
    );
}

export function useCharacter() {
    const context = useContext(CharacterContext);
    if (!context) throw new Error("useCharacter must be used within a CharacterProvider");
    return context;
}
