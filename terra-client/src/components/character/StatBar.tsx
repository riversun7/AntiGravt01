import { motion } from "framer-motion";

interface StatBarProps {
    label: string;
    value: number;
    base: number;
    max?: number; // Added max for flexibility
    color?: string;
}

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
