"use client";

import { useState, useRef, useEffect } from 'react';
import { Info, Hammer, Map, Zap, UserPlus, LucideIcon, MapPin, X } from 'lucide-react';
import { TileProvider } from '@/components/map/TileProviderSelector';

interface GameControlPanelProps {
    // Info tab
    playerPosition: [number, number];
    playerResources: { gold: number; gem: number };
    buildings: Array<{ id: number; type: string; lat: number; lng: number; level?: number }>;
    isConstructing: boolean;
    constructingBuildingName?: string | null;
    constructionTimeLeft: number;
    currentTick?: number;

    // Units tab
    minions: Array<{ id: number; name: string; type: string; hp: number; battery: number; fatigue: number; status?: string }>;

    // Build & Interaction
    onBuild: (buildingId: string) => void;
    onBuildingClick?: (building: { id: number; type: string; lat: number; lng: number; level?: number }) => void;

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
    selectedBuilding?: { id: number; type: string; lat: number; lng: number; level?: number } | null;
    onCloseBuildingInfo?: () => void;
    demolitionStates?: Record<number, number>; // buildingId -> finishTimestamp
    onBuildingAction?: (action: 'assign' | 'collect' | 'destroy' | 'cancel_destroy', buildingId: number) => void;

    // Settings tab (Tiles + Actions)
    currentTileProvider: string;
    onTileProviderChange: (provider: TileProvider) => void;
    tileProviders: TileProvider[];
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
}: GameControlPanelProps) {
    const [activeTab, setActiveTab] = useState<TabType>('info');

    // Auto-switch to 'info' or a 'selection' view when tile or building is selected
    useEffect(() => {
        if (selectedTile || selectedBuilding || selectedTerritory) {
            setActiveTab('info');
        }
    }, [selectedTile, selectedBuilding, selectedTerritory]);

    const tabs: Array<{ id: TabType; label: string; icon: LucideIcon }> = [
        { id: 'info', label: '정보', icon: Info },
        { id: 'units', label: '유닛', icon: UserPlus },
        { id: 'buildings', label: '건물', icon: Hammer },
        { id: 'build', label: '건설', icon: Zap },
        { id: 'settings', label: '설정', icon: Map },
    ];



    const buildingCategories = [
        {
            id: 'territory',
            label: '👑 영토',
            buildings: [
                { id: 'COMMAND_CENTER', name: '사령부', cost: { gold: 500, gem: 5 }, buildTime: 60 },
            ],
        },
        {
            id: 'resource',
            label: '🔨 자원',
            buildings: [
                { id: 'mine', name: '자원 채굴장', cost: { gold: 100, gem: 0 }, buildTime: 30 },
                { id: 'FACTORY', name: '공장', cost: { gold: 500, gem: 5 }, buildTime: 120 },
            ],
        },
        {
            id: 'storage',
            label: '📦 저장',
            buildings: [
                { id: 'warehouse', name: '창고', cost: { gold: 50, gem: 0 }, buildTime: 20 },
            ],
        },
        {
            id: 'living',
            label: '🏡 생활',
            buildings: [
                { id: 'barracks', name: '숙소', cost: { gold: 75, gem: 0 }, buildTime: 25 },
            ],
        },
    ];

    // Helper to render building name/icon
    const getBuildingInfo = (type: string) => {
        const map: Record<string, { icon: string, name: string, desc: string }> = {
            'COMMAND_CENTER': { icon: '🏰', name: '사령부', desc: '영토를 지배하고 유닛을 지휘하는 핵심 건물입니다.' },
            'mine': { icon: '⛏️', name: '자원 채굴장', desc: '지하 자원을 채굴하여 골드를 생산합니다.' },
            'FACTORY': { icon: '🏭', name: '공장', desc: '고급 자재를 생산하기 위한 필수 시설입니다. (필요: 사령부 Lv.2)' },
            'warehouse': { icon: '📦', name: '창고', desc: '채굴한 자원을 안전하게 보관합니다.' },
            'barracks': { icon: '🏡', name: '숙소', desc: '시민과 하수인이 휴식을 취하는 공간입니다.' },
        };
        const key = type;
        return map[key] || map[key.toUpperCase()] || { icon: '🏗️', name: type, desc: '알 수 없는 건물' };
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
                                    {selectedTile.name || `Sector ${selectedTile.x}, ${selectedTile.y}`}
                                </span>
                            </div>
                            <button onClick={onCloseTileInfo} className="text-slate-400 hover:text-white p-1">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs text-slate-300 mb-4 flex-1">
                            <div>Type: <span className="text-white">{selectedTile.type}</span></div>
                            <div>Owner: <span className={selectedTile.owner_id ? "text-green-400" : "text-slate-500"}>
                                {selectedTile.owner_id ? `User ${selectedTile.owner_id}` : 'Create New'}
                            </span></div>
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
                {!selectedTile && !selectedBuilding && !selectedTerritory && (
                    <div className="w-full h-full flex flex-col justify-center">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-xl shadow-lg shadow-purple-900/50 border-2 border-white/20">
                                👾
                            </div>
                            <div>
                                <div className="text-white font-bold text-sm">Commander</div>
                                <div className="text-slate-400 text-xs flex items-center gap-1">
                                    <span className={`w-2 h-2 rounded-full ${isConstructing ? 'bg-orange-500 animate-pulse' : 'bg-green-500'}`}></span>
                                    {isConstructing ? 'Constructing...' : 'Online'}
                                </div>
                            </div>
                        </div>
                        <div className="text-xs text-slate-500 bg-slate-900/50 p-2 rounded text-center">
                            맵의 타일이나 건물을 선택하여<br />상세 정보를 확인하세요.
                        </div>
                    </div>
                )}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {/* Info Tab */}
                {activeTab === 'info' && (
                    <div className="space-y-4">
                        {!selectedTile && !selectedBuilding && (
                            <div className="text-center text-slate-500 text-xs py-10">
                                상단 요약 정보 창입니다.
                            </div>
                        )}

                        {/* Show expanded details if active */}
                        {(selectedTile || selectedBuilding) && (
                            <div className="space-y-4">
                                <div className="bg-slate-800/50 rounded-lg p-3">
                                    <h3 className="text-sm font-semibold text-purple-300 mb-2">내 캐릭터 Status</h3>
                                    <div className="space-y-1 text-xs">
                                        <div className="flex justify-between">
                                            <span className="text-slate-400">위치</span>
                                            <span className="text-white font-mono">
                                                ({playerPosition[0].toFixed(4)}, {playerPosition[1].toFixed(4)})
                                            </span>
                                        </div>
                                        {isConstructing && (
                                            <div className="flex justify-between text-orange-400 animate-pulse">
                                                <span>건설 중...</span>
                                                <span>{constructionTimeLeft}s</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}


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
                                            playerResources.gold >= building.cost.gold &&
                                            playerResources.gem >= building.cost.gem;

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
        </div>
    );
}
