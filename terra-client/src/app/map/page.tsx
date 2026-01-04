"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Map as MapIcon, Maximize, X, Hammer, Zap, Lock } from "lucide-react";

import BuildMenu from "@/components/map/BuildMenu";
import SystemMenu from "@/components/SystemMenu";

interface WorldTile {
    id: string; // x_y
    x: number;
    y: number;
    type: string; // OCEAN, PLAIN, FOREST, MOUNTAIN, CITY, ICE, TUNDRA, DESERT, JUNGLE
    name: string;
    faction?: string; // TERRAN, CYBER, IRON
}

interface LocalTile {
    x: number;
    y: number;
    type: string; // DIRT, ROCK, RUINS, SNOW, SAND, ETC
}

export default function MapPage() {
    const router = useRouter();
    const [macroMap, setMacroMap] = useState<WorldTile[]>([]);
    const [mapDimensions, setMapDimensions] = useState({ w: 20, h: 20 });
    const [isMapLoading, setIsMapLoading] = useState(true);
    const [selectedTile, setSelectedTile] = useState<WorldTile | null>(null);
    const [localMap, setLocalMap] = useState<LocalTile[]>([]);
    const [loadingLocal, setLoadingLocal] = useState(false);
    const [userPos, setUserPos] = useState<string | null>(null);
    const [userId, setUserId] = useState<number | null>(null);

    // New State for Building
    const [showBuildMenu, setShowBuildMenu] = useState(false);
    const [buildTarget, setBuildTarget] = useState<{ x: number, y: number } | null>(null);
    const [resources, setResources] = useState({ gold: 0, gem: 0 });

    useEffect(() => {
        // Init: Get User ID and Position from Correct Storage Key
        const storedUserId = localStorage.getItem('terra_user_id');


        setIsMapLoading(true);

        if (storedUserId) {
            const parsedId = parseInt(storedUserId);
            setUserId(parsedId);

            // Fetch updated user info mainly for pos and resources
            fetch(`http://localhost:3001/api/user/${parsedId}`)
                .then(res => res.json())
                .then(data => {
                    if (data.current_pos) setUserPos(data.current_pos);
                    else setUserPos("10_10");

                    if (data.resources) setResources(data.resources);
                })
                .catch(err => console.error("Fetch User Error:", err));
        } else {
            console.warn("No user found in localStorage, redirecting to login");
            router.push('/login');
        }

        fetch('http://localhost:3001/api/world-map')
            .then(res => {
                if (!res.ok) throw new Error("Failed to fetch map data");
                return res.json();
            })
            .then(data => {

                // Calculate Dimensions
                if (data.length > 0) {
                    const maxX = Math.max(...data.map((t: WorldTile) => t.x));
                    const maxY = Math.max(...data.map((t: WorldTile) => t.y));
                    setMapDimensions({ w: maxX + 1, h: maxY + 1 });
                }
                setMacroMap(data);
                setIsMapLoading(false);
            })
            .catch(err => {
                console.error(err);

                setIsMapLoading(false);
            });
    }, [router]);

    // --- CAMERA & VIEWPORT LOGIC ---
    // Correction for 16:9 Image Aspect Ratio on a 2:1 Grid
    // Legacy Grid: 160x80 (2:1). Image: ~16:9 (1.77:1).
    // To fit image without stretch, we need Tiles to be 0.88 Aspect.
    // 35px / 40px = 0.875 ~ 1.75:1 Total Map Ratio.
    const TILE_W = 35;
    const TILE_H = 40;



    const [viewportSize, setViewportSize] = useState({ w: 0, h: 0 });
    const [cameraPos, setCameraPos] = useState({ x: 0, y: 0 });

    // Handle Window Resize for Viewport centering
    // --- MAP STYLE CONFIGURATION ---
    const MAP_STYLES = [
        { id: 'tactical', name: 'TACTICAL', file: '/maps/tactical_v4.png', color: 'text-cyan-400' },
        { id: 'realistic', name: 'REALISTIC', file: '/maps/realistic_final_4k.png', color: 'text-green-400' },
        { id: 'hologram', name: 'HOLOGRAM', file: '/maps/hologram_v4.png', color: 'text-purple-400' },
        { id: 'strategy', name: 'STRATEGY', file: '/maps/strategy_v3.png', color: 'text-blue-400' },
    ];
    const [currentMap, setCurrentMap] = useState(MAP_STYLES[0]);

    useEffect(() => {
        const handleResize = () => {
            const container = document.getElementById('map-viewport');
            if (container) {
                setViewportSize({ w: container.clientWidth, h: container.clientHeight });
            }
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Update Camera Position when User Moves or Viewport Changes
    useEffect(() => {
        if (!userPos || !mapDimensions.w) return;

        const [ux, uy] = userPos.split('_').map(Number);

        // Calculate World Pixel Coordinates of User Center
        const userPx = ux * TILE_W + (TILE_W / 2);
        const userPy = uy * TILE_H + (TILE_H / 2);

        // Center the camera: Target = Center of Viewport - User Position
        // We clamp ensuring we don't scroll past edges ideally, but for "Endless" feel or simple centering:
        let camX = (viewportSize.w / 2) - userPx;
        let camY = (viewportSize.h / 2) - userPy;

        // Optional: Clamp Logic (Keep within world bounds)
        const maxScrollX = -(mapDimensions.w * TILE_W - viewportSize.w);
        const maxScrollY = -(mapDimensions.h * TILE_H - viewportSize.h);

        // Simple clamp
        if (camX > 0) camX = 0;
        if (camY > 0) camY = 0;
        if (camX < maxScrollX) camX = maxScrollX;
        if (camY < maxScrollY) camY = maxScrollY;

        setCameraPos({ x: camX, y: camY });

    }, [userPos, viewportSize, mapDimensions]);


    // Helper to get center % of a tile (Legacy kept for reference, but we used pixel logic now)
    const getTileCenterX = (coord: number) => {
        return (coord * TILE_W) + (TILE_W / 2);
    };
    const getTileCenterY = (coord: number) => {
        return (coord * TILE_H) + (TILE_H / 2);
    };

    const handleTileClick = async (tile: WorldTile) => {
        // Just Select
        setSelectedTile(tile);
        setLoadingLocal(true);
        refreshLocalMap(tile.id);
    };

    const refreshLocalMap = async (tileId: string) => {
        try {
            const res = await fetch(`http://localhost:3001/api/local-map/${tileId}`);
            const data = await res.json();
            setLocalMap(data.grid);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingLocal(false);
        }
    }

    const handleMoveUnit = async () => {
        if (!selectedTile || !userId) return;

        try {
            const res = await fetch('http://localhost:3001/api/map/move', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, targetId: selectedTile.id })
            });
            const data = await res.json();
            if (data.success) {
                setUserPos(data.current_pos);
            }
        } catch (e) {
            console.error("Move failed", e);
        }
    };

    const handleLocalTileClick = (lTile: LocalTile) => {
        // Only allow building if User is Here
        if (selectedTile?.id !== userPos) return;

        // Check if tile is empty (DIRT, GRASS, PLAIN, SAND, SNOW are buildable?)
        // Simple check: Not already a building
        const buildableTypes = ['DIRT', 'GRASS', 'PLAIN', 'SAND', 'SNOW', 'MUD', 'ROCK'];
        if (buildableTypes.includes(lTile.type)) {
            setBuildTarget({ x: lTile.x, y: lTile.y });
            setShowBuildMenu(true);
        }
    };

    const handleBuild = async (type: string) => {
        if (!userId || !selectedTile || !buildTarget) return;

        try {
            const res = await fetch('http://localhost:3001/api/build', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: userId,
                    type: type,
                    x: buildTarget.x,
                    y: buildTarget.y,
                    world_x: selectedTile.x,
                    world_y: selectedTile.y
                })
            });
            const data = await res.json();

            if (data.success) {
                alert("Construction Complete!"); // Replace with better UI later
                setShowBuildMenu(false);
                refreshLocalMap(selectedTile.id);
                // Refresh resources
                fetch(`http://localhost:3001/api/user/${userId}`)
                    .then(res => res.json())
                    .then(data => { if (data.resources) setResources(data.resources); });
            } else {
                alert("Build Failed: " + data.error);
            }
        } catch (e) {
            console.error(e);
            alert("Build Error: " + e);
        }
    };





    const getLocalTileColor = (type: string) => {
        switch (type) {
            case 'DIRT': return 'bg-amber-900/30 hover:bg-amber-900/50 cursor-pointer';
            case 'ROCK': return 'bg-stone-600/50 hover:bg-stone-600/70 cursor-pointer';
            case 'RUINS': return 'bg-cyan-900/50 border border-cyan-500/30';
            case 'SNOW': return 'bg-white/90 hover:bg-white cursor-pointer';
            case 'ICE_WALL': return 'bg-cyan-300';
            case 'SAND': return 'bg-yellow-500/40 hover:bg-yellow-500/60 cursor-pointer';
            case 'OIL_RIG': return 'bg-black border border-yellow-500';
            case 'MUD': return 'bg-amber-950/60 hover:bg-amber-950/80 cursor-pointer';
            case 'JUNGLE_TREE': return 'bg-lime-800';
            case 'CONCRETE': return 'bg-gray-800';
            // Buildings
            case 'HOUSE': return 'bg-blue-600 border border-blue-400 shadow-[0_0_10px_blue] z-10';
            case 'FACTORY': return 'bg-orange-600 border border-orange-400 shadow-[0_0_10px_orange] z-10';
            case 'MINE': return 'bg-gray-500 border border-gray-300 shadow-[0_0_10px_gray] z-10';
            case 'TURRET': return 'bg-red-600 border border-red-400 shadow-[0_0_10px_red] z-10';
            // Default
            case 'BUILDING': return 'bg-gray-600 border border-gray-500';
            case 'GRASS': return 'bg-green-900/30 hover:bg-green-900/50 cursor-pointer';
            case 'TREE': return 'bg-green-800';
            default: return 'bg-black/20';
        }
    };

    return (
        <div className="min-h-screen bg-background text-white p-4 font-sans overflow-hidden">
            {/* Header */}
            <header className="flex items-center justify-between mb-4 pb-2 border-b border-surface-border">
                <div className="flex items-center gap-4 relative">
                    {/* System Menu Component */}
                    <SystemMenu activePage="map" />
                </div>
                <div>
                    <h1 className="text-xl font-bold flex items-center gap-2 text-cyan-400">
                        <MapIcon /> PLANETARY SCANNER
                    </h1>
                    <p className="text-xs text-gray-500 font-mono">SECTOR: EARTH-PRIME // ORBITAL VIEW</p>
                </div>
            </header>

            {/* Map Selector */}
            <div className="flex gap-2 bg-surface-light p-1 rounded-lg border border-surface-border">
                {MAP_STYLES.map(style => (
                    <button
                        key={style.id}
                        onClick={() => setCurrentMap(style)}
                        className={`px-3 py-1 text-xs font-bold rounded transition-all ${currentMap.id === style.id
                            ? `bg-slate-800 ${style.color} shadow-lg ring-1 ring-white/10`
                            : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'
                            }`}
                    >
                        {style.name}
                    </button>
                ))}
            </div>

            {
                userPos && (
                    <div className="px-4 py-1 bg-surface-light rounded-full border border-surface-border text-xs font-mono text-green-400 animate-pulse">
                        CURRENT POSITION: {userPos}
                    </div>
                )
            }


            <main className="flex h-[calc(100vh-100px)] gap-4">

                {/* Macro Map Viewport (Left) - CAMERA SYSTEM */}
                <div id="map-viewport" className="flex-1 bg-black/80 border border-surface-border rounded-lg overflow-hidden relative group">

                    {/* The "World" Container moving inside Viewport */}
                    <div
                        id="world-map-container"
                        onClick={(e) => {
                            // Coordinate-based Interaction (Performance Optimization)
                            const rect = e.currentTarget.getBoundingClientRect();
                            const x = e.clientX - rect.left;
                            const y = e.clientY - rect.top;

                            const tileX = Math.floor(x / TILE_W);
                            const tileY = Math.floor(y / TILE_H);

                            // Find Data
                            const tile = macroMap.find(t => t.x === tileX && t.y === tileY);
                            if (tile) {
                                handleTileClick(tile);
                            }
                        }}
                        style={{
                            width: `${mapDimensions.w * TILE_W}px`,
                            height: `${mapDimensions.h * TILE_H}px`,
                            transform: `translate3d(${cameraPos.x}px, ${cameraPos.y}px, 0)`,
                            transition: 'transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                            backgroundImage: `url(${currentMap.file})`,
                            backgroundSize: '100% 100%',
                            backgroundRepeat: 'no-repeat'
                        }}
                        className="relative cursor-crosshair"
                    >
                        {/* High-Performance Rendering: Only render relevant overlays, not the full grid */}

                        {/* 1. Faction/Territory Overlays (Optional: Only render relevant ones) */}
                        {macroMap.filter(t => t.faction || t.type === 'CITY').map(tile => (
                            <div
                                key={tile.id}
                                style={{
                                    position: 'absolute',
                                    left: tile.x * TILE_W,
                                    top: tile.y * TILE_H,
                                    width: TILE_W,
                                    height: TILE_H
                                }}
                                className={`pointer-events-none opacity-40 ${tile.faction === 'TERRAN' ? 'bg-blue-500' :
                                    tile.faction === 'IRON' ? 'bg-red-500' :
                                        tile.faction === 'CYBER' ? 'bg-purple-500' : 'bg-yellow-500'
                                    }`}
                            />
                        ))}

                        {/* 2. Selection Highlight */}
                        {selectedTile && (
                            <div
                                style={{
                                    position: 'absolute',
                                    left: selectedTile.x * TILE_W,
                                    top: selectedTile.y * TILE_H,
                                    width: TILE_W,
                                    height: TILE_H
                                }}
                                className="border-2 border-yellow-400 bg-yellow-400/20 shadow-[0_0_15px_rgba(250,204,21,0.5)] z-30 pointer-events-none animate-pulse"
                            />
                        )}

                        {/* 3. User Position Marker */}
                        {userPos && (() => {
                            const [ux, uy] = userPos.split('_').map(Number);
                            return (
                                <div
                                    style={{
                                        position: 'absolute',
                                        left: ux * TILE_W,
                                        top: uy * TILE_H,
                                        width: TILE_W,
                                        height: TILE_H
                                    }}
                                    className="flex items-center justify-center z-40 pointer-events-none"
                                >
                                    <div className="text-2xl filter drop-shadow-[0_0_5px_rgba(34,211,238,0.8)] animate-bounce">🤖</div>
                                    <div className="absolute inset-0 border border-cyan-400 rounded-full animate-ping opacity-20"></div>
                                </div>
                            );
                        })()}

                        {/* SVG Overlay (Inside World Container) */}
                        {userPos && selectedTile && (
                            <svg className="absolute inset-0 w-full h-full z-20 pointer-events-none filter drop-shadow-[0_0_5px_cyan]">
                                <defs>
                                    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                                        <polygon points="0 0, 10 3.5, 0 7" fill="#22d3ee" />
                                    </marker>
                                </defs>
                                <line
                                    x1={getTileCenterX(parseInt(userPos.split('_')[0]))}
                                    y1={getTileCenterY(parseInt(userPos.split('_')[1]))}
                                    x2={getTileCenterX(selectedTile.x)}
                                    y2={getTileCenterY(selectedTile.y)}
                                    stroke="#22d3ee"
                                    strokeWidth="3"
                                    strokeDasharray="10,5"
                                    fill="none"
                                    opacity="0.9"
                                    markerEnd="url(#arrowhead)"
                                >
                                    <animate attributeName="stroke-dashoffset" from="100" to="0" dur="1.5s" repeatCount="indefinite" />
                                </line>
                            </svg>
                        )}
                    </div>

                    {/* Loading State Overlay */}
                    {isMapLoading && (
                        <div className="absolute inset-0 flex items-center justify-center flex-col gap-4 bg-black/90 z-50 text-cyan-400 backdrop-blur-md">
                            <div className="animate-spin w-16 h-16 border-t-4 border-cyan-400 border-r-transparent rounded-full shadow-[0_0_20px_cyan]"></div>
                            <p className="font-mono text-xl animate-pulse tracking-widest">ESTABLISHING UPLINK...</p>
                        </div>
                    )}

                    {/* Mini-map Overlay (Bottom-Right) */}
                    {macroMap.length > 0 && userPos && (
                        <div className="absolute bottom-4 right-4 w-[240px] aspect-[2/1] bg-black/90 border-2 border-cyan-500/50 rounded-lg shadow-2xl overflow-hidden z-40 group-hover:opacity-100 transition-opacity duration-300">
                            {/* Mini Map Image */}
                            <div
                                className="w-full h-full relative"
                                style={{
                                    backgroundImage: 'url(/earth_v8_flat_tactical.png)',
                                    backgroundSize: '100% 100%',
                                }}
                            >
                                {/* User Dot on Mini-map */}
                                <div
                                    className="absolute w-2 h-2 bg-green-500 rounded-full border border-white shadow-[0_0_8px_rgba(34,197,94,1)] animate-pulse"
                                    style={{
                                        left: `${(parseInt(userPos.split('_')[0]) / mapDimensions.w) * 100}%`,
                                        top: `${(parseInt(userPos.split('_')[1]) / mapDimensions.h) * 100}%`,
                                        transform: 'translate(-50%, -50%)'
                                    }}
                                />
                                {/* Viewport Rect (Optional visual aid) */}
                                <div
                                    className="absolute border border-yellow-400/50 bg-yellow-400/10 pointer-events-none"
                                    style={{
                                        width: `${(viewportSize.w / (mapDimensions.w * TILE_W)) * 100}%`,
                                        height: `${(viewportSize.h / (mapDimensions.h * TILE_H)) * 100}%`,
                                        left: `${(-cameraPos.x / (mapDimensions.w * TILE_W)) * 100}%`,
                                        top: `${(-cameraPos.y / (mapDimensions.h * TILE_H)) * 100}%`,
                                    }}
                                />
                            </div>
                            <div className="absolute bottom-0 left-0 bg-black/60 text-[10px] text-cyan-400 px-1 font-mono">GLOBAL SAT-VIEW</div>
                        </div>
                    )}

                </div>

                {/* Local Map / Info Panel (Right) */}
                <div className="w-[350px] bg-surface border border-surface-border rounded-lg flex flex-col shadow-xl z-20">
                    {selectedTile ? (
                        <div className="flex flex-col h-full">
                            {/* Region Header */}
                            <div className="p-4 border-b border-surface-border bg-surface-light">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                            {selectedTile.name}
                                            {selectedTile.faction && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-300">{selectedTile.faction}</span>}
                                        </h2>
                                        <span className="text-xs font-mono text-cyan-400">{selectedTile.type} BIOME</span>
                                    </div>
                                    <button onClick={() => setSelectedTile(null)} className="text-gray-500 hover:text-white"><X size={18} /></button>
                                </div>
                                <div className="mt-2 text-xs text-gray-400 flex justify-between">
                                    <span>Coordinate: {selectedTile.x}, {selectedTile.y}</span>
                                    {userPos === selectedTile.id && <span className="text-green-500 font-bold">YOU ARE HERE</span>}
                                    {userPos && userPos !== selectedTile.id && (
                                        <span className="text-cyan-400 flex items-center gap-1 font-bold">
                                            DIST: {Math.round(Math.sqrt(Math.pow(selectedTile.x - parseInt(userPos.split('_')[0]), 2) + Math.pow(selectedTile.y - parseInt(userPos.split('_')[1]), 2)) * 10) / 10} KM
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Local Map Grid */}
                            <div className="flex-1 p-4 flex flex-col items-center justify-center bg-black/40 relative overflow-hidden">
                                <h3 className="text-sm font-bold mb-4 flex items-center gap-2 text-secondary z-10"><Maximize size={14} /> LOCAL SECTOR SCAN</h3>

                                <div className="absolute inset-0 opacity-10 pointer-events-none"
                                    style={{ backgroundImage: 'radial-gradient(circle at center, #06b6d4 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
                                </div>

                                {loadingLocal ? (
                                    <div className="text-cyan-500 animate-pulse flex flex-col items-center">
                                        <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                                        SCANNING TERRAIN...
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-10 gap-px w-full max-w-[250px] aspect-square border-2 border-surface-border/50 shadow-inner bg-black/50 p-1 relative">
                                        {localMap.map((lTile, idx) => (
                                            <div
                                                key={idx}
                                                className={`aspect-square ${getLocalTileColor(lTile.type)}`}
                                                title={`Local ${lTile.x},${lTile.y}: ${lTile.type}`}
                                                onClick={() => handleLocalTileClick(lTile)}
                                            ></div>
                                        ))}

                                        {/* Build Menu Overlay */}
                                        {showBuildMenu && buildTarget && (
                                            <BuildMenu
                                                x={buildTarget.x}
                                                y={buildTarget.y}
                                                resources={resources}
                                                onBuild={handleBuild}
                                                onClose={() => setShowBuildMenu(false)}
                                            />
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="p-4 border-t border-surface-border bg-surface-light">
                                {userPos === selectedTile.id ? (
                                    <button className="w-full py-3 bg-green-700 hover:bg-green-600 text-white font-bold rounded shadow-lg flex items-center justify-center gap-2 animate-pulse">
                                        ✅ UNIT DEPLOYED HERE
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleMoveUnit}
                                        className="w-full py-3 bg-cyan-700 hover:bg-cyan-600 text-white font-bold rounded shadow-lg flex items-center justify-center gap-2"
                                    >
                                        🚀 INITIATE TRANSFER
                                    </button>
                                )}
                                <p className="text-[10px] text-gray-500 text-center mt-2">Tac-Ops: Select a sector to view data. Click sector again to relocate.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-500 p-8 text-center">
                            <MapIcon size={48} className="mb-4 opacity-20" />
                            <p>Select a Region from the Planetary Scanner to view detailed topography.</p>
                        </div>
                    )}
                </div>

            </main>

        </div >);
}
