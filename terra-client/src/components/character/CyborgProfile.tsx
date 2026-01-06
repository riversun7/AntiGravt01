import { motion } from "framer-motion";
import { Cpu, Shield } from "lucide-react";
import { CyborgData, Equipment, CharacterStats } from "@/types/character";
import StatBar from "./StatBar";
import EquipmentSlot from "./EquipmentSlot";

interface CyborgProfileProps {
    cyborg: CyborgData;
    equipment: Equipment[];
    onSlotClick: (slot: string) => void;
}

export default function CyborgProfile({ cyborg, equipment, onSlotClick }: CyborgProfileProps) {
    const getEquip = (slot: string) => equipment.find(e => e.slot === slot);

    // Calculate effective stats (base + equipment)
    const calculateStats = () => {
        // Start with base stats (assuming flat structure in CyborgData)
        // If CyborgData has strict CharacterStats fields, use them.
        // My type definition has BaseCharacter extending CharacterStats.
        const total = {
            strength: cyborg.strength,
            dexterity: cyborg.dexterity,
            constitution: cyborg.constitution,
            agility: cyborg.agility,
            intelligence: cyborg.intelligence,
            wisdom: cyborg.wisdom,
            hp: cyborg.hp,
            mp: cyborg.mp
        };

        equipment.forEach(equip => {
            if (equip.stats) {
                try {
                    const bonuses = JSON.parse(equip.stats);
                    Object.entries(bonuses).forEach(([key, val]) => {
                        const statKey = key.toLowerCase() as keyof typeof total;
                        if (total[statKey] !== undefined) {
                            total[statKey] += Number(val);
                        }
                    });
                } catch (e) {
                    console.error("Failed to parse stats for item", equip.name);
                }
            }
        });
        return total;
    };

    const effective = calculateStats();

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Center/Left: Visual Loadout (Takes 2 cols on huge screens or 1 col on separate line) */}
            <div className="lg:col-span-1 min-h-[600px] bg-slate-900/20 rounded-3xl border border-slate-800/50 flex items-center justify-center relative overflow-hidden">
                {/* Tech Circle Background */}
                <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
                    <div className="w-[500px] h-[500px] border border-cyan-500/30 rounded-full animate-[spin_10s_linear_infinite]" />
                    <div className="absolute w-[350px] h-[350px] border border-dashed border-cyan-500/30 rounded-full animate-[spin_20s_linear_infinite_reverse]" />
                </div>

                {/* Avatar */}
                <div className="relative z-10 w-64 h-64 filter drop-shadow-[0_0_30px_rgba(34,211,238,0.4)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={`https://api.dicebear.com/9.x/bottts/svg?seed=${cyborg.name}`} // Use name or other seed
                        alt="Cyborg Avatar"
                        className="w-full h-full object-contain cursor-pointer hover:scale-105 transition-transform"
                        onClick={() => onSlotClick('BODY')}
                    />
                </div>

                {/* Equipment Slots Positioning */}
                <div className="absolute left-6 top-1/2 -translate-y-1/2 flex flex-col gap-8">
                    <EquipmentSlot slot="HEAD" label="HEAD SENSOR" item={getEquip('HEAD')} align="left" onClick={() => onSlotClick('HEAD')} />
                    <EquipmentSlot slot="BODY" label="CHASSIS" item={getEquip('BODY')} align="left" onClick={() => onSlotClick('BODY')} />
                    <EquipmentSlot slot="ARMS" label="MANIPULATOR" item={getEquip('ARMS')} align="left" onClick={() => onSlotClick('ARMS')} />
                </div>

                <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col gap-8">
                    <EquipmentSlot slot="LEGS" label="LOCOMOTION" item={getEquip('LEGS')} align="right" onClick={() => onSlotClick('LEGS')} />
                    <EquipmentSlot slot="CORE" label="POWER CORE" item={getEquip('CORE')} align="right" onClick={() => onSlotClick('CORE')} />
                    <EquipmentSlot slot="WEAPON" label="HARDPOINT A" item={getEquip('WEAPON')} align="right" onClick={() => onSlotClick('WEAPON')} />
                </div>
            </div>

            {/* Right: Stats & Info */}
            <div className="lg:col-span-2 space-y-6">
                {/* Stats Panel */}
                <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
                    <h3 className="text-cyan-400 font-bold uppercase tracking-widest mb-6 flex items-center gap-2">
                        <Cpu size={18} /> Core Specifications
                    </h3>
                    <div className="space-y-4">
                        <StatBar label="Strength" value={effective.strength} base={cyborg.strength} color="bg-red-500" />
                        <StatBar label="Dexterity" value={effective.dexterity} base={cyborg.dexterity} color="bg-yellow-500" />
                        <StatBar label="Constitution" value={effective.constitution} base={cyborg.constitution} color="bg-orange-500" />
                        <StatBar label="Intelligence" value={effective.intelligence} base={cyborg.intelligence} color="bg-blue-500" />
                        <StatBar label="Wisdom" value={effective.wisdom} base={cyborg.wisdom} color="bg-purple-500" />
                        <StatBar label="Agility" value={effective.agility} base={cyborg.agility} color="bg-green-500" />
                    </div>
                </div>

                {/* Derived Combat Stats */}
                <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
                    <h3 className="text-cyan-400 font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Shield size={18} /> Combat Analytics
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <InfoBox label="HP" value={String(effective.hp)} />
                        <InfoBox label="MP" value={String(effective.mp)} />
                        <InfoBox label="Combat Rating" value={String(effective.strength * 2 + effective.intelligence * 2)} />
                        <InfoBox label="Defense" value={String(effective.constitution * 1.5 + effective.agility * 0.5)} />
                    </div>
                </div>

                <div className="mt-4 p-4 bg-slate-950 rounded border border-slate-800 text-xs text-slate-500 leading-relaxed font-mono">
                    &gt; UNIT: {cyborg.name}<br />
                    &gt; TIER: {cyborg.parts_tier} (Parts) / {cyborg.genetic_tier} (Genetic)<br />
                    &gt; STATUS: OPERATIONAL
                </div>
            </div>
        </div>
    );
}

function InfoBox({ label, value }: { label: string, value: string }) {
    return (
        <div className="bg-slate-950 p-4 rounded border border-slate-800 flex flex-col items-center justify-center text-center">
            <span className="text-slate-500 text-xs uppercase font-bold mb-1">{label}</span>
            <span className="text-xl font-bold font-mono text-white">{value}</span>
        </div>
    );
}
