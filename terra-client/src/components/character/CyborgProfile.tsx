import { motion } from "framer-motion";
import { Cpu, Shield } from "lucide-react";
import { CyborgData, Equipment, CharacterStats } from "@/types/character";
import StatBar from "./StatBar";
import EquipmentSlot from "./EquipmentSlot";

/**
 * @file CyborgProfile.tsx
 * @description 사이보그(플레이어 캐릭터)의 상태와 장비를 시각화하는 메인 프로필 컴포넌트
 * @role 캐릭터 아바타(DiceBear), 장착 장비 슬롯, 주요 스탯(근력, 민첩 등) 및 전투 능력치 표시
 * @dependencies react, framer-motion, lucide-react
 * @status Active
 * 
 * @analysis
 * - 중앙 아바타와 양쪽의 장비 슬롯 배치가 시각적으로 균형을 이룸.
 * - 장비에 부여된 추가 스탯(JSON 파싱)을 기본 스탯과 합산하여 '유효 스탯(effective)'을 계산하는 로직 포함.
 * - 모바일 화면에서는 그리드 레이이아웃(grid-cols-1)으로 자동 조정됨.
 */
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
                <div className="absolute left-6 top-1/2 -translate-y-1/2 flex flex-col gap-8 z-20">
                    <EquipmentSlot slot="HEAD" label="헤드 센서 (HEAD)" item={getEquip('HEAD')} align="left" onClick={() => onSlotClick('HEAD')} />
                    <EquipmentSlot slot="BODY" label="차체 (CHASSIS)" item={getEquip('BODY')} align="left" onClick={() => onSlotClick('BODY')} />
                    <EquipmentSlot slot="ARMS" label="매니퓰레이터 (ARMS)" item={getEquip('ARMS')} align="left" onClick={() => onSlotClick('ARMS')} />
                </div>

                <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col gap-8 z-20">
                    <EquipmentSlot slot="LEGS" label="구동부 (LEGS)" item={getEquip('LEGS')} align="right" onClick={() => onSlotClick('LEGS')} />
                    <EquipmentSlot slot="CORE" label="동력원 (CORE)" item={getEquip('CORE')} align="right" onClick={() => onSlotClick('CORE')} />
                    <EquipmentSlot slot="WEAPON" label="무장 (WEAPON)" item={getEquip('WEAPON')} align="right" onClick={() => onSlotClick('WEAPON')} />
                </div>
            </div>

            {/* Right: Stats & Info */}
            <div className="lg:col-span-2 space-y-6">
                {/* Stats Panel */}
                <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
                    <h3 className="text-cyan-400 font-bold uppercase tracking-widest mb-6 flex items-center gap-2">
                        <Cpu size={18} /> 핵심 사양 (Core Specifications)
                    </h3>
                    <div className="space-y-4">
                        <StatBar label="근력 (STR)" value={effective.strength} base={cyborg.strength} color="bg-red-500" />
                        <StatBar label="민첩 (DEX)" value={effective.dexterity} base={cyborg.dexterity} color="bg-yellow-500" />
                        <StatBar label="체력 (CON)" value={effective.constitution} base={cyborg.constitution} color="bg-orange-500" />
                        <StatBar label="지능 (INT)" value={effective.intelligence} base={cyborg.intelligence} color="bg-blue-500" />
                        <StatBar label="지혜 (WIS)" value={effective.wisdom} base={cyborg.wisdom} color="bg-purple-500" />
                        <StatBar label="기동성 (AGI)" value={effective.agility} base={cyborg.agility} color="bg-green-500" />
                    </div>
                </div>

                {/* Derived Combat Stats */}
                <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
                    <h3 className="text-cyan-400 font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Shield size={18} /> 전투 분석 (Combat Analytics)
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <InfoBox label="내구도 (HP)" value={String(effective.hp)} />
                        <InfoBox label="에너지 (MP)" value={String(effective.mp)} />
                        <InfoBox label="전투력 (Rating)" value={String(effective.strength * 2 + effective.intelligence * 2)} />
                        <InfoBox label="방어력 (DEF)" value={String(effective.constitution * 1.5 + effective.agility * 0.5)} />
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
