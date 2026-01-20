"use client";

import { Hammer, Package, Home, X } from 'lucide-react';
import { useState } from 'react';

export interface BuildingDef {
    id: string;
    name: string;
    icon: React.ReactNode;
    description: string;
    buildTime: number; // seconds
    cost: {
        gold: number;
        gem: number;
    };
    category: 'resource' | 'storage' | 'living';
    unlocked: boolean;
}

/**
 * @file BuildingMenuNew.tsx
 * @description 신규 건물 건설 메뉴 컴포넌트
 * @role 자원, 저장, 생활 카테고리별로 건물 목록을 보여주고 선택하여 건설
 * @dependencies react, lucide-react
 * @status Active
 * 
 * @analysis
 * - `INITIAL_BUILDINGS` 배열에 건물 정의가 포함되어 있음 (추후 API 로딩 방식으로 변경 권장).
 * - 자원 보유량(`playerResources`)을 실시간으로 체크하여 건설 가능 여부를 시각적으로 표시.
 * - 모달 형태의 UI로, 배경 클릭 시 닫힘 처리.
 */
const INITIAL_BUILDINGS: BuildingDef[] = [
    {
        id: 'mine',
        name: '자원 채굴장',
        icon: <Hammer size={20} className="text-amber-400" />,
        description: '광물을 채굴하여 자원을 생산합니다',
        buildTime: 30,
        cost: { gold: 100, gem: 0 },
        category: 'resource',
        unlocked: true,
    },
    {
        id: 'warehouse',
        name: '창고',
        icon: <Package size={20} className="text-blue-400" />,
        description: '자원을 저장할 수 있는 공간을 제공합니다',
        buildTime: 20,
        cost: { gold: 50, gem: 0 },
        category: 'storage',
        unlocked: true,
    },
    {
        id: 'barracks',
        name: '숙소',
        icon: <Home size={20} className="text-green-400" />,
        description: '작업자들의 거주 공간을 제공합니다',
        buildTime: 25,
        cost: { gold: 75, gem: 0 },
        category: 'living',
        unlocked: true,
    },
];

interface BuildingMenuProps {
    onBuild: (buildingId: string) => void;
    playerResources?: { gold: number; gem: number };
    isOpen: boolean;
    onClose: () => void;
}

export default function BuildingMenu({
    onBuild,
    playerResources = { gold: 1000, gem: 10 },
    isOpen,
    onClose,
}: BuildingMenuProps) {
    const [selectedBuilding, setSelectedBuilding] = useState<BuildingDef | null>(null);

    const categories = [
        { id: 'resource', label: '🔨 자원', buildings: INITIAL_BUILDINGS.filter(b => b.category === 'resource') },
        { id: 'storage', label: '📦 저장', buildings: INITIAL_BUILDINGS.filter(b => b.category === 'storage') },
        { id: 'living', label: '🏡 생활', buildings: INITIAL_BUILDINGS.filter(b => b.category === 'living') },
    ];

    const canAfford = (building: BuildingDef) => {
        return playerResources.gold >= building.cost.gold && playerResources.gem >= building.cost.gem;
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Overlay */}
            <div
                className="fixed inset-0 bg-black/40 z-[1500] backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Menu Panel */}
            <div
                className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[1600] w-[90vw] max-w-2xl max-h-[80vh] bg-slate-900 border-2 border-purple-500/50 rounded-xl shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-gradient-to-r from-purple-900 to-blue-900 p-4 border-b border-purple-500/30 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            🏗️ 건축 메뉴
                        </h2>
                        <p className="text-sm text-purple-200">캐릭터 위치에 건설됩니다</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-right text-sm">
                            <div className="text-yellow-400 font-mono">💰 {playerResources.gold}G</div>
                            <div className="text-cyan-400 font-mono">💎 {playerResources.gem}</div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                        >
                            <X size={24} className="text-white" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex h-[calc(80vh-120px)]">
                    {/* Building List */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {categories.map(category => (
                            <div key={category.id}>
                                <h3 className="text-sm font-semibold text-purple-300 mb-2">{category.label}</h3>
                                <div className="space-y-2">
                                    {category.buildings.map(building => {
                                        const affordable = canAfford(building);
                                        const isSelected = selectedBuilding?.id === building.id;

                                        return (
                                            <button
                                                type="button"
                                                key={building.id}
                                                onClick={(e) => { e.stopPropagation(); setSelectedBuilding(building); }}
                                                disabled={!building.unlocked}
                                                className={`w-full p-3 rounded-lg border-2 transition-all text-left ${isSelected
                                                    ? 'border-purple-500 bg-purple-900/50 shadow-lg'
                                                    : affordable
                                                        ? 'border-slate-700 bg-slate-800 hover:border-purple-500/50 hover:bg-slate-700'
                                                        : 'border-slate-800 bg-slate-900/50 opacity-50'
                                                    } ${!building.unlocked ? 'grayscale cursor-not-allowed' : ''}`}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div className="p-2 bg-black/30 rounded-lg">
                                                        {building.icon}
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="font-semibold text-white">{building.name}</div>
                                                        <div className="text-xs text-slate-400 mt-1">{building.description}</div>
                                                        <div className="flex items-center gap-3 mt-2 text-xs">
                                                            <span className={playerResources.gold >= building.cost.gold ? 'text-yellow-400' : 'text-red-400'}>
                                                                💰 {building.cost.gold}
                                                            </span>
                                                            {building.cost.gem > 0 && (
                                                                <span className={playerResources.gem >= building.cost.gem ? 'text-cyan-400' : 'text-red-400'}>
                                                                    💎 {building.cost.gem}
                                                                </span>
                                                            )}
                                                            <span className="text-purple-400">⏱ {building.buildTime}초</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Building Details & Action */}
                    <div className="w-80 border-l border-slate-700 bg-slate-800/50 p-4 flex flex-col">
                        {selectedBuilding ? (
                            <>
                                <div className="flex-1">
                                    <div className="text-center mb-4">
                                        <div className="inline-block p-4 bg-gradient-to-br from-purple-900 to-blue-900 rounded-xl mb-3">
                                            <div className="scale-150">{selectedBuilding.icon}</div>
                                        </div>
                                        <h3 className="text-lg font-bold text-white">{selectedBuilding.name}</h3>
                                        <p className="text-sm text-slate-400 mt-2">{selectedBuilding.description}</p>
                                    </div>

                                    <div className="bg-slate-900/50 rounded-lg p-3 space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-slate-400">건설 시간</span>
                                            <span className="text-purple-400 font-mono">{selectedBuilding.buildTime}초</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-400">골드 비용</span>
                                            <span className={`font-mono ${playerResources.gold >= selectedBuilding.cost.gold ? 'text-yellow-400' : 'text-red-400'}`}>
                                                {selectedBuilding.cost.gold}
                                            </span>
                                        </div>
                                        {selectedBuilding.cost.gem > 0 && (
                                            <div className="flex justify-between">
                                                <span className="text-slate-400">보석 비용</span>
                                                <span className={`font-mono ${playerResources.gem >= selectedBuilding.cost.gem ? 'text-cyan-400' : 'text-red-400'}`}>
                                                    {selectedBuilding.cost.gem}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onBuild(selectedBuilding.id);
                                        onClose();
                                    }}
                                    disabled={!canAfford(selectedBuilding)}
                                    className={`w-full py-3 rounded-lg font-bold transition-all ${canAfford(selectedBuilding)
                                        ? 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white shadow-lg'
                                        : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                        }`}
                                >
                                    {canAfford(selectedBuilding) ? '🔨 건설 시작' : '자원 부족'}
                                </button>
                            </>
                        ) : (
                            <div className="flex-1 flex items-center justify-center text-slate-500 text-sm text-center">
                                👈 건물을 선택하세요
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}

export { INITIAL_BUILDINGS };
