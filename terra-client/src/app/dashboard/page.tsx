"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Coins, Diamond, Database, Settings, User, LogOut, Shield, TrendingUp, Map } from "lucide-react";
import { motion } from "framer-motion";
import Mailbox from "@/components/Mailbox";
import { API_BASE_URL } from "@/lib/config";

interface Equipment {
    slot: string;
    item_id: number;
    name: string;
    code: string;
    description: string;
    stats: string;
}

interface UserData {
    id: number;
    username: string;
    role: string;
    cyborg_model: string | null;
    stats: {
        strength: number;
        agility: number;
        intelligence: number;
        wisdom: number;
        dexterity: number;
        constitution: number;
    };
    resources: {
        gold: number;
        gem: number;
    };
    equipment: Equipment[];
}

interface ProductionItem {
    code: string;
    qty: number;
}

export default function DashboardPage() {
    const [user, setUser] = useState<UserData | null>(null);
    const router = useRouter();

    useEffect(() => {
        const userId = localStorage.getItem("terra_user_id");
        if (!userId) {
            router.push("/login");
            return;
        }


        const loginTime = localStorage.getItem("terra_login_timestamp");
        const THREE_HOURS = 3 * 60 * 60 * 1000;
        if (!loginTime || Date.now() - parseInt(loginTime) > THREE_HOURS) {

            localStorage.clear();
            router.push("/login");
            return;
        }

        fetch(`${API_BASE_URL}/api/user/${userId}`)
            .then((res) => {
                if (!res.ok) throw new Error("Failed to fetch user");
                return res.json();
            })
            .then((data) => {
                // If user hasn't selected a model yet, redirect to creation
                if (!data.cyborg_model) {
                    router.push("/create-character");
                } else {
                    setUser(data);
                }
            })
            .catch((err) => {
                console.error(err);
                router.push("/login");
            });
    }, [router]);

    const [production, setProduction] = useState<{ gold: number, items: ProductionItem[] }>({ gold: 0, items: [] });


    useEffect(() => {
        if (!user) return;
        const fetchProduction = () => {
            fetch(`${API_BASE_URL}/api/production/pending?user_id=${user.id}`)
                .then(res => res.json())
                .then(data => setProduction(data))
                .catch(console.error);
        };
        fetchProduction();
        const interval = setInterval(fetchProduction, 5000); // Update every 5s
        return () => clearInterval(interval);
    }, [user]);

    const handleCollect = async () => {
        if (!user) return;
        try {
            const res = await fetch(`${API_BASE_URL}/api/production/collect`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: user.id })
            });
            const data = await res.json();
            if (data.success) {
                // Refresh User Data
                fetch(`${API_BASE_URL}/api/user/${user.id}`)
                    .then(res => res.json())
                    .then(u => setUser(u));
                // Reset Production
                setProduction({ gold: 0, items: [] });

            }
        } catch (e) { console.error(e); }
    };

    // Calculate Total Stats
    const calculateTotalStats = () => {
        if (!user) return { strength: 0, agility: 0, intelligence: 0, wisdom: 0, dexterity: 0, constitution: 0 };
        const total = { ...user.stats };
        user.equipment?.forEach(equip => {
            if (equip.stats) {
                try {
                    const bonuses = JSON.parse(equip.stats);
                    Object.entries(bonuses).forEach(([key, val]) => {
                        const statKey = key.toLowerCase() as keyof typeof total;
                        if (total[statKey] !== undefined) {
                            total[statKey] += Number(val);
                        }
                    });
                } catch (e) { }
            }
        });
        return total;
    };

    const effectiveStats = calculateTotalStats();

    if (!user) return <div className="min-h-screen bg-background text-white flex items-center justify-center">Loading Data Stream...</div>;

    return (
        <div className="min-h-screen bg-background text-white font-sans flex">
            {/* Sidebar */}
            <aside className="w-20 md:w-64 border-r border-surface-border bg-surface flex flex-col items-center md:items-stretch py-8 gap-8 z-10">
                <div className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary px-6 text-center md:text-left hidden md:block">
                    TERRA
                </div>

                <nav className="flex flex-col gap-2 px-4 w-full">
                    <NavItem icon={<Database />} label="Overview" active />
                    <div className="text-xs text-gray-500 font-bold uppercase tracking-wider px-3 mt-4 mb-2">Maps</div>
                    <NavItem icon={<Map />} label="3D Globe" onClick={() => router.push('/map2')} />
                    <NavItem icon={<Map />} label="Terrain (Leaflet)" onClick={() => router.push('/terrain-map')} />
                    <div className="text-xs text-gray-500 font-bold uppercase tracking-wider px-3 mt-4 mb-2">Economy</div>
                    <NavItem icon={<TrendingUp />} label="Market" onClick={() => router.push('/market')} />
                    <NavItem icon={<User />} label="Character" onClick={() => router.push('/character')} />
                    <NavItem icon={<Settings />} label="Settings" onClick={() => router.push('/settings')} />

                    {user.role === 'admin' && (
                        <div className="pt-4 border-t border-gray-700/50 mt-2">
                            <button
                                onClick={() => router.push('/admin')}
                                className="flex items-center gap-3 p-3 rounded-md transition-colors hover:bg-red-500/10 text-red-400 hover:text-red-300 w-full"
                            >
                                <Shield size={20} />
                                <span className="hidden md:inline font-bold">ADMIN</span>
                            </button>
                        </div>
                    )}

                    <div className="mt-auto px-4 w-full pt-8">
                        <button
                            onClick={() => {
                                localStorage.clear();
                                window.location.href = '/login';
                            }}
                            className="flex items-center gap-3 p-3 text-red-500 hover:bg-red-500/10 rounded-md w-full transition-colors"
                        >
                            <LogOut size={20} />
                            <span className="hidden md:inline font-bold">LOGOUT</span>
                        </button>
                    </div>
                </nav>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-8 overflow-y-auto relative">
                {/* Background Grid */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

                {/* Header (Resources) */}
                <header className="flex justify-between items-center mb-12">
                    <h1 className="text-3xl font-bold uppercase tracking-widest">Command Center</h1>

                    <div className="flex gap-4 items-center">
                        <Mailbox />
                        <div className="h-8 w-px bg-gray-700 mx-2"></div>
                        <ResourceCard icon={<Coins className="text-yellow-400" />} value={user.resources?.gold ?? 0} label="GOLD" />
                        <ResourceCard icon={<Diamond className="text-cyan-400" />} value={user.resources?.gem ?? 0} label="GEM" />
                    </div>
                </header>

                {/* Content Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="glass-card p-6 col-span-1 md:col-span-2"
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h2 className="text-xl font-bold text-primary">Identity Card</h2>
                                <p className="text-xs text-gray-400 font-mono mt-1">ID: {user.username.toUpperCase()}</p>
                            </div>
                            <span className="px-3 py-1 bg-surface-border rounded-full text-xs text-gray-300">
                                {user.cyborg_model || "UNASSIGNED"}
                            </span>
                        </div>

                        <div className="h-32 bg-surface-light rounded-md flex items-center justify-center border border-dashed border-gray-700 relative overflow-hidden">
                            {/* Placeholder Avatar Visual based on Model */}
                            <div className="text-6xl opacity-20">
                                {user.cyborg_model === "COMMANDER" ? "🧠" : user.cyborg_model === "EXPLORER" ? "⚡" : "🛡️"}
                            </div>
                            <span className="text-gray-500 text-sm absolute bottom-2">Model: {user.cyborg_model}</span>
                        </div>
                    </motion.div>

                    {/* Production Widget */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 }}
                        className="glass-card p-6 border border-yellow-500/30 shadow-[0_0_15px_rgba(234,179,8,0.1)]"
                    >
                        <h2 className="text-lg font-bold text-yellow-400 mb-2 flex items-center gap-2">
                            <TrendingUp size={18} /> Production
                        </h2>
                        <div className="flex flex-col gap-4 mt-4">
                            <div className="flex justify-between items-center">
                                <span className="text-gray-400 text-sm">Pending Gold</span>
                                <span className="font-mono text-xl text-yellow-400 font-bold">+{production.gold}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-gray-400 text-sm">Pending Items</span>
                                <span className="font-mono text-xl text-white font-bold">{production.items?.length || 0}</span>
                            </div>

                            <button
                                onClick={handleCollect}
                                disabled={production.gold === 0 && production.items?.length === 0}
                                className="mt-2 w-full py-2 bg-yellow-600 hover:bg-yellow-500 disabled:bg-gray-700 disabled:text-gray-500 text-black font-bold rounded flex items-center justify-center gap-2 transition-all"
                            >
                                COLLECT ALL
                            </button>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="glass-card p-6"
                    >
                        <h2 className="text-lg font-bold text-secondary mb-4">Cyborg Parameters</h2>
                        <div className="space-y-3">
                            <StatRow label="Strength (힘)" value={effectiveStats.strength} base={user.stats.strength} color="text-red-500" />
                            <StatRow label="Constitution (체력)" value={effectiveStats.constitution} base={user.stats.constitution} color="text-orange-500" />
                            <StatRow label="Dexterity (재주)" value={effectiveStats.dexterity} base={user.stats.dexterity} color="text-yellow-400" />
                            <StatRow label="Agility (민첩)" value={effectiveStats.agility} base={user.stats.agility} color="text-green-400" />
                            <StatRow label="Intelligence (지능)" value={effectiveStats.intelligence} base={user.stats.intelligence} color="text-blue-400" />
                            <StatRow label="Wisdom (지혜)" value={effectiveStats.wisdom} base={user.stats.wisdom} color="text-purple-400" />
                        </div>
                    </motion.div>
                </div>
            </main>
        </div >
    );
}

function StatRow({ label, value, base, color }: { label: string, value: number | undefined, base: number | undefined, color: string }) {
    const val = value || 0;
    const bas = base || 0;
    const bonus = val - bas;

    return (
        <div className="flex justify-between items-center text-sm">
            <span className="text-gray-400">{label}</span>
            <div className="flex items-center gap-2">
                <div className={`w-32 h-2 bg-surface-border rounded-full overflow-hidden flex`}>
                    <div className={`h-full bg-slate-500`} style={{ width: `${bas * 8}%` }} />
                    {bonus > 0 && (
                        <div className={`h-full ${color.replace('text-', 'bg-')}`} style={{ width: `${bonus * 8}%` }} />
                    )}
                </div>
                <span className={`font-mono font-bold ${color}`}>{val}</span>
            </div>
        </div>
    )
}

function ResourceCard({ icon, value, label }: { icon: React.ReactNode, value: number, label: string }) {
    return (
        <div className="flex items-center gap-3 px-5 py-2 bg-surface-light border border-surface-border rounded-full min-w-[140px]">
            {icon}
            <div className="flex flex-col">
                <span className="text-xs text-gray-500 font-bold">{label}</span>
                <span className="font-mono font-bold leading-none">{value.toLocaleString()}</span>
            </div>
        </div>
    )
}

function NavItem({ icon, label, active = false, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void }) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-3 p-3 rounded-md transition-colors ${active ? "bg-primary/10 text-primary border border-primary/20" : "hover:bg-surface-light text-gray-400 hover:text-white"}`}
        >
            {icon}
            <span className="hidden md:inline font-medium">{label}</span>
        </button>
    )
}
