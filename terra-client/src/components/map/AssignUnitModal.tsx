"use client";

import { useState, useEffect } from 'react';
import { X, CheckCircle, User, Cpu, Zap } from 'lucide-react';
import { API_BASE_URL } from '@/lib/config';

interface Minion {
    id: number;
    name: string;
    type: 'human' | 'android' | 'creature';
    species: string;
    strength: number;
    dexterity: number;
    constitution: number;
    intelligence: number;
    hp: number;
    mp: number;
    battery: number;
    fuel: number;
    fatigue: number;
    loyalty: number;
    level: number;
}

interface AssignUnitModalProps {
    buildingId: number;
    buildingType: string;
    isOpen: boolean;
    onClose: () => void;
    onAssigned: () => void;
}

/**
 * @file AssignUnitModal.tsx
 * @description 건물에 유닛(하수인)을 배치하는 모달 컴포넌트
 * @role 유닛 목록 로드, 배치 적합성(체력, 배터리) 검사, 예상 효율 계산, 배치 실행
 * @dependencies react, lucide-react, API_BASE_URL
 * @status Active
 */
export default function AssignUnitModal({
    buildingId,
    buildingType,
    isOpen,
    onClose,
    onAssigned,
}: AssignUnitModalProps) {
    const [minions, setMinions] = useState<Minion[]>([]);
    const [assignedMinionIds, setAssignedMinionIds] = useState<Set<number>>(new Set());
    const [selectedMinion, setSelectedMinion] = useState<Minion | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isAssigning, setIsAssigning] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadMinions();
        }
    }, [isOpen]);

    const loadMinions = async () => {
        setIsLoading(true);
        try {
            const userId = localStorage.getItem('terra_user_id');
            if (!userId) return;

            // Get user's minions
            const minionsResponse = await fetch(`${API_BASE_URL}/api/character/${userId}/minions`);
            if (minionsResponse.ok) {
                const data = await minionsResponse.json();
                setMinions(data.minions || []);
            }

            // Get all assigned minions (across all buildings)
            const assignedResponse = await fetch(`${API_BASE_URL}/api/buildings/all/assignments`);
            if (assignedResponse.ok) {
                const assignedData = await assignedResponse.json();
                const assignedIds = new Set<number>(assignedData.map((a: { minion_id: number }) => a.minion_id));
                setAssignedMinionIds(assignedIds);
            }
        } catch (error) {
            console.error('Failed to load minions:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // 예상 생산 효율 계산 (힘 + 지능 기반)
    const calculateEfficiency = (minion: Minion) => {
        const baseEfficiency = 1.0;
        const statBonus = (minion.strength + minion.intelligence) / 20;
        return baseEfficiency * (1 + statBonus * 0.5);
    };

    // 배치 가능 여부 검사 (중복 배치 방지, 최소 체력/배터리 요구)
    const canAssign = (minion: Minion) => {
        // 이미 배치된 유닛 제외
        if (assignedMinionIds.has(minion.id)) return false;

        // 최소 체력 30% 이상
        if (minion.hp < 30) return false;

        // 안드로이드: 배터리 20% 이상
        if (minion.type === 'android' && minion.battery < 20) return false;

        return true;
    };

    const handleAssign = async () => {
        if (!selectedMinion) return;

        setIsAssigning(true);
        try {
            // 건물 타입에 따른 작업 유형 자동 할당
            let taskType = 'mining'; // 기본: 채굴
            if (buildingType.toLowerCase() === 'barracks') {
                taskType = 'resting'; // 숙소: 휴식
            } else if (buildingType.toLowerCase() === 'warehouse') {
                taskType = 'guarding'; // 창고: 경비
            }

            const response = await fetch(
                `${API_BASE_URL}/api/buildings/${buildingId}/assign`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        minionId: selectedMinion.id,
                        taskType,
                    }),
                }
            );

            if (response.ok) {
                alert(`${selectedMinion.name} 배치 완료!`);
                onAssigned(); // Notify parent
                onClose();
            } else {
                const error = await response.json();
                alert(`배치 실패: ${error.error}`);
            }
        } catch (error) {
            console.error('Failed to assign minion:', error);
            alert('배치 실패');
        } finally {
            setIsAssigning(false);
        }
    };

    const getMinionIcon = (type: string) => {
        switch (type) {
            case 'android': return '🤖';
            case 'human': return '👤';
            case 'creature': return '🐾';
            default: return '❓';
        }
    };

    const getTaskName = (buildingType: string) => {
        switch (buildingType.toLowerCase()) {
            case 'mine': return '채굴';
            case 'barracks': return '휴식';
            case 'warehouse': return '경비';
            default: return '작업';
        }
    };

    if (!isOpen) return null;

    const availableMinions = minions.filter(m => canAssign(m));

    return (
        <>
            {/* Overlay */}
            <div
                className="fixed inset-0 bg-black/60 z-[2200] backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div
                className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[2300] w-[90vw] max-w-3xl max-h-[85vh] bg-slate-900 border-2 border-purple-500/50 rounded-xl shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-gradient-to-r from-purple-900 to-indigo-900 p-4 border-b border-purple-500/30 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <User size={24} />
                            유닛 배치 선택
                        </h2>
                        <p className="text-sm text-purple-200">
                            {getTaskName(buildingType)} 작업을 수행할 유닛을 선택하세요
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <X size={24} className="text-white" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex h-[calc(85vh-180px)]">
                    {/* Minion List */}
                    <div className="flex-1 p-4 overflow-y-auto border-r border-slate-700">
                        <h3 className="text-sm font-semibold text-purple-300 mb-3">
                            사용 가능한 유닛 ({availableMinions.length}명)
                        </h3>

                        {isLoading ? (
                            <div className="text-center text-slate-400 py-8">로딩 중...</div>
                        ) : availableMinions.length === 0 ? (
                            <div className="bg-slate-800/50 rounded-lg p-6 text-center text-slate-400">
                                <p className="mb-2">배치 가능한 유닛이 없습니다</p>
                                <p className="text-xs">체력이나 배터리가 부족한 유닛은 배치할 수 없습니다</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {availableMinions.map((minion) => {
                                    const efficiency = calculateEfficiency(minion);
                                    const isSelected = selectedMinion?.id === minion.id;

                                    return (
                                        <button
                                            type="button"
                                            key={minion.id}
                                            onClick={(e) => { e.stopPropagation(); setSelectedMinion(minion); }}
                                            className={`w-full p-3 rounded-lg border-2 transition-all text-left ${isSelected
                                                ? 'border-purple-500 bg-purple-900/50 shadow-lg'
                                                : 'border-slate-700 bg-slate-800 hover:border-purple-500/50'
                                                }`}
                                        >
                                            <div className="flex items-start justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-2xl">{getMinionIcon(minion.type)}</span>
                                                    <div>
                                                        <div className="font-semibold text-white">{minion.name}</div>
                                                        <div className="text-xs text-slate-400">
                                                            {minion.species || minion.type} | Lv.{minion.level}
                                                        </div>
                                                    </div>
                                                </div>
                                                {isSelected && (
                                                    <CheckCircle size={20} className="text-purple-400" />
                                                )}
                                            </div>

                                            {/* Stats Preview */}
                                            <div className="grid grid-cols-3 gap-2 text-xs">
                                                <div className="bg-slate-900/50 rounded px-2 py-1">
                                                    <div className="text-slate-400">힘</div>
                                                    <div className="text-red-400 font-mono">{minion.strength}</div>
                                                </div>
                                                <div className="bg-slate-900/50 rounded px-2 py-1">
                                                    <div className="text-slate-400">지능</div>
                                                    <div className="text-blue-400 font-mono">{minion.intelligence}</div>
                                                </div>
                                                <div className="bg-slate-900/50 rounded px-2 py-1">
                                                    <div className="text-slate-400">효율</div>
                                                    <div className="text-green-400 font-mono">{(efficiency * 100).toFixed(0)}%</div>
                                                </div>
                                            </div>

                                            {/* Health Bar */}
                                            <div className="mt-2 flex items-center gap-2 text-xs">
                                                <span className="text-slate-400 w-10">HP:</span>
                                                <div className="flex-1 bg-slate-700 rounded-full h-1.5 overflow-hidden">
                                                    <div
                                                        className="h-full bg-green-500"
                                                        style={{ width: `${minion.hp}%` }}
                                                    />
                                                </div>
                                                <span className="text-white w-10 text-right">{minion.hp}%</span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Selected Minion Details */}
                    <div className="w-80 bg-slate-800/50 p-4 flex flex-col">
                        {selectedMinion ? (
                            <>
                                <div className="flex-1">
                                    <div className="text-center mb-4">
                                        <div className="text-6xl mb-2">{getMinionIcon(selectedMinion.type)}</div>
                                        <h3 className="text-lg font-bold text-white">{selectedMinion.name}</h3>
                                        <p className="text-sm text-slate-400">{selectedMinion.species || selectedMinion.type}</p>
                                    </div>

                                    <div className="bg-slate-900/50 rounded-lg p-3 space-y-2 text-sm mb-4">
                                        <div className="flex justify-between">
                                            <span className="text-slate-400">레벨</span>
                                            <span className="text-white font-mono">{selectedMinion.level}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-400">체력</span>
                                            <span className="text-green-400 font-mono">{selectedMinion.hp}/{selectedMinion.mp}</span>
                                        </div>
                                        {selectedMinion.type === 'android' && (
                                            <div className="flex justify-between">
                                                <span className="text-slate-400">배터리</span>
                                                <span className="text-blue-400 font-mono">{selectedMinion.battery}%</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between">
                                            <span className="text-slate-400">충성도</span>
                                            <span className="text-purple-400 font-mono">{selectedMinion.loyalty}</span>
                                        </div>
                                    </div>

                                    {/* Efficiency Calculation */}
                                    <div className="bg-gradient-to-r from-green-900/30 to-emerald-900/30 border border-green-500/50 rounded-lg p-3">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm text-green-200">예상 생산 효율</span>
                                            <Zap size={16} className="text-green-400" />
                                        </div>
                                        <div className="text-2xl font-bold text-green-400">
                                            {(calculateEfficiency(selectedMinion) * 100).toFixed(0)}%
                                        </div>
                                        <div className="text-xs text-green-300 mt-1">
                                            기본 10 골드/분 × {(calculateEfficiency(selectedMinion)).toFixed(2)} = {(10 * calculateEfficiency(selectedMinion)).toFixed(1)} 골드/분
                                        </div>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); handleAssign(); }}
                                    disabled={isAssigning}
                                    className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:from-slate-700 disabled:to-slate-700 text-white font-bold rounded-lg transition-all mt-4"
                                >
                                    {isAssigning ? '배치 중...' : '✓ 배치 확정'}
                                </button>
                            </>
                        ) : (
                            <div className="flex-1 flex items-center justify-center text-slate-500 text-sm text-center">
                                👈 유닛을 선택하세요
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
