"use client";

import { useState, useRef, useEffect } from 'react';
import { Info, Hammer, Map, Zap, Minimize2, Maximize2, GripVertical, UserPlus, LucideIcon } from 'lucide-react';
import { TileProvider } from '@/components/map/TileProviderSelector';

interface FloatingGamePanelProps {
    // Info tab
    playerPosition: [number, number];
    playerResources: { gold: number; gem: number };
    buildings: Array<{ id: number; type: string; lat: number; lng: number; level?: number }>;
    isConstructing: boolean;
    constructionTimeLeft: number;

    // Units tab
    minions: Array<{ id: number; name: string; type: string; hp: number; battery: number; fatigue: number; status?: string }>;

    // Build tab
    onBuild: (buildingId: string) => void;
    onBuildingClick?: (building: { id: number; type: string; lat: number; lng: number; level?: number }) => void;

    // Settings tab (Tiles + Actions)
    currentTileProvider: string;
    onTileProviderChange: (provider: TileProvider) => void;
    tileProviders: TileProvider[];
}

type TabType = 'info' | 'units' | 'build' | 'buildings' | 'settings';

export default function FloatingGamePanel({
    playerPosition,
    playerResources,
    buildings,
    isConstructing,
    constructionTimeLeft,
    minions = [],
    onBuild,
    onBuildingClick,
    currentTileProvider,
    onTileProviderChange,
    tileProviders,
}: FloatingGamePanelProps) {
    const [activeTab, setActiveTab] = useState<TabType>('info');
    const [isMinimized, setIsMinimized] = useState(false);
    const [position, setPosition] = useState({ x: 20, y: 100 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const panelRef = useRef<HTMLDivElement>(null);

    // Load saved position
    useEffect(() => {
        const saved = localStorage.getItem('gamePanel_position');
        if (saved) {
            // eslint-disable-next-line react-hooks/exhaustive-deps
            setPosition(JSON.parse(saved));
        }
    }, []);

    // Save position
    useEffect(() => {
        localStorage.setItem('gamePanel_position', JSON.stringify(position));
    }, [position]);

    // Drag handlers
    const handleMouseDown = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('.drag-handle')) {
            setIsDragging(true);
            setDragOffset({
                x: e.clientX - position.x,
                y: e.clientY - position.y,
            });
        }
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (isDragging) {
            const newX = Math.max(0, Math.min(window.innerWidth - 400, e.clientX - dragOffset.x));
            const newY = Math.max(0, Math.min(window.innerHeight - 500, e.clientY - dragOffset.y));
            setPosition({ x: newX, y: newY });
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            return () => {
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isDragging, dragOffset]);

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

    return (
        <div
            ref={panelRef}
            className="fixed bg-slate-900/95 backdrop-blur-md border-2 border-purple-500/50 rounded-xl shadow-2xl z-[1500] transition-all"
            style={{
                left: `${position.x}px`,
                top: `${position.y}px`,
                width: isMinimized ? '280px' : '400px',
                maxHeight: isMinimized ? '60px' : '600px',
                cursor: isDragging ? 'grabbing' : 'default',
            }}
            onMouseDown={handleMouseDown}
        >
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-900 to-blue-900 p-3 rounded-t-xl flex items-center justify-between drag-handle cursor-grab active:cursor-grabbing">
                <div className="flex items-center gap-2">
                    <GripVertical size={16} className="text-purple-300" />
                    <span className="font-bold text-white text-sm">게임 패널</span>
                </div>
                <button
                    onClick={() => setIsMinimized(!isMinimized)}
                    className="p-1 hover:bg-white/10 rounded transition-colors"
                >
                    {isMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
                </button>
            </div>

            {!isMinimized && (
                <>
                    {/* Tabs */}
                    <div className="flex border-b border-slate-700">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex-1 flex items-center justify-center gap-2 py-3 transition-colors ${activeTab === tab.id
                                        ? 'bg-purple-900/50 text-white border-b-2 border-purple-500'
                                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                        }`}
                                >
                                    <Icon size={16} />
                                    <span className="text-xs font-medium">{tab.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Content */}
                    <div className="p-4 overflow-y-auto" style={{ maxHeight: '480px' }}>
                        {/* Info Tab */}
                        {activeTab === 'info' && (
                            <div className="space-y-3">
                                <div className="bg-slate-800/50 rounded-lg p-3">
                                    <h3 className="text-sm font-semibold text-purple-300 mb-2">캐릭터 정보</h3>
                                    <div className="space-y-1 text-xs">
                                        <div className="flex justify-between">
                                            <span className="text-slate-400">위치</span>
                                            <span className="text-white font-mono">
                                                ({playerPosition[0].toFixed(4)}, {playerPosition[1].toFixed(4)})
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-slate-800/50 rounded-lg p-3">
                                    <h3 className="text-sm font-semibold text-purple-300 mb-2">자원</h3>
                                    <div className="space-y-1 text-xs">
                                        <div className="flex justify-between">
                                            <span className="text-slate-400">골드</span>
                                            <span className="text-yellow-400 font-mono">{playerResources.gold}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-400">보석</span>
                                            <span className="text-cyan-400 font-mono">{playerResources.gem}</span>
                                        </div>
                                    </div>
                                </div>

                            </div>
                        )}

                        {/* Build Tab */}
                        {activeTab === 'build' && (
                            <div className="space-y-3">
                                {buildingCategories.map((category) => (
                                    <div key={category.id}>
                                        <h3 className="text-sm font-semibold text-purple-300 mb-2">{category.label}</h3>
                                        <div className="space-y-2">
                                            {category.buildings.map((building) => {
                                                const canAfford =
                                                    playerResources.gold >= building.cost.gold &&
                                                    playerResources.gem >= building.cost.gem;

                                                return (
                                                    <button
                                                        key={building.id}
                                                        onClick={() => onBuild(building.id)}
                                                        disabled={!canAfford || isConstructing}
                                                        className={`w-full p-3 rounded-lg border text-left transition-all ${canAfford && !isConstructing
                                                            ? 'border-slate-700 bg-slate-800 hover:border-purple-500 hover:bg-slate-700'
                                                            : 'border-slate-800 bg-slate-900/50 opacity-50 cursor-not-allowed'
                                                            }`}
                                                    >
                                                        <div className="font-semibold text-white text-sm">{building.name}</div>
                                                        <div className="flex items-center gap-3 mt-1 text-xs">
                                                            <span className={playerResources.gold >= building.cost.gold ? 'text-yellow-400' : 'text-red-400'}>
                                                                💰 {building.cost.gold}
                                                            </span>
                                                            {building.cost.gem > 0 && (
                                                                <span className={playerResources.gem >= building.cost.gem ? 'text-cyan-400' : 'text-red-400'}>
                                                                    💎 {building.cost.gem}
                                                                </span>
                                                            )}
                                                            <span className="text-purple-400">⏱ {building.buildTime}s</span>
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
                            <div className="space-y-3">
                                <div className="bg-slate-800/50 rounded-lg p-3">
                                    <h3 className="text-sm font-semibold text-purple-300 mb-2">
                                        보유 하수인 ({minions.length})
                                    </h3>

                                    {minions.length === 0 ? (
                                        <div className="text-xs text-slate-400 text-center py-2">
                                            하수인이 없습니다
                                        </div>
                                    ) : (
                                        <div className="space-y-2 max-h-64 overflow-y-auto">
                                            {minions.map((minion) => {
                                                const getTypeIcon = (type: string) => {
                                                    if (type === 'android') return '🤖';
                                                    if (type === 'human') return '👤';
                                                    return '🐾';
                                                };

                                                const getHealthColor = (hp: number) => {
                                                    if (hp >= 70) return 'bg-green-500';
                                                    if (hp >= 40) return 'bg-yellow-500';
                                                    return 'bg-red-500';
                                                };

                                                return (
                                                    <div
                                                        key={minion.id}
                                                        className="bg-slate-900/50 rounded p-2 border border-slate-700"
                                                    >
                                                        <div className="flex items-center justify-between mb-2">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-lg">{getTypeIcon(minion.type)}</span>
                                                                <div className="text-xs font-semibold text-white">
                                                                    {minion.name}
                                                                </div>
                                                            </div>
                                                            <div className="text-[10px] text-slate-400">
                                                                {minion.type}
                                                            </div>
                                                        </div>
                                                        {minion.status && (
                                                            <div className="text-[10px] text-cyan-400 mb-1">
                                                                Status: {minion.status}
                                                            </div>
                                                        )}
                                                        <div className="space-y-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[10px] text-slate-400 w-12">HP:</span>
                                                                <div className="flex-1 bg-slate-700 rounded-full h-1.5">
                                                                    <div
                                                                        className={`h-full rounded-full ${getHealthColor(minion.hp)}`}
                                                                        style={{ width: `${minion.hp}%` }}
                                                                    />
                                                                </div>
                                                                <span className="text-[10px] text-white w-8 text-right">{minion.hp}%</span>
                                                            </div>
                                                            {minion.type === 'android' && (
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-[10px] text-slate-400 w-12">배터리:</span>
                                                                    <div className="flex-1 bg-slate-700 rounded-full h-1.5">
                                                                        <div
                                                                            className="h-full rounded-full bg-blue-500"
                                                                            style={{ width: `${minion.battery}%` }}
                                                                        />
                                                                    </div>
                                                                    <span className="text-[10px] text-white w-8 text-right">{minion.battery}%</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                                <div className="text-xs text-slate-500 text-center">
                                    건물 클릭 → 유닛 배치
                                </div>
                            </div>
                        )}

                        {/* Buildings Tab */}
                        {activeTab === 'buildings' && (
                            <div className="space-y-3">
                                <div className="bg-slate-800/50 rounded-lg p-3">
                                    <h3 className="text-sm font-semibold text-purple-300 mb-2">
                                        보유 건물 ({buildings.length})
                                    </h3>

                                    {buildings.length === 0 ? (
                                        <div className="text-xs text-slate-400 text-center py-2">
                                            건물이 없습니다
                                        </div>
                                    ) : (
                                        <div className="space-y-1 max-h-64 overflow-y-auto">
                                            {buildings.map((building, index) => {
                                                const getBuildingIcon = (type: string) => {
                                                    const icons: Record<string, string> = {
                                                        mine: '⛏️', warehouse: '📦', barracks: '🏡',
                                                        MINE: '⛏️', WAREHOUSE: '📦', BARRACKS: '🏡',
                                                    };
                                                    return icons[type] || '🏗️';
                                                };

                                                const getBuildingName = (type: string) => {
                                                    const names: Record<string, string> = {
                                                        mine: '자원 채굴장', warehouse: '창고', barracks: '숙소',
                                                        MINE: '자원 채굴장', WAREHOUSE: '창고', BARRACKS: '숙소',
                                                    };
                                                    return names[type] || type;
                                                };

                                                return (
                                                    <div
                                                        key={`building-${building.id}-${index}`}
                                                        onClick={() => onBuildingClick && onBuildingClick(building)}
                                                        className="bg-slate-900/50 rounded p-2 hover:bg-slate-900/80 transition-colors cursor-pointer border border-slate-700 hover:border-purple-500/50"
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-lg">{getBuildingIcon(building.type)}</span>
                                                                <div>
                                                                    <div className="text-xs font-semibold text-white">
                                                                        {getBuildingName(building.type)}
                                                                    </div>
                                                                    <div className="text-[10px] text-slate-400 font-mono">
                                                                        ({building.lat.toFixed(4)}, {building.lng.toFixed(4)})
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="text-[10px] text-purple-400">
                                                                Lv.{building.level || 1}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Settings Tab (Tiles + Actions) */}
                        {activeTab === 'settings' && (
                            <div className="space-y-3">
                                {/* Tiles Section */}
                                <div>
                                    <h3 className="text-sm font-semibold text-purple-300 mb-2">맵 타일 선택</h3>
                                    <div className="space-y-2">
                                        {tileProviders.map((provider) => (
                                            <button
                                                key={provider.id}
                                                onClick={() => onTileProviderChange(provider)}
                                                className={`w-full p-3 rounded-lg border text-left transition-all ${currentTileProvider === provider.id
                                                    ? 'border-purple-500 bg-purple-900/50'
                                                    : 'border-slate-700 bg-slate-800 hover:border-purple-500/50'
                                                    }`}
                                            >
                                                <div className="font-semibold text-white text-sm">{provider.name}</div>
                                                <div className="text-xs text-slate-400 mt-1">{provider.description || 'Map tiles'}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Actions/Commands Section */}
                                <div className="bg-slate-800/50 rounded-lg p-3">
                                    <h3 className="text-sm font-semibold text-purple-300 mb-2">명령 가이드</h3>
                                    <div className="text-xs text-slate-400">
                                        <p>• 맵 더블 클릭: 이동 (10km 반경 내)</p>
                                        <p>• 건설: 건설 탭에서 건물 선택</p>
                                        <p>• 건물 클릭: 유닛 관리</p>
                                        <p className="mt-2 text-yellow-400">이동 속도: 1km/1초</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
