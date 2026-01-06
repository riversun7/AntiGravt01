import { useState } from "react";
import { MinionData, Equipment, Skill } from "@/types/character";
import { X, Activity, Layers, Zap, Heart, Battery, Play } from "lucide-react";
import EquipmentSlot from "./EquipmentSlot";
import StatBar from "./StatBar";
import ItemIcon from "@/components/ItemIcon";

interface MinionDetailModalProps {
    minion: MinionData;
    equipment: Equipment[];
    onClose: () => void;
    onRest: (id: number) => void;
    onCharge: (id: number) => void;
    onFeed: (id: number) => void;
}

export default function MinionDetailModal({ minion, equipment = [], onClose, onRest, onCharge, onFeed }: MinionDetailModalProps) {
    const [tab, setTab] = useState<'overview' | 'loadout'>('overview');

    // Helper to get equipment for slot
    const getEquip = (slot: string) => equipment.find(e => e.slot === slot);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="bg-slate-900 border border-cyan-500/30 p-0 rounded-2xl max-w-4xl w-full relative shadow-[0_0_50px_rgba(34,211,238,0.15)] flex flex-col max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="p-6 border-b border-slate-800 flex justify-between items-start bg-slate-950/50">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-slate-800 rounded-lg flex items-center justify-center border border-slate-700">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={`https://api.dicebear.com/9.x/bottts/svg?seed=${minion.name}`}
                                alt={minion.name}
                                className="w-12 h-12"
                            />
                        </div>
                        <div>
                            <div className="text-xs text-cyan-400 font-bold uppercase tracking-widest">{minion.type} UNIT</div>
                            <h2 className="text-2xl font-bold text-white uppercase">{minion.name}</h2>
                            <div className="text-sm text-slate-500">Level {minion.level} • {minion.species || "Standard"}</div>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-white p-2 rounded hover:bg-slate-800 transition-colors"><X size={24} /></button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-800 bg-slate-950/30">
                    <button
                        onClick={() => setTab('overview')}
                        className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2 border-b-2 transition-colors ${tab === 'overview' ? "border-cyan-500 text-cyan-400 bg-cyan-950/10" : "border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-900"}`}
                    >
                        <Activity size={16} /> Overview
                    </button>
                    <button
                        onClick={() => setTab('loadout')}
                        className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2 border-b-2 transition-colors ${tab === 'loadout' ? "border-cyan-500 text-cyan-400 bg-cyan-950/10" : "border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-900"}`}
                    >
                        <Layers size={16} /> Equipment
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1 bg-slate-900/50">
                    {tab === 'overview' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-6">
                                {/* Stats */}
                                <div className="bg-slate-950 p-6 rounded-xl border border-slate-800 space-y-4">
                                    <h3 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-4">Unit Statistics</h3>
                                    <StatBar label="Strength" value={minion.strength} base={minion.strength} max={20} color="bg-red-500" />
                                    <StatBar label="Dexterity" value={minion.dexterity} base={minion.dexterity} max={20} color="bg-yellow-500" />
                                    <StatBar label="Constitution" value={minion.constitution} base={minion.constitution} max={20} color="bg-orange-500" />
                                    <StatBar label="Intelligence" value={minion.intelligence} base={minion.intelligence} max={20} color="bg-blue-500" />
                                </div>

                                {/* Status */}
                                <div className="bg-slate-950 p-6 rounded-xl border border-slate-800 space-y-4">
                                    <h3 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-4">Condition</h3>

                                    <div className="space-y-2">
                                        <div className="flex justify-between text-xs text-slate-400 uppercase font-bold">
                                            <span>Hit Points</span>
                                            <span>{minion.hp} / {minion.hp}</span>
                                        </div>
                                        <div className="h-2 bg-slate-900 rounded-full overflow-hidden"><div className="h-full bg-red-500" style={{ width: '100%' }} /></div>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex justify-between text-xs text-slate-400 uppercase font-bold">
                                            <span>Fatigue</span>
                                            <span>{minion.fatigue}%</span>
                                        </div>
                                        <div className="h-2 bg-slate-900 rounded-full overflow-hidden"><div className="h-full bg-yellow-500" style={{ width: `${minion.fatigue}%` }} /></div>
                                    </div>

                                    {minion.type === 'android' && (
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-xs text-slate-400 uppercase font-bold">
                                                <span>Battery</span>
                                                <span>{minion.battery}%</span>
                                            </div>
                                            <div className="h-2 bg-slate-900 rounded-full overflow-hidden"><div className="h-full bg-cyan-500" style={{ width: `${minion.battery}%` }} /></div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-6">
                                {/* Actions */}
                                <div className="bg-slate-950 p-6 rounded-xl border border-slate-800">
                                    <h3 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-4">Unit Commands</h3>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button onClick={() => onRest(minion.id)} className="p-4 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg flex flex-col items-center gap-2 transition-colors group">
                                            <Activity className="text-emerald-500 group-hover:text-emerald-400" />
                                            <span className="text-sm font-bold text-slate-300">Rest</span>
                                        </button>
                                        {minion.type === 'android' ? (
                                            <button onClick={() => onCharge(minion.id)} className="p-4 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg flex flex-col items-center gap-2 transition-colors group">
                                                <Battery className="text-cyan-500 group-hover:text-cyan-400" />
                                                <span className="text-sm font-bold text-slate-300">Recharge</span>
                                            </button>
                                        ) : (
                                            <button onClick={() => onFeed(minion.id)} className="p-4 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg flex flex-col items-center gap-2 transition-colors group">
                                                <Heart className="text-red-500 group-hover:text-red-400" />
                                                <span className="text-sm font-bold text-slate-300">Feed</span>
                                            </button>
                                        )}
                                        <button className="p-4 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg flex flex-col items-center gap-2 transition-colors group opacity-50 cursor-not-allowed" title="Coming Soon">
                                            <Play className="text-purple-500" />
                                            <span className="text-sm font-bold text-slate-300">Train</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Info */}
                                <div className="bg-slate-900/50 p-4 rounded text-sm text-slate-500 leading-relaxed font-mono border border-slate-800">
                                    &gt; ID: {minion.id}<br />
                                    &gt; CREATED: {new Date(minion.created_at).toLocaleDateString()}<br />
                                    &gt; LOYALTY: {minion.loyalty}%<br />
                                    {minion.lifespan && <> &gt; LIFESPAN: {minion.lifespan - minion.age} cycles remaining<br /></>}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-8">
                            {/* Minion Loadout is simpler: Head, Body, Weapon? Or generic? 
                                The DB schema defines Slots. Let's assume generic standard slots for minions or simplified.
                                For now, I'll render a few standard slots.
                             */}
                            <div className="flex flex-col gap-4">
                                <EquipmentSlot slot="HEAD" label="Head" item={getEquip('HEAD')} onClick={() => { }} />
                                <EquipmentSlot slot="BODY" label="Body" item={getEquip('BODY')} onClick={() => { }} />
                                <EquipmentSlot slot="WEAPON" label="Weapon" item={getEquip('WEAPON')} onClick={() => { }} />
                            </div>
                            <div className="flex items-center justify-center text-slate-500 text-sm border-l border-slate-800 pl-8">
                                Select a slot to equip items from inventory.
                                <br />(Inventory integration pending for minions)
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
