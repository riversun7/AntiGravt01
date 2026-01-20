import { MinionData, MinionType } from "@/types/character";
import { Battery, Heart, Zap, Activity, User, Bot, Skull } from "lucide-react";
import { motion } from "framer-motion";

interface MinionCardProps {
    minion: MinionData;
    onClick: () => void;
    onRest: (id: number) => void;
}

/**
 * @file MinionCard.tsx
 * @description 개별 미니언의 정보를 요약해서 보여주는 카드 컴포넌트
 * @role 미니언의 생김새(아바타), 레벨, 유형, 상태바(HP, 피로도, 배터리) 표시
 * @dependencies react, framer-motion, lucide-react, dicebear(외부 API)
 * @status Active
 * 
 * @analysis
 * - DiceBear API를 사용하여 미니언 이름 기반 아이콘(아바타)을 자동 생성하여 다양성을 시각화함.
 * - Framer Motion의 `whileHover` 효과로 인터랙티브한 느낌을 제공.
 * - 미니언 유형(Human, Android, Creature)에 따라 테마 색상(Emerald, Cyan, Orange)이 동적으로 변경됨.
 */
export default function MinionCard({ minion, onClick, onRest }: MinionCardProps) {
    const getTypeIcon = (type: MinionType) => {
        switch (type) {
            case 'human': return <User size={16} />;
            case 'android': return <Bot size={16} />;
            case 'creature': return <Skull size={16} />;
        }
    };

    const getTypeColor = (type: MinionType) => {
        switch (type) {
            case 'human': return "text-emerald-400 border-emerald-500/30 bg-emerald-950/20";
            case 'android': return "text-cyan-400 border-cyan-500/30 bg-cyan-950/20";
            case 'creature': return "text-orange-400 border-orange-500/30 bg-orange-950/20";
        }
    };

    return (
        <motion.div
            whileHover={{ y: -5, boxShadow: "0 10px 30px -10px rgba(0,0,0,0.5)" }}
            className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden cursor-pointer group"
            onClick={onClick}
        >
            {/* Header / Image Area Placeholder */}
            <div className="h-32 bg-slate-950 relative flex items-center justify-center overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={`https://api.dicebear.com/9.x/bottts/svg?seed=${minion.name}`}
                    alt={minion.name}
                    className="h-24 w-24 object-contain opacity-80 group-hover:scale-110 transition-transform"
                />

                <div className={`absolute top-2 left-2 px-2 py-1 rounded text-xs font-bold border flex items-center gap-1 uppercase ${getTypeColor(minion.type)}`}>
                    {getTypeIcon(minion.type)}
                    {minion.type}
                </div>

                <div className="absolute top-2 right-2 px-2 py-1 bg-slate-900/80 rounded text-xs font-mono text-slate-400 border border-slate-800">
                    LV.{minion.level}
                </div>
            </div>

            {/* Content */}
            <div className="p-4 space-y-3">
                <div>
                    <h3 className="text-white font-bold truncate group-hover:text-cyan-400 transition-colors">{minion.name}</h3>
                    <p className="text-slate-500 text-xs truncate capitalize">{minion.species || "Standard Unit"}</p>
                </div>

                {/* Status Bars */}
                <div className="space-y-1">
                    {/* HP */}
                    <div className="flex items-center gap-2 text-[10px] text-slate-400">
                        <Heart size={10} className="text-red-500" />
                        <div className="flex-1 h-1.5 bg-slate-950 rounded-full overflow-hidden">
                            <div className="h-full bg-red-500" style={{ width: '100%' }} />
                        </div>
                    </div>
                    {/* Fatigue */}
                    <div className="flex items-center gap-2 text-[10px] text-slate-400">
                        <Zap size={10} className="text-yellow-500" />
                        <div className="flex-1 h-1.5 bg-slate-950 rounded-full overflow-hidden">
                            <div className="h-full bg-yellow-500" style={{ width: `${minion.fatigue}%` }} />
                        </div>
                    </div>
                    {/* Battery (if Android) */}
                    {minion.type === 'android' && (
                        <div className="flex items-center gap-2 text-[10px] text-slate-400">
                            <Battery size={10} className="text-cyan-500" />
                            <div className="flex-1 h-1.5 bg-slate-950 rounded-full overflow-hidden">
                                <div className="h-full bg-cyan-500" style={{ width: `${minion.battery}%` }} />
                            </div>
                        </div>
                    )}
                </div>

                {/* Quick Actions */}
                <div className="flex gap-2 mt-4 pt-4 border-t border-slate-800">
                    <button
                        onClick={(e) => { e.stopPropagation(); onRest(minion.id); }}
                        className="flex-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs text-white rounded transition-colors flex items-center justify-center gap-1"
                    >
                        <Activity size={12} /> 휴식 (Rest)
                    </button>
                    {/* Add more actions if needed */}
                </div>
            </div>
        </motion.div>
    );
}
