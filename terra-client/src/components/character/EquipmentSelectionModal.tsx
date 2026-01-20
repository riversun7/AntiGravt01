import { motion, AnimatePresence } from "framer-motion";
import { X, Shield, ChevronRight, Check } from "lucide-react";
import ItemIcon from "@/components/ItemIcon";
import { Item } from "@/types/index";

interface EquipmentSelectionModalProps {
    slot: string;
    currentEquip?: Item | null;
    inventory: any[]; // Using any because of LocalItem/Item type mismatch, can refine later
    onClose: () => void;
    onEquip: (item: any) => void;
    onUnequip: () => void;
}

/**
 * @file EquipmentSelectionModal.tsx
 * @description 특정 슬롯에 장착할 장비를 선택하는 모달
 * @role 인벤토리에서 호환되는 아이템 필터링 및 목록 표시, 장착/해제 기능 제공
 * @dependencies react, framer-motion, lucide-react
 * @status Active
 * 
 * @analysis
 * - 인벤토리 내의 수많은 아이템 중 현재 슬롯(slot)에 맞는 아이템만 필터링하여 보여주는 로직이 핵심.
 * - 현재 장착 중인 아이템과 인벤토리의 아이템을 구분하여 표시.
 * - 모바일 환경에서도 사용 가능하도록 max-height 및 overflow 설정이 되어 있음.
 */
export default function EquipmentSelectionModal({ slot, currentEquip, inventory, onClose, onEquip, onUnequip }: EquipmentSelectionModalProps) {
    // Filter inventory for this slot
    // Matches if type matches the slot requirement (e.g. HEAD, BODY)
    // Assuming backend returns 'slot' property on items
    const compatibleItems = inventory.filter(item =>
        (item.type === 'EQUIPMENT' && item.slot === slot) ||
        (item.code && item.code.includes(slot)) // Fallback logic if slot property missing
    );

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    className="bg-slate-900 border border-cyan-500/30 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="p-6 border-b border-white/10 flex justify-between items-center bg-slate-950/50">
                        <div>
                            <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-widest mb-1">
                                <Shield size={14} />
                                시스템 설정 (System Configuration)
                            </div>
                            <h2 className="text-2xl font-bold text-white">{slot} 모듈 선택</h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white"
                        >
                            <X size={24} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">

                        {/* Currently Equipped */}
                        <div>
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">현재 장착 모듈 (Current Module)</h3>
                            {currentEquip ? (
                                <div className="bg-slate-800/50 border border-cyan-500/50 p-4 rounded-xl flex items-center gap-4">
                                    <ItemIcon item={currentEquip} size="lg" className="rounded-lg shadow-lg shadow-cyan-500/20" />
                                    <div className="flex-1">
                                        <div className="font-bold text-lg text-cyan-100">{currentEquip.name}</div>
                                        <div className="text-cyan-400/70 text-sm font-mono">{currentEquip.code}</div>
                                    </div>
                                    <button
                                        onClick={onUnequip}
                                        className="px-4 py-2 bg-red-900/20 hover:bg-red-900/40 border border-red-800 text-red-400 rounded-lg text-sm font-bold transition-all"
                                    >
                                        해제 (UNEQUIP)
                                    </button>
                                </div>
                            ) : (
                                <div className="p-4 border border-dashed border-slate-700 rounded-xl text-center text-slate-500 text-sm">
                                    이 슬롯에 장착된 모듈이 없습니다.
                                </div>
                            )}
                        </div>

                        {/* Inventory List */}
                        <div>
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">장착 가능 모듈 ({compatibleItems.length})</h3>

                            {compatibleItems.length === 0 ? (
                                <div className="text-center py-12 text-slate-600">
                                    인벤토리에 호환되는 {slot} 모듈이 없습니다.
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-3">
                                    {compatibleItems.map((item) => (
                                        <button
                                            key={item.id}
                                            onClick={() => onEquip(item)}
                                            className="group flex items-center gap-4 p-3 bg-slate-900/50 hover:bg-slate-800 border border-white/5 hover:border-cyan-500/50 rounded-xl transition-all text-left"
                                        >
                                            <ItemIcon item={item} size="md" className="group-hover:scale-110 transition-transform" />
                                            <div className="flex-1 min-w-0">
                                                <div className="font-bold text-slate-200 group-hover:text-cyan-300 transition-colors truncate">{item.name}</div>
                                                <div className="text-xs text-slate-500 truncate">{item.description}</div>
                                            </div>

                                            {/* Stats Preview (Simple) */}
                                            {item.stats && (
                                                <div className="hidden sm:flex flex-wrap gap-1 max-w-[150px] justify-end">
                                                    {(() => {
                                                        try {
                                                            const stats = typeof item.stats === 'string' ? JSON.parse(item.stats) : item.stats;
                                                            return Object.entries(stats).slice(0, 2).map(([k, v]) => (
                                                                <span key={k} className="px-1.5 py-0.5 bg-slate-950 rounded text-[10px] text-cyan-500 font-mono border border-slate-800 uppercase">
                                                                    {k.substring(0, 3)} +{String(v)}
                                                                </span>
                                                            ));
                                                        } catch (e) { return null; }
                                                    })()}
                                                </div>
                                            )}

                                            <div className="p-2 text-slate-600 group-hover:text-cyan-400">
                                                <ChevronRight size={20} />
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
