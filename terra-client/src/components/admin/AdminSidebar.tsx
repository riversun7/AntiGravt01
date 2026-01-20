"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    Users,
    Database,
    ClipboardList,
    ArrowLeft,
    Send,
    Server,
    Shield
} from "lucide-react";

/**
 * @file AdminSidebar.tsx
 * @description 관리자 패널의 좌측 사이드바 내비게이션
 * @role 관리자 기능 페이지(대시보드, 유저 관리, NPC 관리, 우편, DB 검사 등)로의 이동 링크 제공
 * @dependencies next/link, next/navigation, lucide-react
 * @status Active
 * 
 * @analysis
 * - Next.js의 `usePathname`을 사용하여 현재 활성화된 메뉴를 시각적으로 강조(Highlight).
 * - 일반 사용자가 접근할 수 없는 중요한 관리 기능들로 구성됨.
 * - 하단의 'EXIT TO MAIN'을 통해 일반 게임 화면으로 복귀 가능.
 */
const menuItems = [
    { name: "대시보드 (Dashboard)", href: "/admin", icon: LayoutDashboard },
    { name: "사용자 관리 (Users)", href: "/admin/users", icon: Users },
    { name: "NPC 팩션 (NPC Factions)", href: "/admin/npc", icon: Shield },
    { name: "우편 콘솔 (Mail Console)", href: "/admin/mail", icon: Send },
    { name: "DB 검사기 (DB Inspector)", href: "/admin/db-inspector", icon: Database },
    { name: "시스템 노드 (System Node)", href: "/admin/system", icon: Server },
    { name: "기획/할일 (Planning)", href: "/admin/planning", icon: ClipboardList },
];

export default function AdminSidebar() {
    const pathname = usePathname();

    return (
        <aside className="w-64 bg-surface border-r border-surface-border h-screen flex flex-col sticky top-0">
            <div className="p-6 border-b border-surface-border">
                <h1 className="text-xl font-bold text-red-500 tracking-wider flex items-center gap-2">
                    <Database className="w-6 h-6" />
                    ADMIN
                </h1>
                <p className="text-xs text-gray-500 mt-1 uppercase tracking-widest">Control Center</p>
            </div>

            <nav className="flex-1 overflow-y-auto py-4">
                <ul className="space-y-1 px-3">
                    {menuItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname === item.href;

                        return (
                            <li key={item.name}>
                                <Link
                                    href={item.href}
                                    className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-all duration-200 group ${isActive
                                        ? "bg-red-500/10 text-red-500 border border-red-500/20"
                                        : "text-gray-400 hover:text-white hover:bg-white/5"
                                        }`}
                                >
                                    <Icon size={18} className={isActive ? "text-red-500" : "text-gray-500 group-hover:text-white"} />
                                    <span className="font-medium text-sm">{item.name}</span>
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </nav>

            <div className="p-4 border-t border-surface-border">
                <Link
                    href="/dashboard"
                    className="flex items-center justify-center gap-2 w-full py-3 rounded-md bg-gradient-to-r from-red-900/50 to-red-800/50 hover:from-red-800 hover:to-red-700 text-red-200 hover:text-white border border-red-500/30 hover:border-red-400 transition-all font-bold shadow-lg shadow-red-900/10"
                >
                    <ArrowLeft size={18} />
                    메인으로 복귀 (EXIT)
                </Link>
            </div>
        </aside>
    );
}
