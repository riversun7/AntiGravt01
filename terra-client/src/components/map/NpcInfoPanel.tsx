"use client";

import { useState } from "react";

interface Npc {
    cyborg_id: number;
    user_id: number;
    cyborg_name: string;
    level: number;
    username: string;
    lat: number;
    lng: number;
    destination: { lat: number; lng: number } | null;
    npc_type: string;
    faction_name: string;
    faction_color: string;
    faction_id: number;
}

/**
 * @file NpcInfoPanel.tsx
 * @description NPC의 상세 정보와 상태를 표시하는 오버레이 패널
 * @role NPC 이름, 레벨, 팩션, 현재 활동 상태(이동/대기), 위치 표시 및 관리자 제어 버튼 제공
 * @dependencies react
 * @status Active
 */
interface NpcInfoPanelProps {
    npc: Npc | null;
    onClose: () => void;
    onOpenAdminControl: () => void; // 관리자 제어 모달 열기 핸들러
}

export default function NpcInfoPanel({ npc, onClose, onOpenAdminControl }: NpcInfoPanelProps) {
    const [activityLog, setActivityLog] = useState<string[]>([]);

    if (!npc) return null;

    // AI 활동 상태 판단
    const getActivityStatus = () => {
        if (npc.destination) {
            return {
                status: "이동 중",
                icon: "🚶",
                description: `목적지: ${npc.destination.lat.toFixed(4)}, ${npc.destination.lng.toFixed(4)}`
            };
        }
        return {
            status: "대기 중",
            icon: "⏸️",
            description: "다음 명령 대기 중"
        };
    };

    const activity = getActivityStatus();

    return (
        <div className="fixed bottom-4 right-4 w-96 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl z-[1000] overflow-hidden">
            {/* 헤더 */}
            <div className="flex items-center justify-between p-4 border-b border-gray-700" style={{ backgroundColor: npc.faction_color + '20' }}>
                <div className="flex items-center gap-3">
                    <div className="text-3xl">{npc.npc_type === 'ABSOLUTE' ? '👑' : '🤖'}</div>
                    <div>
                        <h3 className="font-bold text-lg text-white">{npc.cyborg_name}</h3>
                        <p className="text-sm text-gray-400">Level {npc.level} {npc.npc_type}</p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-white transition-colors"
                >
                    ✕
                </button>
            </div>

            {/* 팩션 정보 */}
            <div className="p-4 border-b border-gray-700">
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: npc.faction_color }}></div>
                    <span className="text-white font-medium">{npc.faction_name}</span>
                </div>
            </div>

            {/* 활동 상태 */}
            <div className="p-4 bg-gray-800">
                <h4 className="text-sm font-semibold text-gray-400 mb-3">활동 상태</h4>
                <div className="flex items-start gap-3 p-3 bg-gray-900 rounded-lg">
                    <div className="text-2xl">{activity.icon}</div>
                    <div className="flex-1">
                        <div className="font-semibold text-white mb-1">{activity.status}</div>
                        <div className="text-sm text-gray-400">{activity.description}</div>
                    </div>
                </div>
            </div>

            {/* 위치 정보 */}
            <div className="p-4 border-t border-gray-700">
                <h4 className="text-sm font-semibold text-gray-400 mb-2">현재 위치</h4>
                <div className="text-white font-mono text-sm">
                    {npc.lat.toFixed(6)}, {npc.lng.toFixed(6)}
                </div>
            </div>

            {/* AI 행동 패턴 (예정) */}
            <div className="p-4 border-t border-gray-700 bg-gray-800">
                <h4 className="text-sm font-semibold text-gray-400 mb-2">AI 행동 패턴</h4>
                <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-gray-300">
                        <span>🔍</span>
                        <span>자원 탐지 (시야 10km)</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-300">
                        <span>🏗️</span>
                        <span>영토 확장 (자원 충족 시)</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-300">
                        <span>🚶</span>
                        <span>순찰 (사령부 20km 반경)</span>
                    </div>
                </div>
            </div>
            {/* Admin Controls */}
            <div className="p-4 border-t border-gray-700 bg-gray-900">
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onOpenAdminControl();
                    }}
                    className="w-full py-2 bg-red-900/50 hover:bg-red-900 border border-red-700 rounded text-red-100 text-sm font-bold transition-colors"
                >
                    🔧 관리자 제어 (Admin Control)
                </button>
            </div>
        </div>
    );
}
