"use client";

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, RotateCw, X, Hammer, Layers, Move, ChevronsUp, ChevronsDown } from 'lucide-react';

// Tile Types (Placeholder for Kenney Assets)
const TILE_COLORS: Record<string, string> = {
    GRASS: '#7CFC00',
    DIRT: '#8B4513',
    CONCRETE: '#A9A9A9',
    WATER: '#1E90FF',
    BUILDING_BASE: '#555555'
};

const TILE_WIDTH = 64;
// TILE_HEIGHT is now dynamic based on tilt

interface InternalBaseMapProps {
    onClose: () => void;
    gridSize?: number;
}

interface TileData {
    x: number;
    y: number;
    type: string;
    height: number;
    building?: string;
}

interface BuildingType {
    code: string;
    name: string;
    construction_cost: { gold: number; gem: number };
}

export default function InternalBaseMap({ onClose, gridSize = 10 }: InternalBaseMapProps) {
    const [rotation, setRotation] = useState(0);
    const [scale, setScale] = useState(1);
    const [tilt, setTilt] = useState(1.0); // 0.5 (Flat) ~ 1.5 (Top Downish)
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [selectedTool, setSelectedTool] = useState('CURSOR');
    const [isDragging, setIsDragging] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const dragStartRef = useRef<{ x: number, y: number } | null>(null);

    // Dynamic Building List
    const [buildingTypes, setBuildingTypes] = useState<BuildingType[]>([]);

    useEffect(() => {
        // Fetch building types from DB
        fetch('/api/buildings/types')
            .then(res => res.json())
            .then(data => {
                if (data.types) {
                    setBuildingTypes(data.types);
                }
            })
            .catch(err => console.error('Failed to load buildings:', err));
    }, []);

    const [grid, setGrid] = useState<TileData[]>(() => {
        const initial: TileData[] = [];
        for (let x = 0; x < gridSize; x++) {
            for (let y = 0; y < gridSize; y++) {
                initial.push({
                    x,
                    y,
                    type: (x + y) % 2 === 0 ? 'GRASS' : 'CONCRETE',
                    height: 0,
                    building: (x === 5 && y === 5) ? 'COMMAND_CENTER' : undefined
                });
            }
        }
        return initial;
    });

    // Handle Zoom (Wheel)
    const handleWheel = (e: React.WheelEvent) => {
        e.stopPropagation();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setScale(prev => Math.min(Math.max(0.5, prev + delta), 3));
    };

    // Handle Pan (Drag)
    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button === 0) {
            dragStartRef.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
            setIsDragging(false);
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (dragStartRef.current) {
            const newX = e.clientX - dragStartRef.current.x;
            const newY = e.clientY - dragStartRef.current.y;

            if (Math.abs(newX - offset.x) > 5 || Math.abs(newY - offset.y) > 5) {
                setIsDragging(true);
            }
            setOffset({ x: newX, y: newY });
        }
    };

    const handleMouseUp = () => {
        dragStartRef.current = null;
    };

    const effectiveTileHeight = 32 * tilt;

    // Render Grid with correct rotation
    const renderGrid = useMemo(() => {
        return grid.map(tile => {
            let rx = tile.x;
            let ry = tile.y;

            if (rotation === 90) {
                rx = gridSize - 1 - tile.y;
                ry = tile.x;
            } else if (rotation === 180) {
                rx = gridSize - 1 - tile.x;
                ry = gridSize - 1 - tile.y;
            } else if (rotation === 270) {
                rx = tile.y;
                ry = gridSize - 1 - tile.x;
            }

            return { ...tile, renderX: rx, renderY: ry };
        }).sort((a, b) => {
            return (a.renderX + a.renderY) - (b.renderX + b.renderY);
        });
    }, [grid, rotation, gridSize]);

    const handleRotate = (direction: 'CW' | 'CCW') => {
        setRotation(prev => {
            if (direction === 'CW') return (prev + 90) % 360;
            return (prev - 90 + 360) % 360;
        });
    };

    const handleTileClick = (e: React.MouseEvent, targetTile: TileData) => {
        e.stopPropagation();

        if (isDragging) return;

        if (selectedTool === 'CURSOR') {
            console.log('Selected Tile:', targetTile);
            return;
        }

        setGrid(prev => prev.map(tile => {
            if (tile.x === targetTile.x && tile.y === targetTile.y) {
                const newBuilding = tile.building === selectedTool ? undefined : selectedTool;
                return { ...tile, building: newBuilding };
            }
            return tile;
        }));
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="relative w-[90vw] h-[90vh] bg-slate-900 border border-slate-700 rounded-xl overflow-hidden shadow-2xl flex flex-col">

                {/* Header */}
                <div className="h-16 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-6 z-10 select-none">
                    <div className="flex items-center gap-4">
                        <Layers className="text-cyan-400" />
                        <h2 className="text-xl font-bold text-white">Base Layout Editor <span className="text-sm text-gray-400">({gridSize}x{gridSize})</span></h2>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Scale Controls */}
                        <div className="bg-slate-950 rounded flex items-center mr-4">
                            <button onClick={() => setScale(s => Math.max(0.5, s - 0.1))} className="px-3 py-1 text-cyan-400 hover:bg-slate-800 rounded-l">-</button>
                            <span className="text-xs text-gray-400 w-12 text-center">Zoom</span>
                            <button onClick={() => setScale(s => Math.min(3, s + 0.1))} className="px-3 py-1 text-cyan-400 hover:bg-slate-800 rounded-r">+</button>
                        </div>

                        {/* Tilt Controls */}
                        <div className="bg-slate-950 rounded flex items-center mr-4">
                            <button onClick={() => setTilt(t => Math.max(0.5, t - 0.1))} className="px-3 py-1 text-cyan-400 hover:bg-slate-800 rounded-l" title="Flatten"><ChevronsDown size={16} /></button>
                            <span className="text-xs text-gray-400 w-12 text-center">Tilt: {(tilt).toFixed(1)}</span>
                            <button onClick={() => setTilt(t => Math.min(1.5, t + 0.1))} className="px-3 py-1 text-cyan-400 hover:bg-slate-800 rounded-r" title="Steepen"><ChevronsUp size={16} /></button>
                        </div>

                        {/* Rotation */}
                        <button onClick={() => handleRotate('CCW')} className="p-2 hover:bg-slate-700 rounded text-cyan-400 transition-colors"><RotateCcw size={20} /></button>
                        <div className="px-3 py-1 bg-slate-950 rounded text-xs font-mono text-cyan-500 min-w-[60px] text-center">{rotation}°</div>
                        <button onClick={() => handleRotate('CW')} className="p-2 hover:bg-slate-700 rounded text-cyan-400 transition-colors"><RotateCw size={20} /></button>
                    </div>

                    <button onClick={onClose} className="p-2 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Main Viewport */}
                <div
                    ref={containerRef}
                    className="flex-1 overflow-hidden relative bg-slate-950/50 cursor-move active:cursor-grabbing"
                    onWheel={handleWheel}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                >
                    {/* Isometric Grid Container */}
                    <div
                        className="absolute top-1/2 left-1/2 transition-transform duration-75 ease-out origin-center will-change-transform"
                        style={{
                            transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${scale})`,
                            width: gridSize * TILE_WIDTH * 2,
                            height: gridSize * effectiveTileHeight * 2
                        }}
                    >
                        {renderGrid.map((tile) => {
                            // Standard Isometric Formula with Dynamic Height (Tilt)
                            const screenX = (tile.renderX - tile.renderY) * (TILE_WIDTH / 2);
                            const screenY = (tile.renderX + tile.renderY) * (effectiveTileHeight / 2);

                            return (
                                <motion.div
                                    layout
                                    key={`tile-${tile.x}-${tile.y}`}
                                    initial={false}
                                    animate={{
                                        left: `calc(50% + ${screenX}px - ${TILE_WIDTH / 2}px)`,
                                        top: `calc(20% + ${screenY}px)`,
                                        zIndex: tile.renderX + tile.renderY
                                    }}
                                    transition={{
                                        type: "spring",
                                        stiffness: 300,
                                        damping: 30
                                    }}
                                    className="absolute group pointer-events-none" // Parent is pointer-events-none to pass clicks through empty space
                                    style={{
                                        width: TILE_WIDTH,
                                        height: effectiveTileHeight * 2,
                                    }}
                                >
                                    {/* Tile Floor (Hit Target) */}
                                    <div
                                        className="absolute bottom-0 left-0 w-full h-[50%] transition-colors group-hover:brightness-125 cursor-pointer pointer-events-auto" // Child is pointer-events-auto to catch clicks
                                        style={{
                                            backgroundColor: TILE_COLORS[tile.type],
                                            clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
                                            boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.1)'
                                        }}
                                        onClick={(e) => handleTileClick(e, tile)}
                                    />

                                    {/* Building */}
                                    {tile.building && (
                                        <div className="absolute bottom-[25%] left-[0%] w-[100%] h-[150%] z-10 pointer-events-none origin-bottom flex items-end justify-center">
                                            {/* Sprite Image */}
                                            <img
                                                src={`/assets/buildings/${tile.building === 'COMMAND_CENTER' ? 'COMMAND_CENTER.png' :
                                                    tile.building.includes('WALL') ? 'WALL.png' :
                                                        tile.building.includes('TURRET') ? 'TURRET.png' :
                                                            tile.building.includes('POWER') ? 'POWER_PLANT.png' :
                                                                tile.building.includes('FACTORY') ? 'FACTORY.png' :
                                                                    'COMMAND_CENTER.png' // Fallback
                                                    }`}
                                                alt={tile.building}
                                                className="w-full h-auto object-contain drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)]"
                                                style={{
                                                    transform: `translateY(${tilt > 1 ? '-5%' : '5%'}) scale(1.5)` // Scale up sprites slightly
                                                }}
                                            />

                                            {/* Building Label (Optional, maybe smaller) */}
                                            {/* <div className="absolute bottom-0 left-0 w-full text-[6px] text-center text-white bg-black/50 px-1 overflow-hidden">
                                                {tile.building}
                                            </div> */}
                                        </div>
                                    )}

                                    {/* Selection Highlight */}
                                    <div className="absolute top-0 left-0 w-full h-full opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
                                        <div className="absolute bottom-0 left-0 w-full h-[50%]"
                                            style={{
                                                background: 'rgba(255, 255, 255, 0.4)',
                                                clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)'
                                            }}
                                        />
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>

                    <div className="absolute bottom-6 left-6 text-gray-500 pointer-events-none select-none text-sm bg-black/50 px-3 py-1 rounded border border-gray-700">
                        <p className="text-cyan-400 font-bold mb-1">Controls</p>
                        <p>Left Drag: Pan Map</p>
                        <p>Scroll: Zoom In/Out</p>
                    </div>
                </div>

                {/* Sidebar */}
                <div className="w-64 bg-slate-900 border-l border-slate-700 p-4 absolute right-0 top-16 bottom-0 z-20 shadow-xl overflow-y-auto">
                    <h3 className="text-sm font-bold text-gray-400 uppercase mb-4 flex items-center gap-2">
                        <Hammer size={14} /> Building List ({buildingTypes.length})
                    </h3>

                    <button
                        onClick={() => setSelectedTool('CURSOR')}
                        className={`w-full p-2 mb-4 border rounded flex items-center justify-center gap-2 transition-all active:scale-95 ${selectedTool === 'CURSOR'
                            ? 'bg-cyan-900/50 border-cyan-500 text-cyan-400'
                            : 'bg-slate-800 border-slate-600 hover:bg-slate-700 text-gray-400'
                            }`}
                    >
                        <Move size={16} /> <span>Select / Move</span>
                    </button>

                    <div className="grid grid-cols-2 gap-2">
                        {buildingTypes.map(b => (
                            <button
                                key={b.code}
                                onClick={() => setSelectedTool(b.code)}
                                className={`aspect-square border rounded flex flex-col items-center justify-center gap-1 transition-all active:scale-95 p-1 ${selectedTool === b.code
                                        ? 'bg-cyan-900/50 border-cyan-500 text-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.2)]'
                                        : 'bg-slate-800 border-slate-600 hover:bg-slate-700 text-gray-400'
                                    }`}
                                title={`${b.name} (Cost: ${b.construction_cost.gold || 0}G)`}
                            >
                                <img
                                    src={`/assets/buildings/${b.code === 'COMMAND_CENTER' ? 'COMMAND_CENTER.png' :
                                            b.code.includes('WALL') ? 'WALL.png' :
                                                b.code.includes('TURRET') ? 'TURRET.png' :
                                                    b.code.includes('POWER') ? 'POWER_PLANT.png' :
                                                        b.code.includes('FACTORY') ? 'FACTORY.png' :
                                                            'COMMAND_CENTER.png'
                                        }`}
                                    alt={b.name}
                                    className="w-8 h-8 object-contain"
                                />
                                <span className="text-[10px] text-center leading-tight line-clamp-2">{b.name}</span>
                            </button>
                        ))}
                    </div>
                    {buildingTypes.length === 0 && (
                        <div className="text-xs text-gray-500 text-center py-4">Loading buildings...</div>
                    )}
                </div>

            </div>
        </div>
    );
}
