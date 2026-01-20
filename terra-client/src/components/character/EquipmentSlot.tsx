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

/**
 * @file EquipmentSlot.tsx
 * @description 장비 슬롯 렌더링 컴포넌트
 * @role 장착된 아이템 아이콘 표시, 빈 슬롯 표시, 클릭 이벤트 처리
 * @dependencies react, lucide-react
 * @status Active
 * 
 * @analysis
 * - 아이템이 없을 경우 Lucide 아이콘(Box)으로 빈 상태를 표시.
 * - `align` prop을 통해 텍스트 위치(좌/우/중앙)를 유연하게 조정 가능하여 인체 모형 주변 배치에 적합.
 * - 아이템 존재 여부에 따라 시각적 스타일(테두리, 그림자 등)이 동적으로 변경됨.
 */
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
