"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Server, Activity, ShoppingBag, ShieldAlert, Cpu } from "lucide-react";
import { motion } from "framer-motion";
import { API_BASE_URL } from "@/lib/config";

interface SystemConfig {
    market_fluctuation: boolean;
    market_interval: number;
    production_active: boolean;
    production_interval: number;
    npc_activity: boolean;
    npc_interval: number;
    faction_active: boolean;
    faction_interval: number;
    client_poll_interval: number;
    npc_position_update_interval: number;
}

export default function AdminSystemPage() {
    const router = useRouter();
    const [config, setConfig] = useState<SystemConfig | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`${API_BASE_URL}/api/admin/system/config`)
            .then(res => res.json())
            .then(data => {
                setConfig(data);
                setLoading(false);
            })
            .catch(err => console.error("Failed to load system config", err));
    }, []);

    const toggleConfig = (key: keyof SystemConfig) => {
        if (!config) return;

        const newValue = !config[key];
        const newConfig = { ...config, [key]: newValue };
        setConfig(newConfig);

        fetch(`${API_BASE_URL}/api/admin/system/config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ [key]: newValue })
        }).catch(err => console.error("Failed to update config", err));
    };

    const updateInterval = (key: keyof SystemConfig, seconds: number) => {
        if (!config) return;

        const ms = seconds * 1000;
        const newConfig = { ...config, [key]: ms };
        setConfig(newConfig);

        fetch(`${API_BASE_URL}/api/admin/system/config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ [key]: ms })
        }).catch(err => console.error("Failed to update config", err));
    };

    if (loading) return <div className="min-h-screen bg-black text-green-500 font-mono flex items-center justify-center">Loading System Interface...</div>;

    return (
        <div className="min-h-screen bg-black text-green-500 font-mono p-8">
            <header className="mb-8 flex items-center gap-4">
                <button
                    onClick={() => router.back()}
                    className="p-2 border border-green-800 hover:bg-green-900/30 rounded text-green-400 transition-colors"
                >
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-3xl font-bold uppercase tracking-wider flex items-center gap-3">
                        <Server className="text-green-400" />
                        System Control Node
                    </h1>
                    <p className="text-green-700 text-sm mt-1">Manage core server processes and computational loads.</p>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                {/* Market Control */}
                <ControlCard
                    title="Market Fluctuations"
                    description="시장 가격 변동 알고리즘을 제어합니다. 비활성화 시 모든 아이템 가격이 현재 값으로 고정됩니다."
                    active={config?.market_fluctuation || false}
                    interval={config?.market_interval ? config.market_interval / 1000 : 60}
                    icon={<ShoppingBag />}
                    onToggle={() => toggleConfig('market_fluctuation')}
                    onIntervalChange={(val) => updateInterval('market_interval', val)}
                />

                {/* Resource Production */}
                <ControlCard
                    title="Resource Production"
                    description="글로벌 채굴 및 제작 루프를 제어합니다. 비활성화 시 모든 자원 생성이 일시정지됩니다."
                    active={config?.production_active || false}
                    interval={config?.production_interval ? config.production_interval / 1000 : 60}
                    icon={<Cpu />}
                    onToggle={() => toggleConfig('production_active')}
                    onIntervalChange={(val) => updateInterval('production_interval', val)}
                />

                {/* NPC Activity */}
                <ControlCard
                    title="Minion AI Logic"
                    description="미니언 자율 행동 처리를 제어합니다 (채굴, 휴식, 충성도 관리 등). 매 주기마다 모든 미니언의 상태를 확인하여 자동 행동을 결정합니다."
                    active={config?.npc_activity || false}
                    interval={config?.npc_interval ? config.npc_interval / 1000 : 60}
                    icon={<Activity />}
                    onToggle={() => toggleConfig('npc_activity')}
                    onIntervalChange={(val) => updateInterval('npc_interval', val)}
                />

                {/* Faction Logic */}
                <ControlCard
                    title="Faction War Logic"
                    description="Absolute & Free 세력의 거시적 전략 AI를 제어합니다 (침공, 외교, 영토 확장 등). 매 주기마다 각 세력의 전략적 의사결정을 실행합니다."
                    active={config?.faction_active || false}
                    interval={config?.faction_interval ? config.faction_interval / 1000 : 60}
                    icon={<ShieldAlert />}
                    onToggle={() => toggleConfig('faction_active')}
                    onIntervalChange={(val) => updateInterval('faction_interval', val)}
                />

                {/* Global Client Polling */}
                <div className="border border-green-900/50 bg-green-900/5 p-6 rounded-lg">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-gray-900 rounded-lg text-green-500 border border-green-800">
                            <Activity size={24} />
                        </div>
                        <span className="px-2 py-1 bg-green-900/30 text-green-400 text-xs rounded border border-green-800">GLOBAL</span>
                    </div>
                    <h3 className="text-xl font-bold text-green-100 mb-2">Global Polling Rate</h3>
                    <p className="text-green-700/80 text-sm mb-6 min-h-[60px]">
                        클라이언트가 서버에 데이터를 요청하는 주기를 제어합니다. (Market, Minion Panel, Mail 등)
                    </p>
                    <div className="flex items-center gap-2 mb-4">
                        <span className="text-sm text-gray-400">Interval (sec):</span>
                        <BufferedInput
                            className="bg-black border border-green-800 text-green-400 p-1 w-20 text-center rounded"
                            value={config?.client_poll_interval ? config.client_poll_interval / 1000 : 60}
                            onCommit={(val) => updateInterval('client_poll_interval', val)}
                        />
                    </div>
                    <div className="w-full py-3 rounded font-bold tracking-wider text-center bg-gray-900/20 text-green-600 border border-green-800/50">
                        CLIENT SYNC ACTIVE
                    </div>
                </div>

                {/* NPC Position Update Interval */}
                <div className="border border-green-900/50 bg-green-900/5 p-6 rounded-lg">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-gray-900 rounded-lg text-green-500 border border-green-800">
                            <Activity size={24} />
                        </div>
                        <span className="px-2 py-1 bg-blue-900/30 text-blue-400 text-xs rounded border border-blue-800">NPC SYSTEM</span>
                    </div>
                    <h3 className="text-xl font-bold text-green-100 mb-2">NPC Position Update</h3>
                    <p className="text-green-700/80 text-sm mb-6 min-h-[60px]">
                        이동 중인 NPC의 실제 위치를 업데이트하는 주기입니다. 짧을수록 정확하지만 서버 부하가 증가합니다. (10~120초 권장)
                    </p>
                    <div className="flex items-center gap-2 mb-4">
                        <span className="text-sm text-gray-400">Interval (sec):</span>
                        <BufferedInput
                            className="bg-black border border-green-800 text-green-400 p-1 w-20 text-center rounded"
                            value={config?.npc_position_update_interval || 30}
                            min="10"
                            onCommit={(val) => {
                                if (!config) return;
                                const newConfig = { ...config, npc_position_update_interval: val };
                                setConfig(newConfig);
                                fetch(`/api/admin/system/config`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ npc_position_update_interval: val })
                                }).catch(err => console.error("Failed to update config", err));
                            }}
                        />
                    </div>
                    <div className="w-full py-3 rounded font-bold tracking-wider text-center bg-gray-900/20 text-blue-600 border border-blue-800/50">
                        POSITION TRACKING ACTIVE
                    </div>
                </div>

            </div>

            <div className="mt-12 p-6 border border-red-900/30 bg-red-900/5 rounded-lg">
                <h3 className="text-red-500 font-bold flex items-center gap-2 mb-2">
                    <ShieldAlert size={18} />
                    관리자 주의사항
                </h3>
                <p className="text-red-400/70 text-sm">
                    시스템 파라미터 변경은 모든 활성 유저에게 즉시 영향을 미칩니다. 주기를 너무 짧게 설정하면 서버 부하가 증가할 수 있습니다.
                </p>
            </div>
        </div>
    );
}

function ControlCard({ title, description, active, interval, icon, onToggle, onIntervalChange }: {
    title: string, description: string, active: boolean, interval: number, icon: React.ReactNode, onToggle: () => void, onIntervalChange: (val: number) => void
}) {
    return (
        <motion.div
            layout
            className={`border ${active ? 'border-green-500/50 bg-green-500/5' : 'border-red-900/50 bg-red-900/5'} p-6 rounded-lg transition-colors`}
        >
            <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-lg ${active ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'} border ${active ? 'border-green-800' : 'border-red-900'}`}>
                    {icon}
                </div>
                <StatusBadge active={active} />
            </div>

            <h3 className={`text-xl font-bold mb-2 ${active ? 'text-green-100' : 'text-red-200'}`}>{title}</h3>
            <p className="text-green-700/80 text-sm mb-4 min-h-[40px]">{description}</p>

            <div className="flex items-center gap-2 mb-4 bg-black/20 p-2 rounded">
                <span className="text-xs text-gray-400 uppercase font-bold">Cycle (Sec):</span>
                <BufferedInput
                    min="1"
                    className={`bg-transparent border-b ${active ? 'border-green-800 text-green-400' : 'border-red-800 text-red-400'} p-1 w-16 text-center outline-none font-mono`}
                    value={interval}
                    onCommit={(val) => onIntervalChange(val)}
                />
            </div>

            <button
                onClick={onToggle}
                className={`w-full py-3 rounded font-bold tracking-wider transition-all flex items-center justify-center gap-2
                    ${active
                        ? 'bg-green-600 hover:bg-green-500 text-black shadow-[0_0_15px_rgba(34,197,94,0.3)]'
                        : 'bg-red-900/20 hover:bg-red-900/40 text-red-500 border border-red-800'
                    }`}
            >
                {active ? 'SYSTEM ACTIVE' : 'SYSTEM OFFLINE'}
            </button>
        </motion.div>
    );
}

function StatusBadge({ active }: { active: boolean }) {
    return (
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border ${active ? 'border-green-500/50 bg-green-500/10 text-green-400' : 'border-red-500/50 bg-red-500/10 text-red-400'}`}>
            <div className={`w-2 h-2 rounded-full ${active ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            {active ? 'RUNNING' : 'STOPPED'}
        </div>
    )
}

function BufferedInput({ value, onCommit, className, type = "number", min }: { value: number, onCommit: (val: number) => void, className?: string, type?: string, min?: string }) {
    const [localVal, setLocalVal] = useState(value);

    useEffect(() => {
        setLocalVal(value);
    }, [value]);

    return (
        <input
            type={type}
            min={min}
            className={className}
            value={localVal}
            onChange={(e) => setLocalVal(Number(e.target.value))}
            onBlur={() => onCommit(localVal)}
            onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    onCommit(localVal);
                    (e.target as HTMLInputElement).blur();
                }
            }}
        />
    )
}
