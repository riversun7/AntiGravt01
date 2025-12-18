import { useState } from "react";
import { Hammer, X, Zap, Box, Lock } from "lucide-react";

interface BuildingOption {
    type: string;
    name: string;
    cost: { gold: number; gem: number };
    desc: string;
    icon: React.ReactNode;
}

const BUILDINGS: BuildingOption[] = [
    { type: 'HOUSE', name: 'Habitat Module', cost: { gold: 100, gem: 0 }, desc: 'Provides living space for units.', icon: <Box size={24} className="text-blue-400" /> },
    { type: 'FACTORY', name: 'Matter Fabricator', cost: { gold: 500, gem: 0 }, desc: 'Produces basic refined materials.', icon: <Zap size={24} className="text-orange-400" /> },
    { type: 'MINE', name: 'Auto-Miner', cost: { gold: 300, gem: 0 }, desc: 'Extracts resources from the ground.', icon: <Hammer size={24} className="text-gray-400" /> },
    { type: 'TURRET', name: 'Defense Turret', cost: { gold: 200, gem: 0 }, desc: 'Automated defense system.', icon: <Lock size={24} className="text-red-400" /> }
];

interface BuildMenuProps {
    onClose: () => void;
    onBuild: (type: string) => void;
    x: number;
    y: number;
    resources: { gold: number, gem: number };
}

export default function BuildMenu({ onClose, onBuild, x, y, resources }: BuildMenuProps) {
    const [selected, setSelected] = useState<string | null>(null);

    const handleConstruct = () => {
        if (selected) onBuild(selected);
    };

    return (
        <div className="absolute inset-0 bg-black/90 z-50 flex flex-col p-4 animate-in fade-in duration-200">
            <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-2">
                <div>
                    <h3 className="text-lg font-bold text-cyan-400 flex items-center gap-2">
                        <Hammer size={18} /> CONSTRUCT
                    </h3>
                    <p className="text-xs text-gray-500">Sector {x}, {y}</p>
                </div>
                <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2">
                {BUILDINGS.map(b => {
                    const canAfford = resources.gold >= b.cost.gold && resources.gem >= b.cost.gem;
                    const isSelected = selected === b.type;

                    return (
                        <div
                            key={b.type}
                            onClick={() => setSelected(b.type)}
                            className={`
                                p-3 rounded border cursor-pointer flex items-center gap-3 transition-all
                                ${isSelected ? 'bg-cyan-900/40 border-cyan-500 ring-1 ring-cyan-400' : 'bg-gray-800/50 border-gray-700 hover:bg-gray-700'}
                                ${!canAfford ? 'opacity-50 grayscale' : ''}
                            `}
                        >
                            <div className="p-2 bg-black rounded shadow">{b.icon}</div>
                            <div className="flex-1">
                                <h4 className={`font-bold text-sm ${isSelected ? 'text-white' : 'text-gray-300'}`}>{b.name}</h4>
                                <div className="text-xs text-gray-400 flex gap-3 mt-1">
                                    <span className={resources.gold < b.cost.gold ? 'text-red-500' : 'text-yellow-500'}>{b.cost.gold} G</span>
                                    {b.cost.gem > 0 && <span className={resources.gem < b.cost.gem ? 'text-red-500' : 'text-cyan-400'}>{b.cost.gem} 💎</span>}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <button
                disabled={!selected}
                onClick={handleConstruct}
                className="mt-4 w-full py-3 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-bold rounded shadow-[0_0_15px_rgba(8,145,178,0.4)] transition-all"
            >
                INITIALIZE BUILD
            </button>
        </div>
    );
}
