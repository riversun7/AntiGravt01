"use client";

import { useState, useRef, useEffect } from 'react';
import { Info, Hammer, Map, Zap, Minimize2, Maximize2, GripVertical, UserPlus, LucideIcon } from 'lucide-react';
import { TileProvider } from '@/components/map/TileProviderSelector';
import { API_BASE_URL } from '@/lib/config';

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

/**
 * @file FloatingGamePanel.tsx
 * @description 게임 내 주요 정보와 기능을 제공하는 드래그 가능한 플로팅 패널 컴포넌트
 * @role 플레이어 자원 표시, 유닛/건물 관리, 건물 건설, 지도 설정 및 타일 제공자 변경
 * @dependencies react, lucide-react, TileProviderSelector
 * @status Active
 */
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
    const [isMobile, setIsMobile] = useState(false);

    // Check for mobile screen
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Load saved position
    useEffect(() => {
        const saved = localStorage.getItem('gamePanel_position');
        if (saved && !isMobile) {

            setPosition(JSON.parse(saved));
        }
    }, [isMobile]);

    // Save position
    useEffect(() => {
        if (!isMobile) {
            localStorage.setItem('gamePanel_position', JSON.stringify(position));
        }
    }, [position, isMobile]);

    // --- 드래그 핸들러 (PC 전용) ---
    const handleMouseDown = (e: React.MouseEvent) => {
        if (isMobile) return; // 모바일에서는 드래그 비활성화 (화면 하단 고정)
        if ((e.target as HTMLElement).closest('.drag-handle')) {
            setIsDragging(true);
            setDragOffset({
                x: e.clientX - position.x,
                y: e.clientY - position.y,
            });
        }
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (isDragging && !isMobile) {
            // 화면 밖으로 나가지 않도록 제한
            const newX = Math.max(0, Math.min(window.innerWidth - 400, e.clientX - dragOffset.x));
            const newY = Math.max(0, Math.min(window.innerHeight - 500, e.clientY - dragOffset.y));
            setPosition({ x: newX, y: newY });
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    // 드래그 이벤트 리스너 등록/해제
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

    const [buildingTypes, setBuildingTypes] = useState<any[]>([]);

    useEffect(() => {
        fetch(`${API_BASE_URL}/api/buildings/types`)
            .then(res => res.json())
            .then(data => {
                if (data.types) setBuildingTypes(data.types);
            })
            .catch(err => console.error("Failed to load building types:", err));
    }, []);

    // --- 카테고리 매핑 설정 ---
    // 백엔드 카테고리 코드 또는 임의의 코드를 한글 라벨과 정렬 순서로 매핑
    const categoriesMap: Record<string, { id: string, label: string, order: number }> = {
        'TERRITORY': { id: 'territory', label: '👑 영토 (Capital)', order: 1 },
        'ADMIN': { id: 'admin', label: '🛠️ 관리 (Admin)', order: 0 }, // ADMIN 중복 수정 및 우선순위 조정
        'RESOURCE': { id: 'resource', label: '🔨 자원 (Resource)', order: 2 },
        'STORAGE': { id: 'storage', label: '📦 저장 (Storage)', order: 3 },
        'HOUSING': { id: 'living', label: '🏡 생활 (Living)', order: 4 },
        'MILITARY': { id: 'military', label: '⚔️ 군사 (Military)', order: 5 },
        'INDUSTRIAL': { id: 'industrial', label: '🏭 산업 (Industrial)', order: 6 },
        'RESEARCH': { id: 'research', label: '🧪 연구 (Research)', order: 7 },
    };

    const buildingCategories = Object.values(categoriesMap)
        .filter((v, i, a) => a.findIndex(t => t.id === v.id) === i)
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
                buildTime: b.tier * 30,
                desc: b.description
            }))
        }))
        .filter(cat => cat.buildings.length > 0);

    return (
        <div
            ref={panelRef}
            className={`fixed bg-slate-900/95 backdrop-blur-md border-2 border-purple-500/50 shadow-2xl z-[1500] transition-all duration-300
                ${isMobile ? 'rounded-t-2xl bottom-0 left-0 w-full border-b-0' : 'rounded-xl'}
            `}
            style={isMobile ? {
                maxHeight: isMinimized ? '60px' : '80vh',
                height: isMinimized ? '60px' : 'auto'
            } : {
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
                                                    playerResources.gold >= (building.cost.gold || 0) &&
                                                    playerResources.gem >= (building.cost.gem || 0);

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
                                                        'FACTORY': '🏭',
                                                        // Legacy
                                                        'mine': '⛏️', 'warehouse': '📦', 'barracks': '🏡'
                                                    };
                                                    return icons[type] || icons[type.toUpperCase()] || '🏗️';
                                                };

                                                const getBuildingName = (type: string) => {
                                                    const loaded = buildingTypes.find(b => b.code === type || b.code === type.toUpperCase());
                                                    if (loaded) return loaded.name;

                                                    const names: Record<string, string> = {
                                                        'mine': '자원 채굴장', 'warehouse': '창고', 'barracks': '숙소'
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
