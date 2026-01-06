import { Box } from "lucide-react";
import ItemIcon from "@/components/ItemIcon";
import { Equipment } from "@/types/character";

interface EquipmentSlotProps {
    slot: string;
    label: string;
    item?: Equipment;
    align?: 'left' | 'right' | 'center';
    onClick: () => void;
}

export default function EquipmentSlot({ slot, label, item, align = 'left', onClick }: EquipmentSlotProps) {
    return (
        <div
            className={`group relative flex items-center gap-4 ${align === 'right' ? 'flex-row-reverse text-right' : ''} ${align === 'center' ? 'flex-col text-center' : ''}`}
            onClick={onClick}
        >
            <div className={`w-16 h-16 rounded-xl border-2 flex items-center justify-center transition-all cursor-pointer shadow-lg overflow-hidden relative ${item ? "bg-slate-800 border-cyan-500 text-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.3)]" : "bg-slate-900/50 border-slate-700 text-slate-600 hover:border-slate-500 hover:bg-slate-800"}`}>
                {item ? (
                    <ItemIcon item={item} size="md" className="w-full h-full opacity-80" />
                ) : (
                    <Box size={24} className="opacity-50" />
                )}
                {item && <div className="absolute inset-0 bg-cyan-500/10" />}
            </div>
            <div className={align === 'center' ? 'mt-2' : ''}>
                <div className="text-xs text-slate-500 font-bold uppercase tracking-widest group-hover:text-cyan-400 transition-colors">{label}</div>
                <div className="text-sm font-bold truncate max-w-[120px] text-white">
                    {item ? item.name : "EMPTY"}
                </div>
            </div>
        </div>
    );
}
