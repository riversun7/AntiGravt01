"use client";

import { useState } from "react";
import { User, Layers, Box, Users } from "lucide-react";
import { motion } from "framer-motion";
import SystemMenu from "@/components/SystemMenu";
import { CharacterProvider, useCharacter } from "@/context/CharacterContext";
import CyborgProfile from "@/components/character/CyborgProfile";
import MinionGallery from "@/components/character/MinionGallery";
import MinionDetailModal from "@/components/character/MinionDetailModal";
import MinionProductionModal from "@/components/character/MinionProductionModal";
import ItemIcon from "@/components/ItemIcon";
import { Item } from "@/types/index"; // Assuming global Item type exists or reuse local definition
import { MinionData } from "@/types/character";

// Re-define local Item interface if global one is missing or inconsistent
interface LocalItem {
    id: number;
    name: string;
    code: string;
    description: string;
    type: 'RESOURCE' | 'EQUIPMENT';
    slot?: string;
    stats?: string;
    quantity?: number;
    rarity?: string;
    image?: string;
}

function CharacterPageContent() {
    const { cyborg, cyborgEquipment, minions, loading, produceMinion, restMinion, chargeMinion, feedMinion } = useCharacter();
    const [activeTab, setActiveTab] = useState<'cyborg' | 'minions' | 'inventory'>('cyborg');
    const [selectedMinion, setSelectedMinion] = useState<MinionData | null>(null);
    const [showProduction, setShowProduction] = useState(false);

    // Inventory State (Loaded separately or via context? Existing page fetched it.)
    // We should probably move inventory to context or keep here.
    // Given scope, I'll keep inventory fetching here for now but use new Item types using 'any' fallback if needed.
    const [inventory, setInventory] = useState<LocalItem[]>([]);

    // Load inventory
    const fetchInventory = async () => {
        const userId = localStorage.getItem("terra_user_id");
        if (!userId) return;
        try {
            const res = await fetch(`http://localhost:3001/api/inventory/${userId}`);
            if (res.ok) {
                const data = await res.json();
                setInventory(data);
            }
        } catch (e) { console.error(e); }
    };

    // Initial fetch
    useState(() => {
        fetchInventory();
    });

    if (loading) return <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">Loading Data...</div>;
    if (!cyborg) return <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">User not initialized.</div>;

    return (
        <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-cyan-500/30">
            {/* Background Effects */}
            <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(17,24,39,1),rgba(2,6,23,1))] -z-20" />
            <div className="fixed inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none -z-10" />

            <div className="absolute top-4 left-4 z-50">
                <SystemMenu activePage="character" />
            </div>

            <main className="container mx-auto px-4 py-20 max-w-7xl">
                {/* Header */}
                <header className="mb-10 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div>
                        <div className="flex items-center gap-3 text-cyan-400 mb-2">
                            <User size={20} />
                            <span className="text-xs font-bold tracking-widest uppercase">Character System</span>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-bold uppercase tracking-tight text-white mb-2">
                            {cyborg.name}
                        </h1>
                        <p className="text-slate-400 max-w-lg">
                            Level <span className="text-cyan-300 font-bold">{cyborg.level}</span>
                        </p>
                    </div>

                    <div className="flex bg-slate-900/50 p-1 rounded-lg border border-slate-800">
                        <TabButton active={activeTab === 'cyborg'} onClick={() => setActiveTab('cyborg')} icon={<User size={18} />} label="Cyborg" />
                        <TabButton active={activeTab === 'minions'} onClick={() => setActiveTab('minions')} icon={<Users size={18} />} label="Minions" />
                        <TabButton active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} icon={<Box size={18} />} label="Inventory" />
                    </div>
                </header>

                {/* Content */}
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                >
                    {activeTab === 'cyborg' && (
                        <CyborgProfile
                            cyborg={cyborg}
                            equipment={cyborgEquipment}
                            onSlotClick={(slot) => console.log("Unlock equipment selection for", slot)}
                        />
                    )}
                    {activeTab === 'minions' && (
                        <MinionGallery
                            minions={minions}
                            onMinionClick={setSelectedMinion}
                            onAddMinion={() => setShowProduction(true)}
                            onRestMinion={restMinion}
                        />
                    )}
                    {activeTab === 'inventory' && (
                        <InventoryGrid inventory={inventory} />
                    )}
                </motion.div>
            </main>

            {/* Modals */}
            {selectedMinion && (
                <MinionDetailModal
                    minion={selectedMinion}
                    equipment={[]} // TODO: Fetch specific minion equipment
                    onClose={() => setSelectedMinion(null)}
                    onRest={restMinion}
                    onCharge={chargeMinion}
                    onFeed={feedMinion}
                />
            )}

            {showProduction && (
                <MinionProductionModal
                    onClose={() => setShowProduction(false)}
                    onProduce={async (type, name, species) => {
                        await produceMinion(type, name, species);
                        setShowProduction(false);
                    }}
                />
            )}
        </div>
    );
}

// Wrapper for Context
export default function CharacterPage() {
    return (
        <CharacterProvider>
            <CharacterPageContent />
        </CharacterProvider>
    );
}

// Reuse TabButton
function TabButton({ active, onClick, icon, label }: any) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-2 px-6 py-2.5 rounded text-sm font-bold uppercase tracking-wider transition-all ${active
                    ? "bg-cyan-950 text-cyan-400 shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                }`}
        >
            {icon}
            <span className="hidden md:inline">{label}</span>
        </button>
    );
}

// Reuse Module/Inventory Grid
function InventoryGrid({ inventory }: { inventory: LocalItem[] }) {
    if (inventory.length === 0) {
        return <div className="text-center p-12 text-slate-500">No items in inventory.</div>;
    }
    return (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
            {inventory.map((item, i) => (
                <div key={i} className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col items-center gap-2">
                    <ItemIcon item={item} size="md" className="rounded-lg" />
                    <span className="text-sm font-bold text-slate-300 truncate w-full text-center">{item.name}</span>
                    <span className="text-[10px] text-slate-500">{item.type}</span>
                </div>
            ))}
        </div>
    );
}