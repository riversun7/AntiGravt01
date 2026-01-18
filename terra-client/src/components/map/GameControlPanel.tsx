"use client";

import { useState, useRef, useEffect } from 'react';
import { Info, Hammer, Map, Zap, UserPlus, LucideIcon, MapPin, X } from 'lucide-react';
import { TileProvider } from '@/components/map/TileProviderSelector';

import { API_BASE_URL } from '@/lib/config';

// Internal NPC Spawner Component
function NPCSpawner({ selectedTile }: { selectedTile: any }) {
    const [name, setName] = useState('');
    const [color, setColor] = useState('#ff0000');

    const handleSpawn = async () => {
        if (!name) return alert('Name is required');
        try {
            const res = await fetch(`${API_BASE_URL}/api/admin/spawn-free-npc`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    color,
                    lat: selectedTile?.clickLat,
                    lng: selectedTile?.clickLng
                })
            });
            const data = await res.json();
            if (data.success) {
                alert('Spawned!');
                setName('');
            } else {
                alert('Error: ' + data.error);
            }
        } catch (e) {
            console.error(e);
            alert('Spawn failed');
        }
    };

    return (
        <div className="flex flex-col gap-2">
            <input
                type="text"
                placeholder="Faction Name"
                value={name}
                onChange={e => setName(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-white text-xs p-1 rounded"
            />
            <div className="flex gap-2">
                <input
                    type="color"
                    value={color}
                    onChange={e => setColor(e.target.value)}
                    className="h-6 w-6 rounded cursor-pointer"
                />
                <button
                    onClick={handleSpawn}
                    disabled={!selectedTile}
                    className="flex-1 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded"
                >
                    Spawn Here
                </button>
            </div>
            {!selectedTile && <div className="text-[10px] text-orange-400">Select a tile first</div>}
        </div>
    );
}

interface GameControlPanelProps {
    // Info tab
    playerPosition: [number, number];
    playerResources: { gold: number; gem: number };
    buildings: Array<{ id: number; type: string; lat: number; lng: number; level?: number; user_id?: number | string; owner_name?: string; }>;
    isConstructing: boolean;
    constructingBuildingName?: string | null;
    constructionTimeLeft: number;
    currentTick?: number;
    isAdmin?: boolean; // Added prop for Admin Mode
    username?: string; // Added prop for User Display

    // Units tab
    minions: Array<{ id: number; name: string; type: string; hp: number; battery: number; fatigue: number; status?: string }>;

    // Build & Interaction
    onBuild: (buildingId: string) => void;
    onBuildingClick?: (building: { id: number; type: string; lat: number; lng: number; level?: number; user_id?: number | string; owner_name?: string; }) => void;

    // Map Interaction
    selectedTile: any | null;
    onCloseTileInfo: () => void;
    onMoveToTile: (x: number, y: number) => void;

    // Territory Interaction
    selectedTerritory?: {
        id: number;
        owner_name: string;
        level: number;
        radius: number;
        is_absolute: boolean;
        npc_type?: string;
    } | null;
    onCloseTerritoryInfo?: () => void;

    // Building Interaction
    selectedBuilding?: { id: number; type: string; lat: number; lng: number; level?: number; user_id?: number | string; owner_name?: string; } | null;
    onCloseBuildingInfo?: () => void;
    demolitionStates?: Record<number, number>; // buildingId -> finishTimestamp
    onBuildingAction?: (action: 'assign' | 'collect' | 'destroy' | 'cancel_destroy', buildingId: number) => void;

    // Settings tab (Tiles + Actions)
    currentTileProvider: string;
    onTileProviderChange: (provider: TileProvider) => void;
    tileProviders: TileProvider[];

    geolocation: any; // Add geolocation prop
}

type TabType = 'info' | 'units' | 'build' | 'buildings' | 'settings';

export default function GameControlPanel({
    playerPosition,
    playerResources,
    buildings,
    isConstructing,
    constructingBuildingName,
    constructionTimeLeft,
    currentTick = 0,
    isAdmin = false, // Default false for security
    minions = [],
    onBuild,
    onBuildingClick,
    selectedTile,
    onCloseTileInfo,
    onMoveToTile,
    selectedTerritory,
    onCloseTerritoryInfo,
    selectedBuilding,
    onCloseBuildingInfo,
    demolitionStates = {},
    onBuildingAction,
    currentTileProvider,
    onTileProviderChange,
    tileProviders,
    geolocation,
    username,
}: GameControlPanelProps) {
    const [activeTab, setActiveTab] = useState<TabType>('info');
    const [terrainInfo, setTerrainInfo] = useState<any>(null);

    // Fetch Terrain Info
    useEffect(() => {
        if (selectedTile) {
            fetch(`${API_BASE_URL}/api/map/terrain?lat=${selectedTile.clickLat}&lng=${selectedTile.clickLng}`)
                .then(res => res.json())
                .then(data => setTerrainInfo(data))
                .catch(err => console.error(err));
        } else {
            setTerrainInfo(null);
        }
    }, [selectedTile]);

    // Admin Action State
    const [adminActionType, setAdminActionType] = useState<'MOVE' | 'OWNER' | 'TELEPORT' | 'DESTROY' | null>(null);
    const [adminInputValue, setAdminInputValue] = useState('');
    const [adminStatus, setAdminStatus] = useState({ loading: false, msg: null as string | null, isError: false });

    // Admin Config State
    const [adminSettings, setAdminSettings] = useState({ speed: 10000, viewRange: 99999 }); // speed: m/s, viewRange: km

    useEffect(() => {
        if (isAdmin) {
            fetch(`${API_BASE_URL}/api/admin/config`)
                .then(res => res.json())
                .then(data => {
                    if (data.speed !== undefined) {
                        setAdminSettings(prev => ({
                            ...prev,
                            speed: data.speed * 1000, // Client uses m/s, Server uses km/s
                            viewRange: data.viewRange
                        }));
                    }
                })
                .catch(console.error);
        }
    }, [isAdmin]);

    const handleConfigSubmit = async (key: 'speed' | 'viewRange', value: number) => {
        try {
            const body: any = {};
            if (key === 'speed') body.speed = value / 1000; // Client m/s -> Server km/s
            if (key === 'viewRange') body.viewRange = value;

            const res = await fetch(`${API_BASE_URL}/api/admin/config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await res.json();
            if (data.success) {
                setAdminStatus({ loading: false, msg: `Updated ${key}! Reloading...`, isError: false });
                setTimeout(() => {
                    window.location.reload();
                }, 800);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleAdminSubmit = async () => {
        if (!selectedBuilding || !adminActionType) return;
        setAdminStatus({ loading: true, msg: null, isError: false });

        try {
            let res;
            if (adminActionType === 'MOVE') {
                const [lat, lng] = adminInputValue.split(',').map(s => parseFloat(s.trim()));
                if (isNaN(lat) || isNaN(lng)) throw new Error('Invalid coordinates');

                res = await fetch(`${API_BASE_URL}/api/admin/buildings/${selectedBuilding.id}?userId=${isAdmin ? '1' : '0'}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ x: lat, y: lng })
                });
            } else if (adminActionType === 'OWNER') {
                res = await fetch(`${API_BASE_URL}/api/admin/buildings/${selectedBuilding.id}?userId=${isAdmin ? '1' : '0'}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ownerId: adminInputValue })
                });
            } else if (adminActionType === 'TELEPORT') {
                res = await fetch(`${API_BASE_URL}/api/admin/buildings/${selectedBuilding.id}?userId=${isAdmin ? '1' : '0'}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ x: playerPosition[0], y: playerPosition[1] })
                });
            } else if (adminActionType === 'DESTROY') {
                res = await fetch(`${API_BASE_URL}/api/admin/buildings/${selectedBuilding.id}?userId=${isAdmin ? '1' : '0'}`, { method: 'DELETE' });
            }

            if (res && !res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || `Server returned ${res.status}`);
            }

            // Success
            setAdminStatus({ loading: false, msg: 'Success. Reloading...', isError: false });

            setTimeout(() => {
                window.location.reload();
            }, 800);

        } catch (e: any) {
            console.error(e);
            setAdminStatus({ loading: false, msg: e.message || String(e), isError: true });
        }
    };

    // Admin Terrain Set Helper
    const setTerrainOverride = async (type: string) => {
        if (!selectedTile) return;
        try {
            // Send Lat/Lng directly. Server handles legacy grid conversion if needed.
            await fetch(`${API_BASE_URL}/api/admin/tile`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    lat: selectedTile.clickLat,
                    lng: selectedTile.clickLng,
                    terrain_type: type,
                    notes: 'Admin Tool'
                })
            });
            // Refresh
            const res = await fetch(`${API_BASE_URL}/api/map/terrain?lat=${selectedTile.clickLat}&lng=${selectedTile.clickLng}`);
            const data = await res.json();
            setTerrainInfo(data);
        } catch (e) { console.error(e); }
    };

    // Auto-switch to 'info' or a 'selection' view when tile or building is selected
    // Auto-switch removed by user request
    // useEffect(() => {
    //     if (selectedTile || selectedBuilding || selectedTerritory) {
    //         setActiveTab('info');
    //     }
    // }, [selectedTile, selectedBuilding, selectedTerritory]);

    const tabs: Array<{ id: TabType; label: string; icon: LucideIcon }> = [
        { id: 'info', label: '정보', icon: Info },
        { id: 'units', label: '유닛', icon: UserPlus },
        { id: 'buildings', label: '건물', icon: Hammer },
        { id: 'build', label: '건설', icon: Zap },
        { id: 'settings', label: '설정', icon: Map },
    ];



    const [buildingTypes, setBuildingTypes] = useState<any[]>([]);

    useEffect(() => {
        fetch(`${API_BASE_URL}/api/buildings/types`)
            .then(res => res.json())
            .then(data => {
                if (data.types) setBuildingTypes(data.types);
            })
            .catch(err => console.error("Failed to load building types:", err));
    }, []);

    // Dynamic Categories Generation
    const categoriesMap: Record<string, { id: string, label: string, order: number }> = {
        'TERRITORY': { id: 'territory', label: '👑 영토', order: 1 },
        'ADMIN': { id: 'territory', label: '👑 영토', order: 1 }, // Merge Admin into Territory
        'RESOURCE': { id: 'resource', label: '🔨 자원', order: 2 },
        'STORAGE': { id: 'storage', label: '📦 저장', order: 3 },
        'HOUSING': { id: 'living', label: '🏡 생활', order: 4 },
        'MILITARY': { id: 'military', label: '⚔️ 군사', order: 5 },
        'INDUSTRIAL': { id: 'industrial', label: '🏭 산업', order: 6 },
        'RESEARCH': { id: 'research', label: '🧪 연구', order: 7 },
    };

    const buildingCategories = Object.values(categoriesMap)
        .filter((v, i, a) => a.findIndex(t => t.id === v.id) === i) // Unique by id
        .sort((a, b) => a.order - b.order)
        .map(cat => ({
            ...cat,
            buildings: buildingTypes.filter(b => {
                const mapped = categoriesMap[b.category] || { id: 'other' };
                return mapped.id === cat.id;
            }).map(b => ({
                id: b.code,
                name: b.name,
                cost: b.construction_cost,
                buildTime: b.tier * 30, // Estimate build time based on tier
                desc: b.description
            }))
        }))
        .filter(cat => cat.buildings.length > 0);

    // Helper to render building name/icon
    const getBuildingInfo = (type: string) => {
        const iconMap: Record<string, string> = {
            'AREA_BEACON': '📡',
            'COMMAND_CENTER': '🏰',
            'CENTRAL_CONTROL_HUB': '🏢',
            'BASIC_QUARTERS': '🏠',
            'BASIC_WAREHOUSE': '📦',
            'ADVANCED_WAREHOUSE': '🏭',
            'LUMBERYARD': '🪓',
            'MINE': '⛏️',
            'FARM': '🌾',
            'RESEARCH_LAB': '🧪',
            'BARRACKS': '⚔️',
            'FACTORY': '🏭'
        };

        // Find in loaded types for dynamic fallback
        const loaded = buildingTypes.find(b => b.code === type);

        return {
            icon: iconMap[type] || iconMap[type.toUpperCase()] || '🏗️',
            name: loaded ? loaded.name : type,
            desc: loaded ? loaded.description : '알 수 없는 건물'
        };
    };

    return (
        <div className="w-full h-full bg-slate-900 border-t md:border-t-0 md:border-l border-slate-700 flex flex-col">
            {/* Header / Title */}
            <div className="p-3 border-b border-white/10 flex items-center justify-between shrink-0 h-14 bg-slate-900/80 backdrop-blur-md">
                <h2 className="font-bold text-lg text-white flex items-center gap-2">
                    <span className="text-xl">🎮</span> <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">Control Panel</span>
                </h2>
                <div className="flex gap-4 text-xs font-mono bg-black/40 px-3 py-1 rounded-full border border-white/5">
                    <div className="flex items-center gap-2">
                        <span>💰</span> <span className="text-yellow-400 font-bold drop-shadow-[0_0_5px_rgba(250,204,21,0.5)]">{playerResources.gold}</span>
                    </div>
                    <div className="w-px h-3 bg-white/20"></div>
                    <div className="flex items-center gap-2">
                        <span>💎</span> <span className="text-cyan-400 font-bold drop-shadow-[0_0_5px_rgba(34,211,238,0.5)]">{playerResources.gem}</span>
                    </div>
                </div>
            </div>

            {/* TOP SECTION: Contextual Info (Fixed Height or Dynamic) */}
            <div className="border-b border-white/10 bg-slate-800/30 min-h-[100px] p-4 flex flex-col shrink-0 backdrop-blur-sm">
                {/* Scenario 1: Selected Tile */}
                {selectedTile && !selectedBuilding && (
                    <div className="animate-fadeIn w-full h-full flex flex-col">
                        <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <MapPin className="text-cyan-400" size={18} />
                                <span className="font-bold text-white text-md">
                                    {selectedTile.name || (selectedTile.clickLat && selectedTile.clickLng
                                        ? `Loc: ${selectedTile.clickLat.toFixed(4)}, ${selectedTile.clickLng.toFixed(4)}`
                                        : 'Location Selected')}
                                </span>
                            </div>
                            <button onClick={onCloseTileInfo} className="text-slate-400 hover:text-white p-1">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs text-slate-300 mb-4 flex-1">
                            <div>Type: <span className="text-white">{selectedTile.type}</span></div>
                            <div className="col-span-2">
                                <div className="text-xs text-slate-400 mb-1">Territory Owner(s):</div>
                                {selectedTile.overlappingTerritories && selectedTile.overlappingTerritories.length > 0 ? (
                                    <div className={`${selectedTile.overlappingTerritories.length > 1 ? 'text-red-400 font-bold' : 'text-green-400'}`}>
                                        {selectedTile.overlappingTerritories.length > 1 && (
                                            <div className="text-xs text-red-300 mb-1">⚠️ OVERLAP DETECTED</div>
                                        )}
                                        {selectedTile.overlappingTerritories.map((t: any, idx: number) => (
                                            <div key={idx} className="text-xs border-l-2 border-slate-600 pl-2 mb-1">
                                                #{t.id} • User {t.user_id} • {t.owner_name || 'Unknown'} • {t.type} ({t.radius}km)
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <span className="text-slate-500">None</span>
                                )}
                            </div>
                            <div className="col-span-2 bg-slate-800 p-2 rounded mt-2 border border-slate-700">
                                <div className="text-[10px] text-slate-400 uppercase font-bold">TERRAIN SCAN</div>
                                {terrainInfo ? (
                                    <div className="flex justify-between items-center mt-1">
                                        <div className="text-white font-bold flex items-center gap-2">
                                            {terrainInfo.type === 'MOUNTAIN' ? '⛰️' : terrainInfo.type === 'WATER' ? '🌊' : '🌲'}
                                            {terrainInfo.type}
                                        </div>
                                        <div className="text-cyan-400 font-mono text-xs">
                                            {typeof terrainInfo.elevation === 'number' ? terrainInfo.elevation.toFixed(1) : '0.0'}m
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-slate-500 italic">Scanning...</div>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 mt-auto">
                            <button
                                onClick={() => onMoveToTile(selectedTile.clickLat, selectedTile.clickLng)}
                                className="bg-blue-600 hover:bg-blue-500 text-white py-2 rounded text-xs font-bold transition-colors flex items-center justify-center gap-1 shadow-lg shadow-blue-900/20"
                            >
                                🏃 이동하기
                            </button>
                            <button
                                onClick={() => setActiveTab('build')}
                                className="bg-amber-600 hover:bg-amber-500 text-white py-2 rounded text-xs font-bold transition-colors flex items-center justify-center gap-1 shadow-lg shadow-amber-900/20"
                            >
                                🏗️ 건설하기
                            </button>
                        </div>
                    </div>
                )}

                {/* Scenario 2: Selected Building */}
                {selectedBuilding && (
                    <div className="animate-fadeIn w-full h-full flex flex-col">
                        <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <Hammer className="text-purple-400" size={18} />
                                <span className="font-bold text-white text-md">
                                    {getBuildingInfo(selectedBuilding.type).name}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                {demolitionStates[selectedBuilding.id] ? (
                                    <span className="text-[10px] bg-red-500/20 text-red-300 px-2 py-0.5 rounded animate-pulse">
                                        🚧 철거 중 ({Math.max(0, Math.ceil((demolitionStates[selectedBuilding.id] - currentTick) / 1000))}s)
                                    </span>
                                ) : (
                                    <span className="text-[10px] bg-green-500/20 text-green-300 px-2 py-0.5 rounded">
                                        정상 가동
                                    </span>
                                )}
                                <button onClick={onCloseBuildingInfo} className="text-slate-400 hover:text-white p-1">
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 text-xs text-slate-300 space-y-1 mb-2">
                            <p className="text-slate-400 italic mb-2">{getBuildingInfo(selectedBuilding.type).desc}</p>
                            <div className="grid grid-cols-2 gap-2">
                                <div>ID: <span className="font-mono text-slate-500">#{selectedBuilding.id}</span></div>
                                <div className="col-span-2">Owner: <span className="text-blue-400 font-bold">#{selectedBuilding.user_id} {selectedBuilding.owner_name || ''}</span></div>
                                <div>Level: <span className="text-yellow-400 font-bold">LV.{selectedBuilding.level || 1}</span></div>
                                <div>내구도: <span className="text-green-400">100%</span></div>
                                <div>생산력: <span className="text-blue-400">12/h</span></div>
                                <div className="col-span-2">Location: <span className="font-mono">{selectedBuilding.lat.toFixed(4)}, {selectedBuilding.lng.toFixed(4)}</span></div>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-1 mt-auto">
                            <button
                                onClick={() => onBuildingAction?.('collect', selectedBuilding.id)}
                                disabled={!!demolitionStates[selectedBuilding.id]}
                                className="bg-green-600/20 hover:bg-green-600/40 border border-green-500/50 text-green-300 py-2 rounded text-[10px] font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                수집
                            </button>
                            <button
                                onClick={() => onBuildingAction?.('assign', selectedBuilding.id)}
                                disabled={!!demolitionStates[selectedBuilding.id]}
                                className="bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/50 text-blue-300 py-2 rounded text-[10px] font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                배치
                            </button>

                            {demolitionStates[selectedBuilding.id] ? (
                                <button
                                    onClick={() => onBuildingAction?.('cancel_destroy', selectedBuilding.id)}
                                    className="bg-yellow-600/20 hover:bg-yellow-600/40 border border-yellow-500/50 text-yellow-300 py-2 rounded text-[10px] font-bold animate-pulse"
                                >
                                    철거 취소
                                </button>
                            ) : (
                                <button
                                    onClick={() => onBuildingAction?.('destroy', selectedBuilding.id)}
                                    className="bg-red-600/20 hover:bg-red-600/40 border border-red-500/50 text-red-300 py-2 rounded text-[10px] font-bold"
                                >
                                    철거 요청
                                </button>
                            )}
                        </div>

                        {/* Admin Action Panel */}
                        {isAdmin && (
                            <div className="mt-3 pt-3 border-t border-red-500/30">
                                <div className="text-[10px] font-bold text-red-400 mb-2 flex items-center gap-1">
                                    <span>🛡️ ADMIN CONTROLS</span>
                                </div>
                                <div className="grid grid-cols-2 gap-1 mb-1">
                                    <button
                                        onClick={() => {
                                            setAdminActionType('MOVE');
                                            setAdminInputValue(`${selectedBuilding.lat}, ${selectedBuilding.lng}`);
                                        }}
                                        className="bg-blue-900/40 hover:bg-blue-800/60 border border-blue-700/50 text-blue-200 py-1.5 rounded text-[10px] flex items-center justify-center gap-1"
                                    >
                                        📍 Move (Coord)
                                    </button>
                                    <button
                                        onClick={() => setAdminActionType('TELEPORT')}
                                        className="bg-blue-900/40 hover:bg-blue-800/60 border border-blue-700/50 text-blue-200 py-1.5 rounded text-[10px] flex items-center justify-center gap-1"
                                    >
                                        🏃 Teleport Here
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 gap-1">
                                    <button
                                        onClick={() => {
                                            setAdminActionType('OWNER');
                                            setAdminInputValue('');
                                        }}
                                        className="bg-purple-900/40 hover:bg-purple-800/60 border border-purple-700/50 text-purple-200 py-1.5 rounded text-[10px] flex items-center justify-center gap-1"
                                    >
                                        👤 Assign Owner
                                    </button>
                                    <button
                                        onClick={() => setAdminActionType('DESTROY')}
                                        className="bg-red-900/40 hover:bg-red-800/60 border border-red-700/50 text-red-200 py-1.5 rounded text-[10px] flex items-center justify-center gap-1"
                                    >
                                        💣 Force Destroy
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Scenario 4: Selected Territory */}
                {selectedTerritory && !selectedTile && !selectedBuilding && (
                    <div className="animate-fadeIn w-full h-full flex flex-col">
                        <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <span className="text-2xl">🛡️</span>
                                <div className="flex flex-col">
                                    <span className="font-bold text-white text-md tracking-tight">
                                        {selectedTerritory.owner_name}
                                    </span>
                                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                                        Territory Control
                                    </span>
                                </div>
                            </div>
                            <button onClick={onCloseTerritoryInfo} className="text-slate-400 hover:text-white p-1">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="flex-1 space-y-3 mt-2">
                            <div className="p-3 bg-purple-900/20 border border-purple-500/30 rounded-lg">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-xs text-purple-300 font-bold uppercase">Faction Type</span>
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded border ${selectedTerritory.npc_type === 'ABSOLUTE'
                                        ? 'bg-red-900/40 text-red-300 border-red-700'
                                        : 'bg-green-900/40 text-green-300 border-green-700'
                                        }`}>
                                        {selectedTerritory.npc_type || 'PLAYER'}
                                    </span>
                                </div>
                                <div className="text-[10px] text-slate-400">
                                    {selectedTerritory.npc_type === 'ABSOLUTE'
                                        ? 'Invulnerable Absolute Territory'
                                        : 'Standard Expandable Territory'}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="bg-slate-800/50 p-2 rounded border border-slate-700">
                                    <div className="text-slate-500 mb-1">HQ Level</div>
                                    <div className="text-white font-bold text-lg">Lv.{selectedTerritory.level}</div>
                                </div>
                                <div className="bg-slate-800/50 p-2 rounded border border-slate-700">
                                    <div className="text-slate-500 mb-1">Radius</div>
                                    <div className="text-white font-bold text-lg">{selectedTerritory.radius}km</div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Scenario 3: Default (Player Info) */}
                {/* Scenario 3: Default (Player Info) - REMOVED from top, moved to Info Tab */}
                {!selectedTile && !selectedBuilding && !selectedTerritory && (
                    <div className="w-full h-full flex flex-col justify-center items-center">
                        <div className="text-slate-500 text-sm font-bold flex items-center gap-2">
                            <Info size={18} />
                            <span>상세 정보</span>
                        </div>
                        <div className="text-[10px] text-slate-600 mt-1">
                            맵의 요소를 선택하세요
                        </div>
                    </div>
                )}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {/* Info Tab */}
                {activeTab === 'info' && (
                    <div className="space-y-4">
                        {/* Unified Commander Dashboard - ALWAYS VISIBLE */}
                        <div className="bg-slate-800/50 rounded-lg p-4 transition-all hover:bg-slate-800/70 border border-slate-700/50">
                            {/* Header: Identity & Status */}
                            <div className="flex items-center gap-3 mb-4 border-b border-white/10 pb-3">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl shadow-lg border-2 border-white/20
                                    ${isAdmin
                                        ? 'bg-gradient-to-br from-red-600 to-orange-600 shadow-red-900/50'
                                        : 'bg-gradient-to-br from-purple-500 to-indigo-600 shadow-purple-900/50'
                                    }`}>
                                    {isAdmin ? '🦁' : '👾'}
                                </div>
                                <div className="flex-1">
                                    <div className="text-white font-bold text-sm flex items-center gap-2">
                                        {username || (isAdmin ? 'Administrator' : 'Commander')}
                                        {isAdmin && <span className="text-[10px] bg-red-600 text-white px-1.5 py-0.5 rounded font-mono">OP</span>}
                                    </div>
                                    <div className="text-slate-400 text-xs flex items-center gap-1.5 mt-0.5">
                                        <div className={`w-2 h-2 rounded-full ${isConstructing ? 'bg-orange-500 animate-pulse shadow-[0_0_8px_rgba(249,115,22,0.6)]' : 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]'}`}></div>
                                        {isConstructing ? (
                                            <span className="text-orange-300 font-semibold">Constructing...</span>
                                        ) : (
                                            <span className="text-emerald-400 font-semibold">Online</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Stats Grid */}
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                {/* Speed */}
                                <div className="bg-slate-900/50 p-2.5 rounded border border-slate-700/50 flex flex-col justify-between">
                                    <div className="text-slate-500 mb-0.5 font-medium">Top Speed</div>
                                    <div>
                                        {isAdmin ? (
                                            <div className="flex items-center gap-1">
                                                <input
                                                    type="number"
                                                    value={adminSettings.speed}
                                                    onChange={(e) => setAdminSettings(prev => ({ ...prev, speed: Number(e.target.value) }))}
                                                    onKeyDown={(e) => e.key === 'Enter' && handleConfigSubmit('speed', adminSettings.speed)}
                                                    className="bg-transparent border-b border-red-500/50 text-red-400 font-mono font-bold text-sm w-16 focus:outline-none focus:border-red-400"
                                                />
                                                <span className="text-[10px] text-red-500">m/s</span>
                                            </div>
                                        ) : (
                                            <div className="font-mono font-bold text-sm text-cyan-400">100 m/s</div>
                                        )}
                                        <div className="text-[10px] text-slate-600">
                                            {isAdmin ? 'Enter to Apply' : '(360 km/h)'}
                                        </div>
                                    </div>
                                </div>

                                {/* View Range (Foreign Buildings) */}
                                <div className="bg-slate-900/50 p-2.5 rounded border border-slate-700/50 flex flex-col justify-between">
                                    <div className="text-slate-500 mb-0.5 font-medium">View Range</div>
                                    <div>
                                        {isAdmin ? (
                                            <div className="flex items-center gap-1">
                                                <input
                                                    type="number"
                                                    value={adminSettings.viewRange}
                                                    onChange={(e) => setAdminSettings(prev => ({ ...prev, viewRange: Number(e.target.value) }))}
                                                    onKeyDown={(e) => e.key === 'Enter' && handleConfigSubmit('viewRange', adminSettings.viewRange)}
                                                    className="bg-transparent border-b border-red-500/50 text-red-400 font-mono font-bold text-sm w-16 focus:outline-none focus:border-red-400"
                                                />
                                                <span className="text-[10px] text-red-500">km</span>
                                            </div>
                                        ) : (
                                            <div className="font-mono font-bold text-sm text-green-400">10 km</div>
                                        )}
                                        <div className="text-[10px] text-slate-600">Foreign Buildings</div>
                                    </div>
                                </div>

                                {/* Location & GPS */}
                                <div className="bg-slate-900/50 p-2.5 rounded border border-slate-700/50 col-span-2">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <div className="text-slate-500 font-medium mb-0.5">Current Location</div>
                                            <div className="font-mono text-white text-sm tracking-wide">
                                                {playerPosition[0].toFixed(4)}, {playerPosition[1].toFixed(4)}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-slate-500 font-medium mb-0.5">GPS Accuracy</div>
                                            <div className="font-mono font-bold text-yellow-400">
                                                {geolocation?.accuracy ? `±${Math.round(geolocation.accuracy)}m` : 'N/A'}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Construction Status Bar (if active) */}
                                    {isConstructing && (
                                        <div className="mt-2 pt-2 border-t border-slate-700/50 flex justify-between items-center animate-pulse">
                                            <span className="text-orange-400 font-bold">🚧 Construction in progress</span>
                                            <span className="text-white font-mono bg-orange-900/50 px-2 py-0.5 rounded text-[10px] border border-orange-700/50">
                                                {constructionTimeLeft}s remaining
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>




                        {/* Active Operations Section */}
                        {(isConstructing || Object.keys(demolitionStates).length > 0) && (
                            <div className="bg-slate-800/50 rounded-lg p-3 border border-yellow-500/20">
                                <h3 className="text-sm font-semibold text-yellow-400 mb-2 flex items-center gap-2">
                                    <span className="animate-pulse">🚧</span> 진행 중인 작업
                                </h3>
                                <div className="space-y-2">
                                    {isConstructing && (
                                        <div className="bg-slate-900/50 p-2 rounded flex items-center justify-between border-l-2 border-orange-500">
                                            <div className="text-xs text-white">
                                                <div className="font-bold text-orange-300">건설 중</div>
                                                <div>{constructingBuildingName || 'Unknown Building'}</div>
                                            </div>
                                            <div className="text-orange-400 font-mono font-bold text-sm">
                                                {constructionTimeLeft}s
                                            </div>
                                        </div>
                                    )}
                                    {Object.entries(demolitionStates).map(([id, finishTime]) => {
                                        const timeLeft = Math.max(0, Math.ceil((finishTime - currentTick) / 1000));
                                        if (timeLeft <= 0) return null;
                                        // Find building info
                                        const building = buildings.find(b => b.id === Number(id));
                                        const name = building ? getBuildingInfo(building.type).name : `Building #${id}`;

                                        return (
                                            <div key={id} className="bg-slate-900/50 p-2 rounded flex items-center justify-between border-l-2 border-red-500">
                                                <div className="text-xs text-white">
                                                    <div className="font-bold text-red-300">철거 중</div>
                                                    <div>{name}</div>
                                                </div>
                                                <div className="text-red-400 font-mono font-bold text-sm">
                                                    {timeLeft}s
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Build Tab */}
                {activeTab === 'build' && (
                    <div className="space-y-4">
                        {buildingCategories.map((category) => (
                            <div key={category.id}>
                                <h3 className="text-xs font-bold text-purple-300 mb-2 sticky top-0 bg-slate-900/95 backdrop-blur py-2 z-10 uppercase tracking-wider border-b border-purple-500/30 flex items-center gap-2">
                                    {category.label}
                                </h3>
                                <div className="space-y-2">
                                    {category.buildings.map((building) => {
                                        // Resource Check
                                        const canAfford =
                                            playerResources.gold >= (building.cost.gold || 0) &&
                                            playerResources.gem >= (building.cost.gem || 0);

                                        // Tech Tree / Logic Checks
                                        let isLocked = false;
                                        let lockReason = '';

                                        // 1. Commander Limit (Max 1)
                                        if (building.id === 'COMMAND_CENTER') {
                                            const hasCommander = buildings.some(b => b.type === 'COMMANDER' || b.type === 'COMMAND_CENTER');
                                            if (hasCommander) {
                                                isLocked = true;
                                                lockReason = 'ALREADY BUILT';
                                            }
                                        }

                                        // 2. Factory Prerequisite (Requires Commander Lv2)
                                        if (building.id === 'FACTORY') {
                                            const commander = buildings.find(b => b.type === 'COMMANDER' || b.type === 'COMMAND_CENTER');
                                            if (!commander) {
                                                isLocked = true;
                                                lockReason = 'REQ: COMMANDER';
                                            } else if ((commander.level || 1) < 2) {
                                                isLocked = true;
                                                lockReason = 'REQ: CMD LV.2';
                                            }
                                        }

                                        const isDisabled = !canAfford || isConstructing || isLocked;

                                        return (
                                            <button
                                                key={building.id}
                                                onClick={() => onBuild(building.id)}
                                                disabled={isDisabled}
                                                className={`w-full p-3 rounded-lg border text-left transition-all active:scale-[0.98] group relative overflow-hidden ${!isDisabled
                                                    ? 'border-slate-700 bg-slate-800/50 hover:bg-slate-700/80 hover:border-purple-500 hover:shadow-[0_0_15px_rgba(168,85,247,0.2)]'
                                                    : 'border-slate-800 bg-slate-900/50 opacity-50 cursor-not-allowed'
                                                    }`}
                                            >
                                                {!isDisabled && <div className="absolute inset-0 bg-gradient-to-r from-purple-500/0 via-purple-500/5 to-purple-500/0 opacity-0 group-hover:opacity-100 transition-opacity" />}
                                                <div className="font-bold text-white text-sm relative z-10 flex justify-between">
                                                    <span>{building.name}</span>
                                                    {isLocked ? (
                                                        <span className="text-[10px] bg-gray-500/20 text-gray-300 px-1.5 rounded border border-gray-500/30">{lockReason}</span>
                                                    ) : !canAfford ? (
                                                        <span className="text-[10px] bg-red-500/20 text-red-300 px-1.5 rounded">LACK RES</span>
                                                    ) : (
                                                        <span className="text-[10px] bg-green-500/20 text-green-300 px-1.5 rounded">BUILD</span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3 mt-2 text-xs relative z-10">
                                                    <span className={`px-1.5 py-0.5 rounded bg-black/30 ${playerResources.gold >= building.cost.gold ? 'text-yellow-400' : 'text-red-400'}`}>
                                                        💰 {building.cost.gold}
                                                    </span>
                                                    {building.cost.gem > 0 && (
                                                        <span className={`px-1.5 py-0.5 rounded bg-black/30 ${playerResources.gem >= building.cost.gem ? 'text-cyan-400' : 'text-red-400'}`}>
                                                            💎 {building.cost.gem}
                                                        </span>
                                                    )}
                                                    <span className="text-slate-400 flex items-center gap-1 ml-auto">
                                                        <span>⏱</span> {building.buildTime}s
                                                    </span>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Units Tab */}
                {activeTab === 'units' && (
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-purple-300 mb-2">보유 하수인 ({minions.length})</h3>
                        {minions.length === 0 ? (
                            <div className="text-xs text-slate-400 text-center py-4">하수인이 없습니다</div>
                        ) : (
                            <div className="space-y-2">
                                {minions.map((minion) => (
                                    <div key={minion.id} className="bg-slate-800 p-2 rounded border border-slate-700">
                                        <div className="text-sm text-white font-bold">{minion.name}</div>
                                        <div className="text-xs text-slate-400">{minion.type} | HP: {minion.hp}%</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Buildings Tab */}
                {activeTab === 'buildings' && (
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-purple-300 mb-2">보유 건물 ({buildings.length})</h3>
                        {buildings.map((building, idx) => (
                            <div
                                key={`${building.id}-${idx}`}
                                onClick={() => onBuildingClick && onBuildingClick(building)}
                                className="bg-slate-800 p-2 rounded border border-slate-700 cursor-pointer hover:border-purple-500"
                            >
                                <div className="text-sm text-white font-bold">{building.type}</div>
                                <div className="text-xs text-slate-400">Location: {building.lat.toFixed(4)}, {building.lng.toFixed(4)}</div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Settings Tab */}
                {activeTab === 'settings' && (
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-purple-300 mb-2">맵 스타일</h3>
                        <div className="space-y-2">
                            {tileProviders.map((provider) => (
                                <button
                                    key={provider.id}
                                    onClick={() => onTileProviderChange(provider)}
                                    className={`w-full p-2 rounded border text-left text-sm ${currentTileProvider === provider.id ? 'border-purple-500 bg-purple-900/30 text-white' : 'border-slate-700 text-slate-400 hover:text-white'}`}
                                >
                                    {provider.name}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Admin Tools (Inside Settings for now) */}
                {activeTab === 'settings' && isAdmin && (
                    <div className="space-y-4 mt-6 pt-4 border-t border-slate-700">
                        <h3 className="text-sm font-semibold text-red-400 mb-2 flex items-center gap-2">
                            <span className="animate-pulse">🛠️</span> Admin Tools
                        </h3>

                        {/* Terrain Editor */}
                        <div className="bg-slate-800/50 p-3 rounded">
                            <div className="text-xs text-slate-300 font-bold mb-2">Terrain Editor</div>
                            <div className="text-xs text-slate-400 mb-2">
                                Select a tile on map to edit.
                            </div>
                            {selectedTile ? (
                                <div className="grid grid-cols-2 gap-2">
                                    <button onClick={() => setTerrainOverride('MOUNTAIN')} className="bg-slate-800 p-2 text-xs border border-slate-600 hover:bg-slate-700 text-white rounded">Mountain ⛰️</button>
                                    <button onClick={() => setTerrainOverride('WATER')} className="bg-slate-800 p-2 text-xs border border-slate-600 hover:bg-slate-700 text-white rounded">Water 🌊</button>
                                    <button onClick={() => setTerrainOverride('FOREST')} className="bg-slate-800 p-2 text-xs border border-slate-600 hover:bg-slate-700 text-white rounded">Forest 🌲</button>
                                    <button onClick={() => setTerrainOverride('PLAIN')} className="bg-slate-800 p-2 text-xs border border-slate-600 hover:bg-slate-700 text-white rounded">Plain 🌾</button>
                                </div>
                            ) : (
                                <div className="text-xs text-orange-400 italic">No tile selected</div>
                            )}
                        </div>

                        {/* NPC Spawner */}
                        <div className="bg-slate-800/50 p-3 rounded mt-2">
                            <div className="text-xs text-slate-300 font-bold mb-2">Spawn Free NPC Faction</div>
                            <NPCSpawner selectedTile={selectedTile} />
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom Tabs Navigation */}
            <div className="flex border-t border-white/10 bg-slate-900/90 backdrop-blur-md">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 flex flex-col items-center justify-center py-3 transition-all relative ${isActive
                                ? 'text-cyan-400 bg-cyan-900/10'
                                : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                                }`}
                        >
                            {isActive && <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-cyan-400 to-purple-500 shadow-[0_0_10px_rgba(34,211,238,0.8)]" />}
                            <Icon size={20} className={`mb-1 transition-transform ${isActive ? 'scale-110' : ''}`} />
                            <span className="text-[10px] font-bold tracking-wide uppercase">{tab.label}</span>
                        </button>
                    );
                })}
            </div>
            {/* Admin Input Modal */}
            {adminActionType && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-slate-800 p-4 rounded-lg shadow-2xl border border-slate-600 w-full max-w-sm animate-fadeIn">
                        <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                            {adminActionType === 'MOVE' ? '📍 Move Building' :
                                adminActionType === 'OWNER' ? '👤 Change Owner' :
                                    adminActionType === 'TELEPORT' ? '🏃 Teleport Building' : '💣 Force Destroy'}
                        </h3>

                        {(adminActionType === 'MOVE' || adminActionType === 'OWNER') && (
                            <div className="mb-4">
                                <label className="text-xs text-slate-400 mb-1 block">
                                    {adminActionType === 'MOVE' ? 'Coordinates (Lat, Lng)' : 'New Owner User ID'}
                                </label>
                                <input
                                    type="text"
                                    value={adminInputValue}
                                    onChange={(e) => setAdminInputValue(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 text-white p-2.5 rounded focus:border-blue-500 focus:outline-none disabled:opacity-50"
                                    placeholder={adminActionType === 'MOVE' ? '37.1234, 127.5678' : 'Enter User ID (e.g., 2)'}
                                    autoFocus
                                    disabled={adminStatus.loading}
                                />
                            </div>
                        )}

                        {(adminActionType === 'TELEPORT' || adminActionType === 'DESTROY') && (
                            <div className="mb-4 text-sm text-slate-300">
                                {adminActionType === 'TELEPORT'
                                    ? 'Are you sure you want to teleport this building to your current location?'
                                    : 'WARNING: This will permanently delete the building. This action cannot be undone.'}
                            </div>
                        )}

                        {/* Status Message */}
                        {adminStatus.msg && (
                            <div className={`mb-4 p-2 rounded text-xs text-center font-bold ${adminStatus.isError ? 'bg-red-500/20 text-red-300 border border-red-500/30' : 'bg-green-500/20 text-green-300 border border-green-500/30'
                                }`}>
                                {adminStatus.msg}
                            </div>
                        )}

                        <div className="flex gap-2 justify-end">
                            <button
                                onClick={() => {
                                    setAdminActionType(null);
                                    setAdminStatus({ loading: false, msg: null, isError: false });
                                }}
                                className="px-4 py-2 bg-slate-700 text-slate-300 rounded hover:bg-slate-600 text-xs font-bold"
                                disabled={adminStatus.loading}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAdminSubmit}
                                disabled={adminStatus.loading}
                                className={`px-4 py-2 text-white rounded text-xs font-bold shadow-lg flex items-center gap-2 ${adminActionType === 'DESTROY'
                                    ? 'bg-red-600 hover:bg-red-500 shadow-red-900/20'
                                    : 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/20'
                                    } ${adminStatus.loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                {adminStatus.loading && <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}
