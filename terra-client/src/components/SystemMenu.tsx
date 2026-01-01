"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Menu, Database, Globe, Map as MapIcon, Coins, User, Shield, LogOut, Settings } from "lucide-react";

interface SystemMenuProps {
    activePage?: 'dashboard' | 'map' | 'map2' | 'global-map' | 'terrain' | 'market' | 'character' | 'admin' | 'settings';
    variant?: 'default' | 'overlay'; // default for normal pages, overlay for maps
}

export default function SystemMenu({ activePage, variant = 'default' }: SystemMenuProps) {
    const router = useRouter();
    const [showMenu, setShowMenu] = useState(false);

    // Style Adjustments based on variant
    const buttonClass = variant === 'overlay'
        ? "flex items-center gap-2 text-cyan-500 hover:text-cyan-300 transition-colors uppercase text-xs font-bold tracking-widest border border-cyan-500/30 px-3 py-1 rounded bg-slate-900/50 active:bg-cyan-900/50 shadow-[0_0_10px_rgba(34,211,238,0.1)]"
        : "flex items-center gap-2 px-3 py-2 bg-slate-800/80 hover:bg-slate-700 border border-slate-600 rounded text-cyan-400 text-xs font-bold transition-all shadow-sm";

    const menuContainerClass = variant === 'overlay'
        ? "absolute top-10 left-0"
        : "absolute top-12 left-0";

    return (
        <div className="relative z-[100]">
            {/* System Menu Button */}
            <button
                onClick={() => setShowMenu(!showMenu)}
                className={buttonClass}
            >
                <Menu size={16} /> SYSTEM ACCESS
            </button>

            {/* Dropdown Menu */}
            {showMenu && (
                <>
                    {/* Backdrop for explicit closing on click-outside (optional but good for UX) */}
                    <div className="fixed inset-0 z-[100] cursor-default" onClick={() => setShowMenu(false)} />

                    <div className={`${menuContainerClass} w-64 bg-slate-900/95 border border-cyan-500/30 rounded backdrop-blur-md shadow-2xl flex flex-col gap-1 p-2 z-[101] animate-in fade-in slide-in-from-top-2 duration-200`}>
                        <div className="text-[10px] text-slate-500 uppercase tracking-widest px-2 py-1 border-b border-slate-800 mb-1">Navigation Systems</div>

                        <MenuItem
                            icon={<Database size={14} />}
                            label="OVERVIEW (DASHBOARD)"
                            isActive={activePage === 'dashboard'}
                            onClick={() => router.push('/dashboard')}
                        />
                        <MenuItem
                            icon={<MapIcon size={14} />}
                            label="TACTICAL MAP"
                            isActive={activePage === 'map'}
                            onClick={() => router.push('/map')}
                        />
                        <MenuItem
                            icon={<Globe size={14} />}
                            label="3D GLOBE"
                            isActive={activePage === 'map2'}
                            onClick={() => router.push('/map2')}
                        />
                        <MenuItem
                            icon={<Globe size={14} />}
                            label="GLOBAL MAP (D3)"
                            isActive={activePage === 'global-map'}
                            onClick={() => router.push('/global-map')}
                        />
                        <MenuItem
                            icon={<MapIcon size={14} />}
                            label="TERRAIN (LEAFLET)"
                            isActive={activePage === 'terrain'}
                            onClick={() => router.push('/terrain-map')}
                        />

                        <div className="h-px bg-slate-800 my-1"></div>
                        <div className="text-[10px] text-slate-500 uppercase tracking-widest px-2 py-1 hidden md:block">Subsystems</div>

                        <MenuItem
                            icon={<Coins size={14} />}
                            label="MARKET"
                            color="text-yellow-400"
                            isActive={activePage === 'market'}
                            onClick={() => router.push('/market')}
                        />
                        <MenuItem
                            icon={<User size={14} />}
                            label="CHARACTER"
                            isActive={activePage === 'character'}
                            onClick={() => router.push('/character')}
                        />
                        <MenuItem
                            icon={<Shield size={14} />}
                            label="ADMIN"
                            color="text-red-400"
                            isActive={activePage === 'admin'}
                            onClick={() => router.push('/admin')}
                        />

                        <MenuItem
                            icon={<Settings size={14} />}
                            label="SETTINGS"
                            isActive={activePage === 'settings'}
                            onClick={() => router.push('/settings')}
                        />

                        <div className="h-px bg-slate-800 my-1"></div>
                        <button onClick={() => { localStorage.clear(); router.push('/login'); }} className="flex items-center gap-3 px-3 py-2 text-xs text-red-500 hover:bg-red-900/20 rounded text-left transition-colors font-bold z-[102] relative">
                            <LogOut size={14} /> LOGOUT
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}

function MenuItem({ icon, label, onClick, isActive, color = "text-slate-300" }: { icon: any, label: string, onClick: () => void, isActive?: boolean, color?: string }) {
    const activeClass = isActive
        ? "bg-cyan-900/40 text-cyan-300 border border-cyan-500/30"
        : `hover:bg-cyan-900/20 ${color}`;

    return (
        <button onClick={onClick} className={`flex items-center gap-3 px-3 py-2 text-xs rounded text-left transition-colors z-[102] relative ${activeClass}`}>
            {icon} {label} {isActive && "(ACTIVE)"}
        </button>
    )
}
