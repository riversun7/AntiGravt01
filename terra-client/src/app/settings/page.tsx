"use client";

import { useState } from "react";
import SystemMenu from "@/components/SystemMenu";
import { Settings, Monitor, Languages, ChevronDown, Check } from "lucide-react";

export default function SettingsPage() {
    return (
        <main className="min-h-screen bg-[#050508] text-slate-200 selection:bg-cyan-500/30 font-sans relative overflow-hidden">
            {/* Background Effects */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[120px] mix-blend-screen animate-pulse-slow"></div>
                <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-cyan-600/10 rounded-full blur-[120px] mix-blend-screen animate-pulse-slow" style={{ animationDelay: '2s' }}></div>
                <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] opacity-20"></div>
            </div>

            <SystemMenu activePage="settings" />

            <div className="relative z-10 container mx-auto px-4 py-8 md:py-12 max-w-4xl">
                <header className="mb-8 md:mb-12 border-b border-white/10 pb-6">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-cyan-900/20 rounded-lg border border-cyan-500/30 text-cyan-400">
                            <Settings size={24} />
                        </div>
                        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white glow-text">
                            SYSTEM CONFIGURATION
                        </h1>
                    </div>
                    <p className="text-slate-400 max-w-2xl text-sm md:text-base ml-1">
                        Adjust interface parameters and system localization settings.
                    </p>
                </header>

                <div className="space-y-6">
                    {/* General Section */}
                    <section className="bg-[#0a0a12]/80 backdrop-blur-md border border-white/10 rounded-xl overflow-hidden shadow-xl">
                        <div className="px-6 py-4 border-b border-white/5 bg-white/5 flex items-center gap-2">
                            <Languages size={18} className="text-purple-400" />
                            <h2 className="text-lg font-semibold text-white">General Settings</h2>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="max-w-md">
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                    Interface Language
                                </label>
                                <div className="relative">
                                    <select
                                        className="w-full appearance-none bg-[#141420] border border-white/10 rounded-lg px-4 py-3 text-slate-200 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all cursor-pointer hover:border-white/20"
                                        defaultValue="en"
                                    >
                                        <option value="en">English (United States)</option>
                                        <option value="ko">한국어 (Korean)</option>
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                                        <ChevronDown size={16} />
                                    </div>
                                </div>
                                <p className="text-xs text-slate-500 mt-2">
                                    Select the primary language for the tactical interface.
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* Display Section */}
                    <section className="bg-[#0a0a12]/80 backdrop-blur-md border border-white/10 rounded-xl overflow-hidden shadow-xl">
                        <div className="px-6 py-4 border-b border-white/5 bg-white/5 flex items-center gap-2">
                            <Monitor size={18} className="text-cyan-400" />
                            <h2 className="text-lg font-semibold text-white">Display Settings</h2>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="max-w-md">
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                    Target Resolution
                                </label>
                                <div className="relative">
                                    <select
                                        className="w-full appearance-none bg-[#141420] border border-white/10 rounded-lg px-4 py-3 text-slate-200 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all cursor-pointer hover:border-white/20"
                                        defaultValue="1080p"
                                    >
                                        <option value="720p">1280 x 720 (HD)</option>
                                        <option value="1080p">1920 x 1080 (FHD)</option>
                                        <option value="1440p">2560 x 1440 (QHD)</option>
                                        <option value="4k">3840 x 2160 (4K)</option>
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                                        <ChevronDown size={16} />
                                    </div>
                                </div>
                                <p className="text-xs text-slate-500 mt-2">
                                    Set the preferred rendering resolution for tactical maps.
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* Footer / Status */}
                    <div className="flex items-center justify-between p-4 rounded-lg bg-cyan-950/20 border border-cyan-900/30">
                        <div className="flex items-center gap-2 text-cyan-400 text-sm">
                            <Check size={16} />
                            <span>All systems nominal. Configuration saved automatically.</span>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
