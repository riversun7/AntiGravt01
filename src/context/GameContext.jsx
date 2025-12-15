import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { MapService } from '../services/mapService';
import { TILE_TYPES } from '../data/worldData';
import { useGameLoop } from '../hooks/useGameLoop';
import { useTranslation } from '../i18n/i18n';

const GameContext = createContext();

export const useGame = () => useContext(GameContext);

export const GameProvider = ({ children }) => {
    // State
    const [gameState, setGameState] = useState('init'); // init, playing
    const [player, setPlayer] = useState(null);
    const [map, setMap] = useState(null); // World Map
    const [innerMap, setInnerMap] = useState(null); // Current Sector Map
    const [playerPos, setPlayerPos] = useState({ x: 0, y: 0 }); // World Coords
    const [log, setLog] = useState([]);
    const [currentSlot, setCurrentSlot] = useState(null);

    // I18n
    const { t } = useTranslation();

    // --- Game Loop ---
    useGameLoop(gameState, player, setPlayer, map);

    // -------------------------------------------
    // Actions
    // -------------------------------------------

    const addToLog = (msg) => {
        setLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50));
    };

    const loadGame = (slotId) => {
        const stored = localStorage.getItem(`terra_save_${slotId}`);
        if (stored) {
            const p = JSON.parse(stored);
            // Schema Updates
            if (!p.buildings) p.buildings = [];
            if (!p.research) p.research = { completed: [], current: null, progress: 0 };

            setPlayer(p);
            setPlayerPos(p.position || { x: 250, y: 250 });

            console.log(`Loading Slot ${slotId}... Generating Map.`);
            const newMap = MapService.generateWorldMap();
            setMap(newMap);

            setGameState('playing');
            setCurrentSlot(slotId);
            addToLog(`Welcome back, Commander ${p.name}. System Online (Slot ${slotId}).`);
            return true;
        }
        return false;
    };

    const login = (name, slotId) => {
        // New Game
        const newPlayer = {
            name,
            money: 1000,
            energy: 100,
            materials: 50,
            food: 100,
            position: { x: 250, y: 250 },
            inventory: [],
            buildings: [],
            research: { completed: [], current: null, progress: 0 }
        };

        // Generate World
        const newMap = MapService.generateWorldMap();

        setPlayer(newPlayer);
        setMap(newMap);
        setPlayerPos(newPlayer.position);
        setGameState('playing');
        setCurrentSlot(slotId);

        addToLog(`Commander ${name} registered. Neural Link Established on Slot ${slotId}.`);
    };

    const saveGame = () => {
        if (player && currentSlot) {
            const dataToSave = {
                ...player,
                position: playerPos,
                day: 1
            };
            localStorage.setItem(`terra_save_${currentSlot}`, JSON.stringify(dataToSave));
            addToLog("Game Progress Saved.");
            return true;
        }
        return false;
    };

    const logout = () => {
        setPlayer(null);
        setMap(null);
        setInnerMap(null);
        setPlayerPos({ x: 0, y: 0 });
        setLog([]);
        setCurrentSlot(null);
        setGameState('init');
        addToLog("Session terminated. Returning to main menu.");
    };

    // --- Effects ---
    // Autosave
    useEffect(() => {
        if (player && currentSlot) {
            const dataToSave = {
                ...player,
                position: playerPos,
                day: 1
            };
            localStorage.setItem(`terra_save_${currentSlot}`, JSON.stringify(dataToSave));
        }
    }, [player, playerPos, currentSlot]);


    // Return Provider
    return (
        <GameContext.Provider value={{
            gameState, setGameState,
            player, setPlayer,
            map, setMap,
            innerMap, setInnerMap,
            playerPos, setPlayerPos,
            log, addToLog,
            currentSlot,
            t,
            login, logout, loadGame, saveGame
        }}>
            {children}
        </GameContext.Provider>
    );
};
