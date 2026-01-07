import { useState } from "react";
import { MinionType } from "@/types/character";
import { X, Dna, Cpu, PawPrint, Play } from "lucide-react";
import { motion } from "framer-motion";

interface MinionProductionModalProps {
    onClose: () => void;
    onProduce: (type: MinionType, name: string, species?: string) => void;
}

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
                        System Production
                    </h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-white"><X size={24} /></button>
                </div>

                {/* Tabs / Facility Selection */}
                <div className="grid grid-cols-3 border-b border-slate-800">
                    <SelectionTab
                        active={type === 'human'}
                        onClick={() => setType('human')}
                        icon={<Dna size={20} />}
                        label="Incubator"
                        sub="Humanoids"
                    />
                    <SelectionTab
                        active={type === 'android'}
                        onClick={() => setType('android')}
                        icon={<Cpu size={20} />}
                        label="Factory"
                        sub="Androids"
                    />
                    <SelectionTab
                        active={type === 'creature'}
                        onClick={() => setType('creature')}
                        icon={<PawPrint size={20} />}
                        label="Taming"
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
                                {type === 'human' && "Genetic Engineering"}
                                {type === 'android' && "Robotics Assembly"}
                                {type === 'creature' && "Wild Creature Taming"}
                            </h3>
                            <p className="text-sm text-slate-500 leading-relaxed">
                                {type === 'human' && "Grow a human subject from selected genetic material. Subject requires maturation period but offers high potential growth."}
                                {type === 'android' && "Assemble a mechanical unit. Immediately operational with high durability, but requires battery power and fuel."}
                                {type === 'creature' && "Capture or breed a creature. High variation in traits and specialized abilities."}
                            </p>
                        </div>
                    </div>

                    {/* Inputs */}
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs uppercase font-bold text-slate-500 mb-2">Designation / Name</label>
                            <input
                                type="text"
                                className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-white focus:border-cyan-500 focus:outline-none transition-colors"
                                placeholder="Enter unit identifier..."
                                value={name}
                                onChange={e => setName(e.target.value)}
                            />
                        </div>
                        {type === 'creature' && (
                            <div>
                                <label className="block text-xs uppercase font-bold text-slate-500 mb-2">Target Species</label>
                                <select
                                    className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-white focus:border-cyan-500 focus:outline-none transition-colors"
                                    value={species}
                                    onChange={e => setSpecies(e.target.value)}
                                >
                                    <option value="">Random / Standard</option>
                                    <option value="Wolf">Cyber Wolf</option>
                                    <option value="Dragon">Drake</option>
                                    <option value="Bear">Armored Bear</option>
                                </select>
                            </div>
                        )}
                        {type === 'human' && (
                            <div>
                                <label className="block text-xs uppercase font-bold text-slate-500 mb-2">Genetic Template</label>
                                <select
                                    className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-white focus:border-cyan-500 focus:outline-none transition-colors"
                                    defaultValue="Soldier"
                                >
                                    <option>Soldier Type (Str/Con)</option>
                                    <option>Scientist Type (Int/Wis)</option>
                                    <option>Worker Type (Str/Dex)</option>
                                </select>
                            </div>
                        )}
                    </div>

                    <div className="flex-1" />

                    {/* Footer Actions */}
                    <div className="flex justify-end gap-4 mt-4">
                        <button onClick={onClose} className="px-6 py-3 text-slate-400 font-bold hover:text-white uppercase text-sm">Cancel</button>
                        <button
                            onClick={handleSubmit}
                            className="bg-cyan-600 hover:bg-cyan-500 text-white px-8 py-3 rounded-lg font-bold uppercase tracking-wider flex items-center gap-2 shadow-[0_0_20px_rgba(34,211,238,0.3)] hover:shadow-[0_0_30px_rgba(34,211,238,0.5)] transition-all"
                        >
                            <Play size={16} fill="currentColor" /> Initiate Process
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
