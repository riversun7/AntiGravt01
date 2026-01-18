'use client';

import React, { useEffect, useState } from 'react';
import { Users, Battery, Heart, Zap, Brain } from 'lucide-react';

interface Minion {
    id: number;
    type: 'human' | 'android' | 'creature';
    name: string;
    level: number;
    hunger: number;
    stamina: number;
    battery: number;
    current_action: string;
    fatigue: number;
}

export default function MinionStatusPanel({ userId }: { userId: number }) {
    const [minions, setMinions] = useState<Minion[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchMinions = React.useCallback(async () => {
        if (!userId) return;
        try {
            const response = await fetch(`/api/character/${userId}/minions`);
            const data = await response.json();
            setMinions(data.minions || []);
        } catch (error) {
            console.error('Failed to fetch minions:', error);
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        let intervalId: NodeJS.Timeout;

        const initPolling = async () => {
            // 1. Initial Fetch
            fetchMinions();

            // 2. Get Config Interval
            try {
                const configRes = await fetch(`/api/admin/system/config`);
                const config = await configRes.json();
                const pollRate = config.client_poll_interval || 60000; // Default 1 min

                // 3. Start Interval
                intervalId = setInterval(fetchMinions, pollRate);
            } catch (e) {
                // Fallback
                intervalId = setInterval(fetchMinions, 60000);
            }
        };

        initPolling();

        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [fetchMinions]);

    if (loading) {
        return <div className="text-gray-400">미니언 정보 로딩 중...</div>;
    }

    const getActionColor = (action: string) => {
        switch (action) {
            case 'GATHER': return 'text-green-400';
            case 'GATHER_FOOD': return 'text-yellow-400';
            case 'REST': return 'text-blue-400';
            case 'EAT': return 'text-orange-400';
            case 'RECHARGE': return 'text-cyan-400';
            default: return 'text-gray-400';
        }
    };

    const getStatusBar = (value: number, type: 'hunger' | 'stamina' | 'battery' | 'fatigue') => {
        let color = 'bg-green-500';
        if (type === 'hunger' || type === 'fatigue') {
            if (value > 70) color = 'bg-red-500';
            else if (value > 40) color = 'bg-yellow-500';
        } else {
            if (value < 30) color = 'bg-red-500';
            else if (value < 60) color = 'bg-yellow-500';
        }

        return (
            <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                <div className={`h-full ${color} transition-all`} style={{ width: `${value}%` }} />
            </div>
        );
    };

    return (
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center gap-3 mb-4">
                <Users className="text-purple-400" size={24} />
                <h2 className="text-xl font-bold text-white">미니언 상태</h2>
                <span className="text-sm text-gray-400">({minions.length})</span>
            </div>

            <div className="space-y-3">
                {minions.length === 0 ? (
                    <p className="text-gray-500 text-sm">미니언이 없습니다</p>
                ) : (
                    minions.map((minion) => (
                        <div key={minion.id} className="bg-gray-700 rounded-lg p-4">
                            {/* Header */}
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <h3 className="text-white font-semibold">{minion.name}</h3>
                                    <p className="text-xs text-gray-400">
                                        {minion.type.toUpperCase()} • Lv.{minion.level}
                                    </p>
                                </div>
                                <span className={`text-xs font-semibold ${getActionColor(minion.current_action)}`}>
                                    {minion.current_action}
                                </span>
                            </div>

                            {/* Stats */}
                            <div className="space-y-2">
                                {minion.type !== 'android' && (
                                    <>
                                        <div>
                                            <div className="flex items-center justify-between text-xs mb-1">
                                                <span className="text-gray-400 flex items-center gap-1">
                                                    <Heart size={12} />배고픔
                                                </span>
                                                <span className="text-white">{minion.hunger}%</span>
                                            </div>
                                            {getStatusBar(minion.hunger, 'hunger')}
                                        </div>
                                        <div>
                                            <div className="flex items-center justify-between text-xs mb-1">
                                                <span className="text-gray-400 flex items-center gap-1">
                                                    <Zap size={12} />스태미나
                                                </span>
                                                <span className="text-white">{minion.stamina}%</span>
                                            </div>
                                            {getStatusBar(minion.stamina, 'stamina')}
                                        </div>
                                    </>
                                )}
                                {minion.type === 'android' && (
                                    <div>
                                        <div className="flex items-center justify-between text-xs mb-1">
                                            <span className="text-gray-400 flex items-center gap-1">
                                                <Battery size={12} />배터리
                                            </span>
                                            <span className="text-white">{minion.battery}%</span>
                                        </div>
                                        {getStatusBar(minion.battery, 'battery')}
                                    </div>
                                )}
                                <div>
                                    <div className="flex items-center justify-between text-xs mb-1">
                                        <span className="text-gray-400 flex items-center gap-1">
                                            <Brain size={12} />피로도
                                        </span>
                                        <span className="text-white">{minion.fatigue.toFixed(1)}%</span>
                                    </div>
                                    {getStatusBar(minion.fatigue, 'fatigue')}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
