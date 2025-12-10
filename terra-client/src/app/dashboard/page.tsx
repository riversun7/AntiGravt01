"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Coins, Diamond, Database, Settings, User } from "lucide-react";
import { motion } from "framer-motion";

interface UserData {
    id: number;
    username: string;
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

        fetch(`http://localhost:3001/api/user/${userId}`)
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
                    <NavItem icon={<User />} label="Character" />
                    <NavItem icon={<Settings />} label="Settings" />
                </nav>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-8 overflow-y-auto relative">
                {/* Background Grid */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

                {/* Header (Resources) */}
                <header className="flex justify-between items-center mb-12">
                    <h1 className="text-3xl font-bold uppercase tracking-widest">Command Center</h1>

                    <div className="flex gap-4">
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

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="glass-card p-6"
                    >
                        <h2 className="text-lg font-bold text-secondary mb-4">Cyborg Parameters</h2>
                        <div className="space-y-3">
                            <StatRow label="Strength (힘)" value={user.stats?.strength} color="text-red-500" />
                            <StatRow label="Constitution (체력)" value={user.stats?.constitution} color="text-orange-500" />
                            <StatRow label="Dexterity (재주)" value={user.stats?.dexterity} color="text-yellow-400" />
                            <StatRow label="Agility (민첩)" value={user.stats?.agility} color="text-green-400" />
                            <StatRow label="Intelligence (지능)" value={user.stats?.intelligence} color="text-blue-400" />
                            <StatRow label="Wisdom (지혜)" value={user.stats?.wisdom} color="text-purple-400" />
                        </div>
                    </motion.div>
                </div>
            </main>
        </div>
    );
}

function StatRow({ label, value, color }: { label: string, value: number | undefined, color: string }) {
    return (
        <div className="flex justify-between items-center text-sm">
            <span className="text-gray-400">{label}</span>
            <div className="flex items-center gap-2">
                <div className={`w-32 h-2 bg-surface-border rounded-full overflow-hidden`}>
                    <div className={`h-full ${color.replace('text-', 'bg-')}`} style={{ width: `${(value || 0) * 10}%` }} />
                </div>
                <span className={`font-mono font-bold ${color}`}>{value}</span>
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

function NavItem({ icon, label, active = false }: { icon: React.ReactNode, label: string, active?: boolean }) {
    return (
        <button className={`flex items-center gap-3 p-3 rounded-md transition-colors ${active ? "bg-primary/10 text-primary border border-primary/20" : "hover:bg-surface-light text-gray-400 hover:text-white"}`}>
            {icon}
            <span className="hidden md:inline font-medium">{label}</span>
        </button>
    )
}
