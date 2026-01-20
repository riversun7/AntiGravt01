import { motion } from "framer-motion";

interface StatBarProps {
    label: string;
    value: number;
    base: number;
    max?: number; // Added max for flexibility
    color?: string;
}

/**
 * @file StatBar.tsx
 * @description 캐릭터 스탯(능력치)을 막대 그래프 형태로 표시하는 컴포넌트
 * @role 기본 스탯과 장비로 인한 추가 보너스 스탯을 구분하여 시각화
 * @dependencies react, framer-motion
 * @status Active
 * 
 * @analysis
 * - Framer Motion을 사용하여 스탯 변화 시 애니메이션 효과 제공.
 * - 기본 스탯(회색) 위에 보너스 스탯(컬러)을 덧그리는 방식으로 직관적인 비교 가능.
 * - 최대값(max)을 props로 받아 비율을 계산하므로 다양한 범위의 스탯에 재사용 가능.
 */
export default function StatBar({ label, value, base, max = 20, color = "bg-cyan-500" }: StatBarProps) {
    const bonus = value - base;
    const percentage = Math.min((base / max) * 100, 100);
    const bonusPercentage = Math.min((bonus / max) * 100, 100);

    return (
        <div className="flex items-center gap-4">
            <span className="w-24 text-sm font-bold text-slate-400 uppercase text-right">{label}</span>
            <div className="flex-1 h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800 relative flex">
                {/* Base Stat */}
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className={`h-full bg-slate-600 shadow-[0_0_10px_rgba(255,255,255,0.2)]`}
                />
                {/* Bonus Stat */}
                {bonus > 0 && (
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${bonusPercentage}%` }}
                        transition={{ duration: 1, delay: 0.5, ease: "easeOut" }}
                        className={`h-full ${color} shadow-[0_0_10px_currentColor]`}
                    />
                )}
            </div>
            <span className="w-12 text-sm font-mono font-bold text-slate-300 text-right flex justify-end gap-1">
                <span>{value}</span>
                {bonus > 0 && <span className="text-cyan-400 text-[10px] self-start">+{bonus}</span>}
            </span>
        </div>
    );
}
