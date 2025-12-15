import { useEffect, useRef } from 'react';

export const useGameLoop = (gameState, player, setPlayer, map, tickRate = 1000) => {
    const lastTick = useRef(Date.now());

    // Economy Logic Calculation (Refactored out for clarity to be used inside the tick)
    const calculateEconomy = (currentPlayer) => {
        let newMoney = currentPlayer.money;
        let newEnergy = currentPlayer.energy;
        let newMaterials = currentPlayer.materials;

        // Base Passive Income (Basic UBI for Cyborgs)
        newMoney += 1;

        // Apply Building Effects
        // We need to iterate over *all* buildings the player owns.
        // Currently, buildings are stored in 'innerMap' tiles. 
        // We probably need a simpler 'ownedBuildings' list in player state for performance,
        // OR we iterate the map (too slow for 500x500, but inner maps are generated on fly).

        // ARCHITECTURE NOTE:
        // To support "Active Economy" while away, we need persistent buildings data.
        // Currently `innerMap` is generated on enter. 
        // WE NEED A PERSISTENT BUILDING STORE. 
        // For now, let's assume we add a 'buildings' array to player state.

        if (currentPlayer.buildings) {
            currentPlayer.buildings.forEach(b => {
                if (b.production) {
                    if (b.production.energy) newEnergy += b.production.energy;
                    if (b.production.materials) newMaterials += b.production.materials;
                    if (b.production.money) newMoney += b.production.money;
                }
                if (b.consumption) {
                    if (b.consumption.energy) newEnergy -= b.consumption.energy;
                }
            });
        }

        // --- Research Logic ---
        // We do this in the loop so it ticks forward
        const researchState = currentPlayer.research || { completed: [], current: null, progress: 0 };
        let newResearch = { ...researchState };

        if (newResearch.current) {
            // Assume 1 tick = 1 progress for now (can be boosted by Lab buildings later)
            newResearch.progress += 1;

            // Check Completion
            // We need to look up cost/time from TECH_TREE, but hooks shouldn't import large data if possible?
            // Actually it is fine to import constants.
            // But we need to pass the target duration.
            // For now, let's assume the component sets the 'target' value in state or we look it up here.
            // Let's rely on the metadata stored in 'current' which should probably duplicate the limit
            // OR simpler: just increment. Check completion in the component or here if we import data.
        }

        // --- Threat & Defense System ---
        let threatLevel = currentPlayer.threatLevel || 0;
        let defenseLevel = 0;

        // Calculate Defense
        if (currentPlayer.buildings) {
            currentPlayer.buildings.forEach(b => {
                if (b.defense) defenseLevel += b.defense;
            });
        }

        // Increase Threat (Time-based scaling)
        threatLevel += 0.5; // Increases slowly every second

        // Trigger Attack
        if (threatLevel > 100) {
            // Attack!
            const damage = Math.max(0, threatLevel - defenseLevel);

            if (damage > 0) {
                // Take damage (lose resources for now, simplified)
                // In a real game, destroy buildings.
                const lostMoney = Math.floor(damage * 10);
                newMoney = Math.max(0, newMoney - lostMoney);
                // console.log("ATTACK! Damage:", damage, "Lost Money:", lostMoney);
                // We should log this! But hook cannot access `addToLog` easily unless passed.
                // We'll rely on player noticing money drop or visual indicator.
            }

            // Reset Threat after attack (wave cleared)
            threatLevel = 0;
        }

        return {
            ...currentPlayer,
            money: newMoney,
            energy: Math.max(0, newEnergy),
            materials: newMaterials,
            research: newResearch,
            threatLevel,
            defenseLevel // Store for UI
        };
    };

    useEffect(() => {
        if ((gameState !== 'dashboard' && gameState !== 'playing') || !player) return;

        const interval = setInterval(() => {
            const now = Date.now();
            const delta = now - lastTick.current;

            if (delta >= tickRate) {
                // TICK
                setPlayer(prev => calculateEconomy(prev));
                lastTick.current = now;
            }
        }, tickRate);

        return () => clearInterval(interval);
    }, [gameState, setPlayer, tickRate]); // removed player dependency to avoid interval reset on every change, relying on functional state update
};
