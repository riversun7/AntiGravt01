import { useState } from "react";
import { MinionType } from "@/types/character";
import { X, Dna, Cpu, PawPrint, Play } from "lucide-react";
import { motion } from "framer-motion";

interface MinionProductionModalProps {
    onClose: () => void;
    onProduce: (type: MinionType, name: string, species?: string) => void;
}

/**
 * @file MinionProductionModal.tsx
 * @description 새로운 미니언(유닛)을 생산하기 위한 모달 인터페이스
 * @role 미니언 유형(인간형, 안드로이드, 크리처) 선택, 이름 및 옵션 설정, 생산 요청
 * @dependencies react, framer-motion, lucide-react
 * @status Active
 * 
 * @analysis
 * - 3가지 유형(Human, Android, Creature)에 따른 동적 UI 제공.
 * - 모달 외부 클릭 시 닫기 핸들러가 구현되어 있으나, 내부 클릭 전파 방지(stopPropagation)도 잘 처리됨.
 * - 생산 요청 시 유효성 검사(이름 필수)가 포함됨.
 * - 향후 자원 소모량 표시나 생산 소요 시간 예측 기능이 추가되면 UX가 향상될 것임.
 */
export default function MinionProductionModal({ onClose, onProduce }: MinionProductionModalProps) {
    const [type, setType] = useState<MinionType>('human');
    const [name, setName] = useState("");
    const [species, setSpecies] = useState(""); // For creature/human variant

    const handleSubmit = () => {
        if (!name.trim()) {
            alert("Please enter a name.");
            return;
        }
        onProduce(type, name, species);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="bg-slate-900 border border-cyan-500/30 p-0 rounded-2xl max-w-2xl w-full relative shadow-[0_0_50px_rgba(34,211,238,0.15)] overflow-hidden" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
                    <h2 className="text-xl font-bold text-white uppercase tracking-widest flex items-center gap-2">
                        시스템 생산 (System Production)
                    </h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-white"><X size={24} /></button>
                </div>

                {/* Tabs / Facility Selection */}
                <div className="grid grid-cols-3 border-b border-slate-800">
                    <SelectionTab
                        active={type === 'human'}
                        onClick={() => setType('human')}
                        icon={<Dna size={20} />}
                        label="배양실 (Incubator)"
                        sub="Humanoids"
                    />
                    <SelectionTab
                        active={type === 'android'}
                        onClick={() => setType('android')}
                        icon={<Cpu size={20} />}
                        label="공장 (Factory)"
                        sub="Androids"
                    />
                    <SelectionTab
                        active={type === 'creature'}
                        onClick={() => setType('creature')}
                        icon={<PawPrint size={20} />}
                        label="조련소 (Taming)"
                        sub="Creatures"
                    />
                </div>

                {/* Content Form */}
                <div className="p-8 bg-slate-900/50 min-h-[300px] flex flex-col gap-6">
                    {/* Facility Info */}
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-start gap-4">
                        <div className={`p-3 rounded-lg ${type === 'human' ? 'bg-emerald-900/20 text-emerald-400' : type === 'android' ? 'bg-cyan-900/20 text-cyan-400' : 'bg-orange-900/20 text-orange-400'}`}>
                            {type === 'human' && <Dna size={24} />}
                            {type === 'android' && <Cpu size={24} />}
                            {type === 'creature' && <PawPrint size={24} />}
                        </div>
                        <div>
                            <h3 className="text-white font-bold text-lg mb-1">
                                {type === 'human' && "유전 공학 (Genetic Engineering)"}
                                {type === 'android' && "로봇 조립 (Robotics Assembly)"}
                                {type === 'creature' && "야생 생물 조련 (Wild Creature Taming)"}
                            </h3>
                            <p className="text-sm text-slate-500 leading-relaxed">
                                {type === 'human' && "선택된 유전자를 바탕으로 인간형 개체를 배양합니다. 성장 시간이 필요하지만 높은 잠재력을 가집니다."}
                                {type === 'android' && "기계 유닛을 즉시 조립합니다. 높은 내구도와 즉시 전력화가 가능하지만 배터리 충전이 필요합니다."}
                                {type === 'creature' && "야생 생물을 포획하거나 사육합니다. 다양한 특성과 특수 능력을 보유할 수 있습니다."}
                            </p>
                        </div>
                    </div>

                    {/* Inputs */}
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs uppercase font-bold text-slate-500 mb-2">식별명 / 이름 (Designation / Name)</label>
                            <input
                                type="text"
                                className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-white focus:border-cyan-500 focus:outline-none transition-colors"
                                placeholder="유닛 식별명을 입력하세요..."
                                value={name}
                                onChange={e => setName(e.target.value)}
                            />
                        </div>
                        {type === 'creature' && (
                            <div>
                                <label className="block text-xs uppercase font-bold text-slate-500 mb-2">목표 종 (Target Species)</label>
                                <select
                                    className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-white focus:border-cyan-500 focus:outline-none transition-colors"
                                    value={species}
                                    onChange={e => setSpecies(e.target.value)}
                                >
                                    <option value="">무작위 / 표준 (Random / Standard)</option>
                                    <option value="Wolf">사이버 울프 (Cyber Wolf)</option>
                                    <option value="Dragon">드레이크 (Drake)</option>
                                    <option value="Bear">장갑 곰 (Armored Bear)</option>
                                </select>
                            </div>
                        )}
                        {type === 'human' && (
                            <div>
                                <label className="block text-xs uppercase font-bold text-slate-500 mb-2">유전자 템플릿 (Genetic Template)</label>
                                <select
                                    className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-white focus:border-cyan-500 focus:outline-none transition-colors"
                                    defaultValue="Soldier"
                                >
                                    <option>군인형 (Soldier Type - 힘/체력)</option>
                                    <option>과학자형 (Scientist Type - 지능/지혜)</option>
                                    <option>노동자형 (Worker Type - 힘/민첩)</option>
                                </select>
                            </div>
                        )}
                    </div>

                    <div className="flex-1" />

                    {/* Footer Actions */}
                    <div className="flex justify-end gap-4 mt-4">
                        <button onClick={onClose} className="px-6 py-3 text-slate-400 font-bold hover:text-white uppercase text-sm">취소</button>
                        <button
                            onClick={handleSubmit}
                            className="bg-cyan-600 hover:bg-cyan-500 text-white px-8 py-3 rounded-lg font-bold uppercase tracking-wider flex items-center gap-2 shadow-[0_0_20px_rgba(34,211,238,0.3)] hover:shadow-[0_0_30px_rgba(34,211,238,0.5)] transition-all"
                        >
                            <Play size={16} fill="currentColor" /> 생산 시작 (Initiate)
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

interface SelectionTabProps {
    active: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
    sub: string;
}

function SelectionTab({ active, onClick, icon, label, sub }: SelectionTabProps) {
    return (
        <button
            onClick={onClick}
            className={`py-6 flex flex-col items-center justify-center gap-2 border-b-2 transition-all group ${active
                ? "border-cyan-500 bg-cyan-950/20"
                : "border-transparent bg-slate-950/30 hover:bg-slate-900"
                }`}
        >
            <div className={`transition-colors ${active ? "text-cyan-400" : "text-slate-600 group-hover:text-slate-400"}`}>
                {icon}
            </div>
            <div className="text-center">
                <div className={`text-sm font-bold uppercase ${active ? "text-white" : "text-slate-500 group-hover:text-slate-300"}`}>{label}</div>
                <div className="text-[10px] text-slate-600 uppercase tracking-widest">{sub}</div>
            </div>
        </button>
    )
}
