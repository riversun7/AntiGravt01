"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Server, Activity, ShoppingBag, ShieldAlert, Cpu } from "lucide-react";
import { motion } from "framer-motion";

interface SystemConfig {
    market_fluctuation: boolean;
    npc_activity: boolean;
    client_polling_rate?: string;
}

export default function AdminSystemPage() {
    const router = useRouter();
    const [config, setConfig] = useState<SystemConfig | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('http://localhost:3001/api/admin/system/config')
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

        // Optimistic UI Update
        setConfig(newConfig);

        fetch('http://localhost:3001/api/admin/system/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ [key]: newValue })
        }).catch(err => {
            console.error("Failed to update config", err);
            // Revert on failure
            setConfig(config);
        });
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
                    description="Controls the automated price volatility algorithm. Disabling this stops price updates."
                    active={config?.market_fluctuation || false}
                    icon={<ShoppingBag />}
                    onToggle={() => toggleConfig('market_fluctuation')}
                />

                {/* NPC Activity */}
                <ControlCard
                    title="NPC Autonomous Logic"
                    description="Controls background processing for NPC behaviors and scheduled events."
                    active={config?.npc_activity || false}
                    icon={<Cpu />}
                    onToggle={() => toggleConfig('npc_activity')}
                />

                {/* Future: Client Polling */}
                <div className="border border-green-900/50 bg-green-900/5 p-6 rounded-lg opacity-50 cursor-not-allowed">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-gray-900 rounded-lg text-gray-500 border border-gray-800">
                            <Activity size={24} />
                        </div>
                        <span className="px-2 py-1 bg-gray-900 text-gray-500 text-xs rounded border border-gray-800">LOCKED</span>
                    </div>
                    <h3 className="text-xl font-bold text-gray-500 mb-2">Global Polling Rate</h3>
                    <p className="text-gray-600 text-sm mb-6 min-h-[40px]">
                        Dynamic adjustment of client request intervals. Feature unavailable in current kernel.
                    </p>
                </div>

            </div>

            <div className="mt-12 p-6 border border-red-900/30 bg-red-900/5 rounded-lg">
                <h3 className="text-red-500 font-bold flex items-center gap-2 mb-2">
                    <ShieldAlert size={18} />
                    Administrator Note
                </h3>
                <p className="text-red-400/70 text-sm">
                    Modifying system parameters affects all active users immediately. Disabling market fluctuations will freeze all item prices at their current values.
                </p>
            </div>
        </div>
    );
}

function ControlCard({ title, description, active, icon, onToggle }: {
    title: string, description: string, active: boolean, icon: React.ReactNode, onToggle: () => void
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
            <p className="text-green-700/80 text-sm mb-6 min-h-[40px]">{description}</p>

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
