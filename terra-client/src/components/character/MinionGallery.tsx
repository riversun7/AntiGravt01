import { useState } from "react";
import { MinionData, MinionType } from "@/types/character";
import MinionCard from "./MinionCard";
import { Plus, Filter } from "lucide-react";
import { motion } from "framer-motion";

interface MinionGalleryProps {
    minions: MinionData[];
    onMinionClick: (minion: MinionData) => void;
    onAddMinion: () => void;
    onRestMinion: (id: number) => void;
}

/**
 * @file MinionGallery.tsx
 * @description 보유한 미니언 목록을 그리드 형태로 보여주는 갤러리 컴포넌트
 * @role 미니언 목록 필터링(종족별), 새 미니언 생산 버튼 제공, 빈 상태 처리
 * @dependencies react, framer-motion, lucide-react
 * @status Active
 * 
 * @analysis
 * - 단순 목록 나열이 아닌 필터링 기능과 시각적 피드백(Framer Motion)이 결합된 갤러리 형태.
 * - 목록이 비었을 때(또는 필터 결과가 없을 때)에 대한 안내 UI가 잘 구현되어 있음.
 * - `MinionCard` 컴포넌트를 사용하여 개별 항목을 렌더링.
 */
export default function MinionGallery({ minions, onMinionClick, onAddMinion, onRestMinion }: MinionGalleryProps) {
    const [filter, setFilter] = useState<'all' | MinionType>('all');

    const filteredMinions = minions.filter(m => filter === 'all' || m.type === filter);

    return (
        <div className="space-y-8">
            {/* Toolbar */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto">
                    <Filter size={16} className="text-slate-500 mr-2 flex-shrink-0" />
                    <FilterButton active={filter === 'all'} onClick={() => setFilter('all')} label="전체 (All)" />
                    <FilterButton active={filter === 'human'} onClick={() => setFilter('human')} label="인간형" />
                    <FilterButton active={filter === 'android'} onClick={() => setFilter('android')} label="안드로이드" />
                    <FilterButton active={filter === 'creature'} onClick={() => setFilter('creature')} label="크리처" />
                </div>

                <button
                    onClick={onAddMinion}
                    className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white px-6 py-2 rounded-lg font-bold uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(34,211,238,0.3)] hover:shadow-[0_0_25px_rgba(34,211,238,0.5)] w-full md:w-auto justify-center"
                >
                    <Plus size={18} /> 미니언 생산 (Produce)
                </button>
            </div>

            {/* Grid */}
            {filteredMinions.length === 0 ? (
                <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-500 bg-slate-900/20 rounded-3xl border border-slate-800/50 border-dashed">
                    <p className="mb-4">조건에 맞는 미니언이 없습니다.</p>
                    {filter !== 'all' && (
                        <button onClick={() => setFilter('all')} className="text-cyan-400 hover:underline">필터 초기화</button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {filteredMinions.map(minion => (
                        <MinionCard
                            key={minion.id}
                            minion={minion}
                            onClick={() => onMinionClick(minion)}
                            onRest={onRestMinion}
                        />
                    ))}

                    {/* Add Button Card (Optional) */}
                    <motion.div
                        whileHover={{ y: -5 }}
                        onClick={onAddMinion}
                        className="bg-slate-900/30 border border-slate-800 border-dashed rounded-xl flex flex-col items-center justify-center h-full min-h-[300px] cursor-pointer hover:border-cyan-500/50 hover:bg-slate-900/50 transition-all group"
                    >
                        <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4 group-hover:bg-cyan-900/30 group-hover:text-cyan-400 transition-colors">
                            <Plus size={32} />
                        </div>
                        <span className="text-slate-500 font-bold uppercase tracking-wider group-hover:text-cyan-300">신규 생산</span>
                    </motion.div>
                </div>
            )}
        </div>
    );
}

function FilterButton({ active, onClick, label }: { active: boolean, onClick: () => void, label: string }) {
    return (
        <button
            onClick={onClick}
            className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${active
                ? "bg-cyan-950 text-cyan-400 border border-cyan-500/50"
                : "bg-slate-950 text-slate-500 border border-slate-800 hover:text-slate-300 hover:border-slate-600"
                }`}
        >
            {label}
        </button>
    );
}
