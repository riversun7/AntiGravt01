"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { User, Shield, Cpu, Zap, Box, Activity, Layers, Info, X, ChevronRight, Check } from "lucide-react";
import { motion } from "framer-motion";
import SystemMenu from "@/components/SystemMenu";
import ItemIcon from "@/components/ItemIcon";

// Interfaces
interface Item {
    id: number;
    name: string;
    code: string;
    description: string;
    type: 'RESOURCE' | 'EQUIPMENT';
    slot?: string;
    stats?: string; // JSON string from DB
    quantity?: number;
}

interface Equipment {
    slot: string;
    item_id: number;
    name: string;
    code: string;
    description: string;
    stats: string;
}

interface UserData {
    id: number;
    username: string;
    role: string;
    cyborg_model: string | null;
    stats: {
        strength: number;
        agility: number;
        intelligence: number;
        wisdom: number;
        dexterity: number;
        constitution: number;
    };
    resources: {
        gold: number;
        gem: number;
    };
    equipment: Equipment[];
}

export default function CharacterPage() {
    const [user, setUser] = useState<UserData | null>(null);
    const [activeTab, setActiveTab] = useState<'overview' | 'loadout' | 'modules'>('overview');
    const [inventory, setInventory] = useState<Item[]>([]);

    // Modals
    const [selectedItem, setSelectedItem] = useState<Item | Equipment | null>(null);
    const [selectedSlot, setSelectedSlot] = useState<string | null>(null); // For equipping into a specific slot

    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const fetchUser = () => {
        const userId = localStorage.getItem("terra_user_id");
        if (!userId) {
            router.push("/login");
            return;
        }

        fetch(`http://localhost:3001/api/user/${userId}`)
            .then((res) => {
                if (!res.ok) throw new Error("Failed to fetch user");
                return res.json();
            })
            .then((data) => {
                if (!data.cyborg_model) {
                    router.push("/create-character");
                } else {
                    setUser(data);
                }
            })
            .catch((err) => {
                console.error(err);
                router.push("/login");
            });
    };

    const fetchInventory = () => {
        const userId = localStorage.getItem("terra_user_id");
        if (!userId) return;

        fetch(`http://localhost:3001/api/inventory/${userId}`)
            .then((res) => {
                if (!res.ok) throw new Error("Failed to fetch inventory");
                return res.json();
            })
            .then((data) => {
                if (Array.isArray(data)) {
                    setInventory(data);
                } else {
                    console.error("Invalid inventory data received", data);
                    setInventory([]);
                }
            })
            .catch((err) => {
                console.error("Inventory fetch error:", err);
                setInventory([]);
            });
    };

    useEffect(() => {
        fetchUser();
        fetchInventory(); // Always fetch inventory for equip logic
    }, []);

    const handleEquip = async (item: Item, slot?: string) => {
        const targetSlot = slot || item.slot;
        if (!user || !targetSlot) return;

        setLoading(true);
        try {
            const res = await fetch('http://localhost:3001/api/equipment/equip', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id, itemId: item.id, slot: targetSlot })
            });
            if (!res.ok) throw new Error(await res.text());

            // Refresh
            fetchUser();
            fetchInventory();
            setSelectedItem(null); // Close modal
            setSelectedSlot(null);
        } catch (e) {
            alert("Equip Failed: " + e);
        } finally {
            setLoading(false);
        }
    };

    const handleUnequip = async (slot: string) => {
        if (!user) return;
        setLoading(true);
        try {
            const res = await fetch('http://localhost:3001/api/equipment/unequip', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id, slot })
            });
            if (!res.ok) throw new Error(await res.text());

            // Refresh
            fetchUser();
            fetchInventory();
            setSelectedItem(null);
        } catch (e) {
            alert("Unequip Failed: " + e);
        } finally {
            setLoading(false);
        }
    };

    const handleSlotClick = (slot: string) => {
        // If slot has item -> Show Item Detail (Unequip)
        // If slot is empty -> Show Slot Selection Modal (Equip)
        const existingItem = user?.equipment?.find(e => e.slot === slot);
        if (existingItem) {
            setSelectedItem(existingItem);
        } else {
            setSelectedSlot(slot);
        }
    }

    if (!user) return <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">Loading Character Data...</div>;

    const slotCandidates = selectedSlot && Array.isArray(inventory)
        ? inventory.filter(i => i.type === 'EQUIPMENT' && i.slot === selectedSlot)
        : [];

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
                <header className="mb-12 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div>
                        <div className="flex items-center gap-3 text-cyan-400 mb-2">
                            <User size={20} />
                            <span className="text-xs font-bold tracking-widest uppercase">Character System</span>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-bold uppercase tracking-tight text-white mb-2">
                            {user.username}
                        </h1>
                        <p className="text-slate-400 max-w-lg">
                            Model: <span className="text-cyan-300 font-bold">{user.cyborg_model}</span> // Status: <span className="text-emerald-400">OPERATIONAL</span>
                        </p>
                    </div>

                    <div className="flex gap-2">
                        <TabButton
                            active={activeTab === 'overview'}
                            onClick={() => setActiveTab('overview')}
                            icon={<Activity size={18} />}
                            label="Overview"
                        />
                        <TabButton
                            active={activeTab === 'loadout'}
                            onClick={() => setActiveTab('loadout')}
                            icon={<Layers size={18} />}
                            label="Loadout"
                        />
                        <TabButton
                            active={activeTab === 'modules'}
                            onClick={() => setActiveTab('modules')}
                            icon={<Box size={18} />}
                            label="Modules"
                        />
                    </div>
                </header>

                {/* Content Area */}
                <div className="min-h-[500px]">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                    >
                        {activeTab === 'overview' && <OverviewTab user={user} />}
                        {activeTab === 'loadout' && <LoadoutTab user={user} onSlotClick={handleSlotClick} />}
                        {activeTab === 'modules' && <ModulesTab inventory={inventory} onItemClick={(item) => setSelectedItem(item)} />}
                    </motion.div>
                </div>
            </main>

            {/* Modal: Item Detail */}
            {selectedItem && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setSelectedItem(null)}>
                    <div className="bg-slate-900 border border-cyan-500/30 p-6 rounded-2xl max-w-md w-full relative shadow-[0_0_50px_rgba(34,211,238,0.15)]" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setSelectedItem(null)} className="absolute top-4 right-4 text-slate-500 hover:text-white"><X size={20} /></button>

                        <div className="flex items-start gap-6 mb-6">
                            <ItemIcon item={selectedItem} size="lg" className="rounded-xl shadow-lg shadow-cyan-500/10" />
                            <div>
                                <div className="text-xs text-cyan-400 uppercase tracking-widest mb-1">
                                    {('slot' in selectedItem) ? (selectedItem as any).slot : 'RESOURCE'}
                                </div>
                                <h2 className="text-2xl font-bold text-white">{selectedItem.name}</h2>
                                <div className="text-xs text-slate-500 font-mono mt-1">{selectedItem.code}</div>
                            </div>
                        </div>

                        <div className="bg-slate-950 p-4 rounded border border-slate-800 mb-6 text-slate-300 text-sm leading-relaxed">
                            {selectedItem.description}
                        </div>

                        {/* Stats Display */}
                        {selectedItem.stats && (
                            <div className="mb-6">
                                <h4 className="text-xs text-slate-500 uppercase font-bold mb-2">Specifications</h4>
                                <div className="grid grid-cols-2 gap-2">
                                    {(() => {
                                        try {
                                            const parsedStats = selectedItem.stats ? JSON.parse(selectedItem.stats) : {};
                                            return Object.entries(parsedStats).map(([key, val]) => (
                                                <div key={key} className="flex justify-between bg-slate-800/50 px-3 py-2 rounded text-sm border border-white/5">
                                                    <span className="text-slate-400 capitalize">{key}</span>
                                                    <span className="text-cyan-300 font-mono font-bold">+{String(val)}</span>
                                                </div>
                                            ));
                                        } catch (e) {
                                            return <div className="text-xs text-red-400">Stats Error</div>;
                                        }
                                    })()}
                                </div>
                            </div>
                        )}

                        <div className="flex gap-4">
                            {'quantity' in selectedItem && (selectedItem as Item).type === 'EQUIPMENT' && (
                                <button
                                    onClick={() => handleEquip(selectedItem as Item)}
                                    disabled={loading}
                                    className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 rounded transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    <Shield size={16} /> EQUIP MODULE
                                </button>
                            )}

                            {!('quantity' in selectedItem) && (
                                <button
                                    onClick={() => handleUnequip((selectedItem as Equipment).slot)}
                                    disabled={loading}
                                    className="flex-1 bg-red-900/50 hover:bg-red-800/50 border border-red-500/50 text-red-300 font-bold py-3 rounded transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    <X size={16} /> UNEQUIP
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Slot Selection (Equip from Loadout) */}
            {selectedSlot && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setSelectedSlot(null)}>
                    <div className="bg-slate-900 border border-cyan-500/30 p-6 rounded-2xl max-w-lg w-full relative shadow-[0_0_50px_rgba(34,211,238,0.15)] flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-white uppercase flex items-center gap-2">
                                <Box className="text-cyan-400" /> Equip to {selectedSlot}
                            </h2>
                            <button onClick={() => setSelectedSlot(null)} className="text-slate-500 hover:text-white"><X size={20} /></button>
                        </div>

                        {slotCandidates.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-slate-500 bg-slate-950 rounded border border-slate-800 border-dashed">
                                <Box size={48} className="mb-4 opacity-20" />
                                <p>No compatible modules found in inventory.</p>
                                <button onClick={() => { setActiveTab('modules'); setSelectedSlot(null); }} className="mt-4 text-cyan-400 text-sm hover:underline">
                                    Check Market
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-2 overflow-y-auto pr-2">
                                {slotCandidates.map(item => (
                                    <div key={item.id} className="flex items-center gap-4 p-3 bg-slate-950 border border-slate-800 rounded hover:border-cyan-500/50 cursor-pointer group transition-all" onClick={() => handleEquip(item, selectedSlot)}>
                                        <div className="relative">
                                            <ItemIcon item={item} size="md" className="rounded" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="font-bold text-white group-hover:text-cyan-400 transition-colors">{item.name}</div>
                                            <div className="text-xs text-slate-500">{item.description}</div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {item.stats && Object.entries(JSON.parse(item.stats)).map(([k, v]) => (
                                                <span key={k} className="text-[10px] bg-slate-900 px-1.5 py-0.5 rounded text-slate-400 border border-slate-800">
                                                    {k.substring(0, 3).toUpperCase()} +{String(v)}
                                                </span>
                                            ))}
                                            <button className="bg-cyan-900/50 hover:bg-cyan-600 text-cyan-300 hover:text-white p-2 rounded transition-colors">
                                                <Check size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// ----------------------------------------------------------------------
// Sub-Components
// ----------------------------------------------------------------------

// Helper for Auto-Generated Icons
// Moved to src/components/ItemIcon.tsx

function TabButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: any, label: string }) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-2 px-6 py-3 rounded text-sm font-bold uppercase tracking-wider transition-all border ${active
                ? "bg-cyan-950/50 border-cyan-500/50 text-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.2)]"
                : "bg-slate-900/50 border-slate-800 text-slate-400 hover:bg-slate-800 hover:border-slate-600"
                }`}
        >
            {icon}
            <span className="hidden md:inline">{label}</span>
        </button>
    );
}


function OverviewTab({ user }: { user: UserData }) {
    // Calculate Total Stats (Base + Equipment)
    const calculateTotalStats = () => {
        const total = { ...user.stats };
        user.equipment?.forEach(equip => {
            if (equip.stats) {
                try {
                    const bonuses = JSON.parse(equip.stats);
                    Object.entries(bonuses).forEach(([key, val]) => {
                        const statKey = key.toLowerCase() as keyof typeof total;
                        if (total[statKey] !== undefined) {
                            total[statKey] += Number(val);
                        }
                    });
                } catch (e) {
                    console.error("Failed to parse stats for item", equip.name);
                }
            }
        });
        return total;
    };

    const effectiveStats = calculateTotalStats();

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Col: Visual */}
            <div className="lg:col-span-1 min-h-[400px] bg-slate-900/30 rounded-2xl border border-slate-800 relative flex items-center justify-center overflow-hidden group">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(34,211,238,0.1),transparent)]" />

                {/* Character Model Avatar */}
                <div className="relative w-64 h-64 filter drop-shadow-[0_0_20px_rgba(34,211,238,0.3)] transition-all duration-500 group-hover:scale-105 group-hover:drop-shadow-[0_0_30px_rgba(34,211,238,0.5)]">
                    <img
                        src={`https://api.dicebear.com/9.x/bottts/svg?seed=${user.username}`}
                        alt="Character Avatar"
                        className="w-full h-full object-contain"
                    />
                </div>

                <div className="absolute bottom-6 left-0 right-0 text-center">
                    <div className="inline-block px-4 py-1 bg-slate-950/80 border border-slate-700 rounded-full text-xs text-slate-400">
                        Visual Rendering: <span className="text-cyan-400">ONLINE</span>
                    </div>
                </div>
            </div>

            {/* Right Col: Stats */}
            <div className="lg:col-span-2 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Primary Stats */}
                    <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
                        <h3 className="text-cyan-400 font-bold uppercase tracking-widest mb-6 flex items-center gap-2">
                            <Cpu size={18} /> Core Attributes (Effective)
                        </h3>
                        <div className="space-y-4">
                            <StatBar label="Strength" value={effectiveStats.strength} base={user.stats.strength} color="bg-red-500" />
                            <StatBar label="Dexterity" value={effectiveStats.dexterity} base={user.stats.dexterity} color="bg-yellow-500" />
                            <StatBar label="Constitution" value={effectiveStats.constitution} base={user.stats.constitution} color="bg-orange-500" />
                            <StatBar label="Intelligence" value={effectiveStats.intelligence} base={user.stats.intelligence} color="bg-blue-500" />
                            <StatBar label="Wisdom" value={effectiveStats.wisdom} base={user.stats.wisdom} color="bg-purple-500" />
                            <StatBar label="Agility" value={effectiveStats.agility} base={user.stats.agility} color="bg-green-500" />
                        </div>
                    </div>

                    {/* Secondary Stats / Info */}
                    <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800 flex flex-col gap-4">
                        <h3 className="text-cyan-400 font-bold uppercase tracking-widest mb-2 flex items-center gap-2">
                            <Shield size={18} /> Combat Analytics
                        </h3>

                        <div className="flex-1 grid grid-cols-2 gap-4">
                            <InfoBox label="Combat Power" value={String(Math.floor((effectiveStats.strength + effectiveStats.intelligence) * 2.5))} />
                            <InfoBox label="Defense Rating" value={String(Math.floor((effectiveStats.constitution + effectiveStats.agility) * 1.5))} />
                            <InfoBox label="Energy Output" value="100%" />
                            <InfoBox label="Condition" value="Optimal" highlight />
                        </div>

                        <div className="mt-4 p-4 bg-slate-950 rounded border border-slate-800 text-xs text-slate-500 leading-relaxed font-mono">
                            &gt; SYNC: COMPLETE<br />
                            &gt; MODEL: {user.cyborg_model}<br />
                            &gt; FIRMWARE: v2.4.1<br />
                            &gt; CONNECTION: STABLE
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function LoadoutTab({ user, onSlotClick }: { user: UserData, onSlotClick: (slot: string) => void }) {
    const getEquip = (slot: string) => user.equipment?.find(e => e.slot === slot);

    const renderSlot = (slot: string, label: string, align: 'left' | 'right' | 'center') => {
        const item = getEquip(slot);
        return (
            <div
                className={`group relative flex items-center gap-4 ${align === 'right' ? 'flex-row-reverse text-right' : ''} ${align === 'center' ? 'flex-col text-center' : ''}`}
                onClick={() => onSlotClick(slot)}
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
        )
    }

    return (
        <div className="relative h-[600px] bg-slate-900/20 rounded-3xl border border-slate-800/50 flex items-center justify-center overflow-hidden">
            {/* Tech Circle */}
            <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
                <div className="w-[500px] h-[500px] border border-cyan-500/30 rounded-full animate-[spin_10s_linear_infinite]" />
                <div className="absolute w-[350px] h-[350px] border border-dashed border-cyan-500/30 rounded-full animate-[spin_20s_linear_infinite_reverse]" />
            </div>

            {/* Center Avatar */}
            <div className="relative z-10 w-64 h-64 filter drop-shadow-[0_0_30px_rgba(34,211,238,0.4)]">
                <img
                    src={`https://api.dicebear.com/9.x/bottts/svg?seed=${user.username}`}
                    alt="Current Loadout"
                    className="w-full h-full object-contain cursor-pointer hover:scale-105 transition-transform"
                    onClick={() => onSlotClick('BODY')}
                />
            </div>

            {/* Slots Positioning */}
            <div className="absolute left-12 top-1/2 -translate-y-1/2 flex flex-col gap-12">
                {renderSlot('HEAD', 'HEAD SENSOR', 'left')}
                {renderSlot('BODY', 'CHASSIS', 'left')}
                {renderSlot('ARMS', 'MANIPULATOR', 'left')}
            </div>

            <div className="absolute right-12 top-1/2 -translate-y-1/2 flex flex-col gap-12">
                {renderSlot('LEGS', 'LOCOMOTION', 'right')}
                {renderSlot('CORE', 'POWER CORE', 'right')}
                {renderSlot('WEAPON', 'HARDPOINT A', 'right')}
            </div>
        </div>
    )
}

function ModulesTab({ inventory, onItemClick }: { inventory: Item[], onItemClick: (item: Item) => void }) {
    // Safety check if inventory is not array
    const inv = Array.isArray(inventory) ? inventory : [];

    if (inv.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-[400px] text-slate-500 font-mono bg-slate-900/20 rounded-3xl border border-slate-800/50">
                <Box size={48} className="mb-4 opacity-50" />
                <div>NO MODULES DETECTED IN STORAGE.</div>
                <div className="text-xs mt-2">Visit Market to acquire equipment.</div>
            </div>
        )
    }

    return (
        <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8 min-h-[400px]">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-cyan-400 font-bold uppercase tracking-widest flex items-center gap-2">
                    <Box size={18} /> Storage Modules
                </h3>
                <span className="text-xs text-slate-500 bg-slate-950 px-3 py-1 rounded-full border border-slate-800">
                    {inv.length} ITEMS
                </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
                {inv.map((item, i) => (
                    <div
                        key={i}
                        onClick={() => onItemClick(item)}
                        className="group relative aspect-square bg-slate-950 border border-slate-800 rounded-2xl hover:border-cyan-500/50 hover:bg-slate-900 transition-all cursor-pointer flex flex-col items-center justify-center p-3 overflow-hidden shadow-lg hover:shadow-cyan-500/10"
                    >
                        {/* Icon */}
                        <div className="relative w-12 h-12 mb-3 transition-transform group-hover:scale-110">
                            <ItemIcon item={item} size="md" className="rounded-lg" />
                        </div>

                        {/* Quantity Overlay */}
                        {item.quantity && item.quantity > 1 && (
                            <div className="absolute top-2 right-2 bg-slate-800 text-white text-[10px] font-bold px-1.5 rounded border border-slate-700 shadow">
                                x{item.quantity}
                            </div>
                        )}

                        {/* Label */}
                        <div className="text-center w-full">
                            <div className="text-xs font-bold text-slate-300 group-hover:text-white truncate px-1">{item.name}</div>
                            <div className="text-[10px] text-slate-600 group-hover:text-cyan-400 mt-0.5 uppercase tracking-wider">
                                {item.type === 'EQUIPMENT' ? item.slot : 'RESOURCE'}
                            </div>
                        </div>

                        {/* Highlight Border Effect */}
                        <div className="absolute inset-0 border-2 border-transparent group-hover:border-cyan-500/20 rounded-2xl transition-colors" />
                    </div>
                ))}
            </div>
        </div>
    )
}

function InfoBox({ label, value, highlight }: { label: string, value: string, highlight?: boolean }) {
    return (
        <div className="bg-slate-950 p-4 rounded border border-slate-800 flex flex-col items-center justify-center text-center">
            <span className="text-slate-500 text-xs uppercase font-bold mb-1">{label}</span>
            <span className={`text-xl font-bold font-mono ${highlight ? "text-emerald-400" : "text-white"}`}>{value}</span>
        </div>
    )
}

function StatBar({ label, value, base, color }: { label: string, value: number, base: number, color: string }) {
    const bonus = value - base;

    return (
        <div className="flex items-center gap-4">
            <span className="w-24 text-sm font-bold text-slate-400 uppercase text-right">{label}</span>
            <div className="flex-1 h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800 relative flex">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${base * 8}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className={`h-full bg-slate-600 shadow-[0_0_10px_rgba(255,255,255,0.2)]`}
                />
                {bonus > 0 && (
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${bonus * 8}%` }}
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
