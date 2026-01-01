"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, Database, Server, Activity, Send } from "lucide-react";
import { AdminUser } from "@/types/admin";

export default function AdminDashboardPage() {
    const [userCount, setUserCount] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("http://localhost:3001/api/admin/users")
            .then(res => res.json())
            .then((data: AdminUser[]) => {
                setUserCount(data.length);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    return (
        <div>
            <h2 className="text-2xl font-bold mb-6 text-white">Dashboard Overview</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatCard
                    title="Total Users"
                    value={loading ? "..." : userCount.toString()}
                    icon={<Users className="text-blue-400" />}
                />
                <StatCard
                    title="System Status"
                    value="Online"
                    icon={<Activity className="text-green-400" />}
                    subtext="All systems operational"
                />
                <StatCard
                    title="Database"
                    value="Connected"
                    icon={<Database className="text-yellow-400" />}
                    subtext="SQLite"
                />
                <StatCard
                    title="Server Load"
                    value="Low"
                    icon={<Server className="text-purple-400" />}
                    subtext="Response time < 50ms"
                />

                {/* Shortcut Card */}
                <Link href="/admin/mail" className="group relative overflow-hidden rounded-lg bg-gradient-to-br from-cyan-900/50 to-blue-900/50 p-6 border border-cyan-500/30 hover:border-cyan-400 transition-all shadow-lg hover:shadow-cyan-500/20">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity scale-150 transform translate-x-2 -translate-y-2">
                        <Send size={48} className="text-white" />
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-2 text-cyan-300">
                            <Send size={20} />
                            <span className="font-bold uppercase tracking-wider text-xs">Quick Action</span>
                        </div>
                        <h3 className="text-xl font-bold text-white mb-1">Mail Console</h3>
                        <p className="text-xs text-cyan-200/70">Send items & messages</p>
                    </div>
                </Link>
            </div>

            <div className="p-6 bg-surface border border-surface-border rounded-lg">
                <h3 className="text-lg font-bold mb-4">Recent Activity</h3>
                <p className="text-gray-500 text-sm">No recent system logs available.</p>
            </div>
        </div>
    );
}

function StatCard({ title, value, icon, subtext }: { title: string, value: string, icon: React.ReactNode, subtext?: string }) {
    return (
        <div className="bg-surface p-6 rounded-lg border border-surface-border shadow-sm relative overflow-hidden group hover:border-surface-highlight transition-colors">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity scale-150 transform translate-x-2 -translate-y-2">
                {icon}
            </div>
            <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-white/5 rounded-lg">
                    {icon}
                </div>
                <h3 className="font-medium text-gray-400">{title}</h3>
            </div>
            <div className="text-3xl font-bold text-white mb-1">{value}</div>
            {subtext && <div className="text-xs text-gray-500">{subtext}</div>}
        </div>
    );
}
