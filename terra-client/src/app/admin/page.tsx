/**
 * @file admin/page.tsx
 * @description 관리자 대시보드 메인 페이지
 * @role 시스템 상태, 사용자 통계, 관리 도구 링크를 제공하는 허브
 * @dependencies lucide-react (아이콘), Link (Next.js)
 * @status Active
 * 
 * @analysis
 * **주요 기능:**
 * - 시스템 상태 카드 (사용자 수, 서버 상태, DB 연결, 부하)
 * - 관리 도구 바로가기 (Mail, System, DB Inspector, Planning 등)
 * - 최근 활동 로그 (향후 구현 예정)
 * 
 * **바로가기 링크:**
 * - Mail Console: 아이템/메시지 발송
 * - Server Control: 서버 프로세스 관리
 * - DB Inspector: 테이블 조회/수정
 * - Planning Board: 작업 관리 (Kanban)
 * - User Manager: 유저 역할 관리
 * - DB Designer: 스키마 편집기
 */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, Database, Server, Activity, Send } from "lucide-react";
import { AdminUser } from "@/types/admin";
import { API_BASE_URL } from "@/lib/config";

export default function AdminDashboardPage() {
    const [userCount, setUserCount] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`${API_BASE_URL}/api/admin/users`)
            .then(res => res.json())
            .then((data: AdminUser[]) => {
                if (Array.isArray(data)) {
                    setUserCount(data.length);
                } else {
                    console.error("Expected array of users, got:", data);
                    setUserCount(0);
                }
                setLoading(false);
            })
            .catch((err) => {
                console.error("Failed to load users:", err);
                setUserCount(0);
                setLoading(false);
            });
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

                {/* System Control Shortcut */}
                <Link href="/admin/system" className="group relative overflow-hidden rounded-lg bg-gradient-to-br from-green-900/50 to-emerald-900/50 p-6 border border-green-500/30 hover:border-green-400 transition-all shadow-lg hover:shadow-green-500/20">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity scale-150 transform translate-x-2 -translate-y-2">
                        <Server size={48} className="text-white" />
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-2 text-green-300">
                            <Activity size={20} />
                            <span className="font-bold uppercase tracking-wider text-xs">System Node</span>
                        </div>
                        <h3 className="text-xl font-bold text-white mb-1">Server Control</h3>
                        <p className="text-xs text-green-200/70">Manage Load & Processes</p>
                    </div>
                </Link>

                {/* Database Tools */}
                <Link href="/admin/db-inspector" className="group relative overflow-hidden rounded-lg bg-gradient-to-br from-yellow-900/50 to-orange-900/50 p-6 border border-yellow-500/30 hover:border-yellow-400 transition-all shadow-lg hover:shadow-yellow-500/20">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity scale-150 transform translate-x-2 -translate-y-2">
                        <Database size={48} className="text-white" />
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-2 text-yellow-300">
                            <Database size={20} />
                            <span className="font-bold uppercase tracking-wider text-xs">Data Tools</span>
                        </div>
                        <h3 className="text-xl font-bold text-white mb-1">DB Inspector</h3>
                        <p className="text-xs text-yellow-200/70">View & Edit Tables</p>
                    </div>
                </Link>

                {/* Planning Tool */}
                <Link href="/admin/planning" className="group relative overflow-hidden rounded-lg bg-gradient-to-br from-purple-900/50 to-pink-900/50 p-6 border border-purple-500/30 hover:border-purple-400 transition-all shadow-lg hover:shadow-purple-500/20">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity scale-150 transform translate-x-2 -translate-y-2">
                        <Activity size={48} className="text-white" />
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-2 text-purple-300">
                            <Activity size={20} />
                            <span className="font-bold uppercase tracking-wider text-xs">Project Management</span>
                        </div>
                        <h3 className="text-xl font-bold text-white mb-1">Planning Board</h3>
                        <p className="text-xs text-purple-200/70">Tasks & Roadmap</p>
                    </div>
                </Link>

                {/* User Manager */}
                <Link href="/admin/users" className="group relative overflow-hidden rounded-lg bg-gradient-to-br from-blue-900/50 to-indigo-900/50 p-6 border border-blue-500/30 hover:border-blue-400 transition-all shadow-lg hover:shadow-blue-500/20">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity scale-150 transform translate-x-2 -translate-y-2">
                        <Users size={48} className="text-white" />
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-2 text-blue-300">
                            <Users size={20} />
                            <span className="font-bold uppercase tracking-wider text-xs">Access Control</span>
                        </div>
                        <h3 className="text-xl font-bold text-white mb-1">User Manager</h3>
                        <p className="text-xs text-blue-200/70">Roles & Profiles</p>
                    </div>
                </Link>

                {/* DB Designer */}
                <Link href="/admin/db-designer" className="group relative overflow-hidden rounded-lg bg-gradient-to-br from-orange-900/50 to-red-900/50 p-6 border border-orange-500/30 hover:border-orange-400 transition-all shadow-lg hover:shadow-orange-500/20">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity scale-150 transform translate-x-2 -translate-y-2">
                        <Database size={48} className="text-white" />
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-2 text-orange-300">
                            <Database size={20} />
                            <span className="font-bold uppercase tracking-wider text-xs">Schema Tools</span>
                        </div>
                        <h3 className="text-xl font-bold text-white mb-1">DB Designer</h3>
                        <p className="text-xs text-orange-200/70">Visual Schema Editor</p>
                    </div>
                </Link>
            </div>

            <div className="p-6 bg-surface border border-surface-border rounded-lg">
                <h3 className="text-lg font-bold mb-4">Recent Activity</h3>
                <p className="text-gray-500 text-sm">No recent system logs available.</p>
            </div>
        </div >
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
