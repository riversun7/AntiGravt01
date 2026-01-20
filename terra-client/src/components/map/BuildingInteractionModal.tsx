"use client";

import { useState, useEffect } from 'react';
import { X, UserPlus, TrendingUp, AlertCircle } from 'lucide-react';
import { API_BASE_URL } from '@/lib/config';

interface Assignment {
    id: number;
    minion_id: number;
    minion_name: string;
    minion_type: 'human' | 'android' | 'creature';
    task_type: 'mining' | 'guarding' | 'resting';
    production_rate: number;
    resources_collected: number;
    hp: number;
    battery: number;
    fatigue: number;
    loyalty: number;
}

interface Building {
    id: number;
    type: string;
    lat: number;
    lng: number;
    level?: number;
}

interface BuildingInteractionModalProps {
    building: Building;
    isOpen: boolean;
    onClose: () => void;
    onAssignUnit: () => void;
    onCollectResources: () => void;
    onDestroyBuilding: () => void;
}

/**
 * @file BuildingInteractionModal.tsx
 * @description 배치된 유닛을 관리하고 생산된 자원을 수집하는 건물 상호작용 모달
 * @role 배치 유닛 목록 표시, 유닛 회수, 누적 자원 수집, 건물 파괴
 * @dependencies react, lucide-react, API_BASE_URL
 * @status Active
 */
export default function BuildingInteractionModal({
    building,
    isOpen,
    onClose,
    onAssignUnit,
    onCollectResources,
    onDestroyBuilding,
}: BuildingInteractionModalProps) {
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [totalResources, setTotalResources] = useState(0);
    const [showDestructionConfirm, setShowDestructionConfirm] = useState(false);

    const maxSlots = 2 + (building.level || 1); // 기본 2 + 레벨당 1

    // Load assignments when modal opens
    useEffect(() => {
        if (isOpen && building) {
            loadAssignments();
        }
    }, [isOpen, building]);

    const loadAssignments = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/buildings/${building.id}/assignments`);
            if (response.ok) {
                const data = await response.json();
                setAssignments(data);

                // 누적 생산량 총합 계산
                const total = data.reduce((sum: number, a: Assignment) => sum + a.resources_collected, 0);
                setTotalResources(total);
            }
        } catch (error) {
            console.error('Assignments 로드 실패:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // 유닛 작업 해제 (회수)
    const handleRemoveUnit = async (minionId: number) => {
        try {
            const response = await fetch(
                `${API_BASE_URL}/api/buildings/${building.id}/assign/${minionId}`,
                { method: 'DELETE' }
            );

            if (response.ok) {
                const result = await response.json();
                alert(`유닛 회수 완료! ${result.collectedResources} 골드 획득`);
                loadAssignments(); // 목록 갱신
            }
        } catch (error) {
            console.error('유닛 회수 실패:', error);
            alert('유닛 회수 실패');
        }
    };

    // 자원 수집
    const handleCollect = async () => {
        try {
            const response = await fetch(
                `${API_BASE_URL}/api/buildings/${building.id}/collect`,
                { method: 'POST' }
            );

            if (response.ok) {
                const result = await response.json();
                alert(`${result.gold} 골드 수집 완료!`);
                onCollectResources(); // 부모 컴포넌트에 알림
                loadAssignments(); // 목록 갱신
            }
        } catch (error) {
            console.error('자원 수집 실패:', error);
            alert('자원 수집 실패');
        }
    };

    const getBuildingIcon = (type: string) => {
        switch (type.toLowerCase()) {
            case 'mine': return '⛏️';
            case 'warehouse': return '📦';
            case 'barracks': return '🏠';
            default: return '🏗️';
        }
    };

    const getBuildingName = (type: string) => {
        switch (type.toLowerCase()) {
            case 'mine': return '자원 채굴장';
            case 'warehouse': return '창고';
            case 'barracks': return '숙소';
            default: return type;
        }
    };

    const getHealthColor = (hp: number) => {
        if (hp >= 70) return 'bg-green-500';
        if (hp >= 40) return 'bg-yellow-500';
        return 'bg-red-500';
    };

    const getBatteryColor = (battery: number) => {
        if (battery >= 60) return 'bg-blue-500';
        if (battery >= 30) return 'bg-yellow-500';
        return 'bg-red-500';
    };

    if (!isOpen) return null;

    const buildingLevel = building.level || 1;

    return (
        <>
            {/* Overlay */}
            <div
                className="fixed inset-0 bg-black/60 z-[2000] backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[2100] w-[90vw] max-w-2xl max-h-[85vh] bg-slate-900 border-2 border-cyan-500/50 rounded-xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-cyan-900 to-blue-900 p-4 border-b border-cyan-500/30 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            {getBuildingIcon(building.type)} {getBuildingName(building.type)}
                        </h2>
                        <p className="text-sm text-cyan-200">
                            레벨 {buildingLevel} | 최대 유닛: {maxSlots}개
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <X size={24} className="text-white" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 180px)' }}>
                    {/* Assigned Units */}
                    <div className="mb-4">
                        <h3 className="text-sm font-semibold text-cyan-300 mb-2 flex items-center gap-2">
                            <UserPlus size={16} />
                            배치된 유닛 ({assignments.length}/{maxSlots})
                        </h3>

                        {isLoading ? (
                            <div className="text-center text-slate-400 py-4">로딩 중...</div>
                        ) : assignments.length === 0 ? (
                            <div className="bg-slate-800/50 rounded-lg p-4 text-center text-slate-400">
                                배치된 유닛이 없습니다
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {assignments.map((assignment) => (
                                    <div
                                        key={assignment.id}
                                        className="bg-slate-800 rounded-lg p-3 border border-slate-700 hover:border-cyan-500/50 transition-colors"
                                    >
                                        <div className="flex items-start justify-between mb-2">
                                            <div>
                                                <div className="font-semibold text-white flex items-center gap-2">
                                                    {assignment.minion_type === 'android' ? '🤖' :
                                                        assignment.minion_type === 'human' ? '👤' : '🐾'}
                                                    {assignment.minion_name}
                                                </div>
                                                <div className="text-xs text-slate-400">
                                                    {assignment.task_type === 'mining' ? '⛏️ 채굴 중' :
                                                        assignment.task_type === 'guarding' ? '🛡️ 경비 중' : '😴 휴식 중'}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleRemoveUnit(assignment.minion_id)}
                                                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition-colors"
                                            >
                                                회수
                                            </button>
                                        </div>

                                        {/* Stats */}
                                        <div className="space-y-1 text-xs">
                                            <div className="flex items-center gap-2">
                                                <span className="text-slate-400 w-16">체력:</span>
                                                <div className="flex-1 bg-slate-700 rounded-full h-2 overflow-hidden">
                                                    <div
                                                        className={`h-full ${getHealthColor(assignment.hp)}`}
                                                        style={{ width: `${assignment.hp}%` }}
                                                    />
                                                </div>
                                                <span className="text-white w-10 text-right">{assignment.hp}%</span>
                                            </div>

                                            {assignment.minion_type === 'android' && (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-slate-400 w-16">배터리:</span>
                                                    <div className="flex-1 bg-slate-700 rounded-full h-2 overflow-hidden">
                                                        <div
                                                            className={`h-full ${getBatteryColor(assignment.battery)}`}
                                                            style={{ width: `${assignment.battery}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-white w-10 text-right">{assignment.battery}%</span>
                                                </div>
                                            )}

                                            <div className="flex justify-between mt-2">
                                                <span className="text-purple-400">
                                                    <TrendingUp size={12} className="inline mr-1" />
                                                    생산 효율: {(assignment.production_rate * 100).toFixed(0)}%
                                                </span>
                                                <span className="text-yellow-400">
                                                    💰 누적: {assignment.resources_collected}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Warning for low health/battery */}
                                        {(assignment.hp < 30 || (assignment.minion_type === 'android' && assignment.battery < 20)) && (
                                            <div className="mt-2 bg-red-900/30 border border-red-500/50 rounded px-2 py-1 flex items-center gap-1 text-xs text-red-400">
                                                <AlertCircle size={12} />
                                                <span>곧 숙소로 귀환합니다</span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Total Resources */}
                    <div className="bg-gradient-to-r from-yellow-900/30 to-amber-900/30 border border-yellow-500/50 rounded-lg p-3 mb-4">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-yellow-200">누적 자원</span>
                            <span className="text-lg font-bold text-yellow-400">💰 {totalResources} 골드</span>
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="bg-slate-800 p-4 border-t border-slate-700">
                    <div className="flex gap-2 mb-2">
                        <button
                            onClick={handleCollect}
                            disabled={totalResources === 0}
                            className={`flex-1 py-3 rounded-lg font-bold transition-all ${totalResources > 0
                                ? 'bg-gradient-to-r from-yellow-600 to-amber-600 hover:from-yellow-500 hover:to-amber-500 text-white'
                                : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                }`}
                        >
                            💰 자원 수집
                        </button>
                        <button
                            onClick={onAssignUnit}
                            disabled={assignments.length >= maxSlots}
                            className={`flex-1 py-3 rounded-lg font-bold transition-all ${assignments.length < maxSlots
                                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white'
                                : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                }`}
                        >
                            ➕ 유닛 배치
                        </button>
                    </div>
                    <div className="relative">
                        {showDestructionConfirm ? (
                            <div className="flex gap-2 animate-fadeIn">
                                <button
                                    onClick={() => setShowDestructionConfirm(false)}
                                    className="flex-1 py-2 rounded-lg bg-slate-700 text-slate-300 text-sm font-bold hover:bg-slate-600 transition-all"
                                >
                                    취소
                                </button>
                                <button
                                    onClick={() => {
                                        onDestroyBuilding();
                                        onClose();
                                    }}
                                    className="flex-[2] py-2 rounded-lg bg-red-600 text-white text-sm font-bold hover:bg-red-500 shadow-lg shadow-red-900/50 transition-all"
                                >
                                    ⚠️ 정말 파괴하시겠습니까?
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setShowDestructionConfirm(true)}
                                className="w-full py-2 rounded-lg bg-red-900/30 hover:bg-red-900/50 border border-red-500/30 text-red-400 text-sm font-bold transition-all"
                            >
                                🗑️ 건물 파괴 (복구 불가)
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
