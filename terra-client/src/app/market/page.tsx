"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Coins, TrendingUp, TrendingDown, RefreshCw, ShoppingCart, Package } from "lucide-react";
import SystemMenu from "@/components/SystemMenu";
import ItemIcon from "@/components/ItemIcon";

interface MarketItem {
    id: number;
    name: string;
    code: string;
    base_price: number;
    current_price: number;
    previous_price: number | null;
    volatility: number;
    description: string;
    type?: 'RESOURCE' | 'EQUIPMENT';
    slot?: string;
    stats?: string;
}

interface InventoryItem {
    item_id: number;
    name: string;
    quantity: number;
}

export default function MarketPage() {
    const router = useRouter();
    const [items, setItems] = useState<MarketItem[]>([]);
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [userGold, setUserGold] = useState<number>(0);
    const [loading, setLoading] = useState(true);
    const [selectedItem, setSelectedItem] = useState<MarketItem | null>(null);
    const [tradeMode, setTradeMode] = useState<'BUY' | 'SELL'>('BUY');
    const [quantity, setQuantity] = useState(1);
    const [activeTab, setActiveTab] = useState<'RESOURCES' | 'MODULES'>('RESOURCES');

    const userId = typeof window !== 'undefined' ? localStorage.getItem("terra_user_id") : null;

    const fetchData = async () => {
        if (!userId) return;
        setLoading(true);
        try {
            // Fetch Market
            const marketRes = await fetch('http://localhost:3001/api/market');
            if (marketRes.ok) setItems(await marketRes.json());

            // Fetch Inventory
            const invRes = await fetch(`http://localhost:3001/api/inventory/${userId}`);
            if (invRes.ok) setInventory(await invRes.json());

            // Fetch User Gold
            const userRes = await fetch(`http://localhost:3001/api/user/${userId}`);
            if (userRes.ok) {
                const userData = await userRes.json();
                setUserGold(userData.resources.gold);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!userId) {
            router.push('/login');
            return;
        }
        fetchData();
        // Auto refresh price every 30s to stay relatively synced
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, [userId]);

    const handleTrade = async () => {
        if (!selectedItem || !userId) return;

        try {
            const res = await fetch('http://localhost:3001/api/market/trade', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: userId,
                    item_id: selectedItem.id,
                    type: tradeMode,
                    quantity: quantity
                })
            });

            const data = await res.json();
            if (res.ok) {
                alert(data.message);
                setSelectedItem(null);
                setQuantity(1);
                fetchData(); // Refresh data
            } else {
                alert(`Trade Failed: ${data.error}`);
            }
        } catch (e) {
            console.error(e);
            alert("Network Error");
        }
    };

    const getOwnedQuantity = (itemId: number) => {
        const item = inventory.find(i => i.item_id === itemId);
        return item ? item.quantity : 0;
    };

    // Filter Items Logic
    const filteredItems = items.filter(item => {
        if (activeTab === 'MODULES') {
            return item.type === 'EQUIPMENT';
        } else {
            // Resources: type is RESOURCE or potentially undefined/legacy items
            // Explicitly excluding EQUIPMENT to show everything else (Resources, Parts, etc.)
            return item.type !== 'EQUIPMENT';
        }
    });

    return (
        <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-cyan-500/30">
            {/* Background Effects */}
            <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(17,24,39,1),rgba(2,6,23,1))] -z-20" />
            <div className="fixed inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none -z-10" />

            <div className="absolute top-4 left-4 z-50">
                <SystemMenu activePage="market" />
            </div>

            <header className="container mx-auto px-4 pt-20 pb-8 max-w-7xl flex flex-col md:flex-row justify-between items-end border-b border-white/5 mb-8">
                <div>
                    <h1 className="text-4xl md:text-5xl font-bold uppercase tracking-tight text-white mb-2 flex items-center gap-3">
                        <TrendingUp className="text-cyan-400" size={40} /> Global Market
                    </h1>
                    <p className="text-slate-400 font-mono text-sm">REAL-TIME COMMODITY TRADING NETWORK</p>
                </div>
                <div className="flex items-center gap-4 px-6 py-3 bg-slate-900 rounded-full border border-slate-800 shadow-[0_0_15px_rgba(250,204,21,0.1)]">
                    <Coins className="text-yellow-400" size={24} />
                    <span className="font-mono font-bold text-yellow-400 text-2xl">{userGold.toLocaleString()} G</span>
                </div>
            </header>

            <main className="container mx-auto px-4 pb-20 max-w-7xl grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Market List */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Tabs */}
                    <div className="flex items-center gap-4 border-b border-white/5 pb-4">
                        <button
                            onClick={() => { setActiveTab('RESOURCES'); setSelectedItem(null); }}
                            className={`px-6 py-2 rounded-full text-sm font-bold uppercase tracking-wider transition-all ${activeTab === 'RESOURCES' ? 'bg-cyan-950 text-cyan-400 border border-cyan-500/50 shadow-[0_0_10px_rgba(34,211,238,0.2)]' : 'text-slate-500 hover:text-white hover:bg-slate-800'}`}
                        >
                            Resources
                        </button>
                        <button
                            onClick={() => { setActiveTab('MODULES'); setSelectedItem(null); }}
                            className={`px-6 py-2 rounded-full text-sm font-bold uppercase tracking-wider transition-all ${activeTab === 'MODULES' ? 'bg-cyan-950 text-cyan-400 border border-cyan-500/50 shadow-[0_0_10px_rgba(34,211,238,0.2)]' : 'text-slate-500 hover:text-white hover:bg-slate-800'}`}
                        >
                            Modules
                        </button>
                        <button onClick={fetchData} className="ml-auto text-xs text-slate-500 hover:text-cyan-400 flex items-center gap-2 transition-colors">
                            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> REFRESH DATA
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filteredItems.map(item => {
                            const isUp = item.previous_price ? item.current_price >= item.previous_price : true;
                            const diff = item.previous_price ? ((item.current_price - item.previous_price) / item.previous_price * 100).toFixed(1) : 0;

                            return (
                                <div key={item.id}
                                    onClick={() => { setSelectedItem(item); setTradeMode('BUY'); setQuantity(1); }}
                                    className={`relative bg-slate-900/50 p-4 rounded-xl border transition-all cursor-pointer group overflow-hidden ${selectedItem?.id === item.id
                                        ? 'border-cyan-500 shadow-[0_0_15px_rgba(34,211,238,0.2)]'
                                        : 'border-slate-800 hover:border-slate-600 hover:bg-slate-800/80'
                                        }`}
                                >
                                    <div className="flex items-start gap-4 relative z-10">
                                        <ItemIcon item={item} size="md" className="rounded-lg shadow-lg" />

                                        <div className="flex-1">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h3 className="font-bold text-lg text-white group-hover:text-cyan-300 transition-colors">{item.name}</h3>
                                                    <span className="text-xs text-slate-500 font-mono bg-slate-950 px-2 py-0.5 rounded border border-slate-800">{item.code}</span>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-xl font-mono font-bold flex items-center justify-end gap-1 text-white">
                                                        <Coins size={14} className="text-yellow-500" />
                                                        {item.current_price.toLocaleString()}
                                                    </div>
                                                    <div className={`text-xs font-mono flex items-center justify-end gap-1 ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
                                                        {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                                        {Math.abs(Number(diff))}%
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="mt-3 text-xs text-slate-400 line-clamp-2">{item.description}</div>
                                            {item.type === 'EQUIPMENT' && item.slot && (
                                                <div className="mt-2 inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest bg-cyan-950/50 text-cyan-400 rounded border border-cyan-900/50">
                                                    Slot: {item.slot}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {selectedItem?.id === item.id && <div className="absolute inset-0 bg-cyan-500/5 pointer-events-none" />}
                                </div>
                            )
                        })}
                        {filteredItems.length === 0 && (
                            <div className="col-span-full py-20 text-center text-slate-500 bg-slate-900/30 rounded-xl border border-dashed border-slate-800">
                                No items found in this category.
                            </div>
                        )}
                    </div>
                </div>

                {/* Trade Panel & Inventory */}
                <div className="space-y-6">
                    {/* Trade Box */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl sticky top-6">
                        <h2 className="text-lg font-bold mb-6 text-white flex items-center gap-2 uppercase tracking-wide border-b border-white/5 pb-4">
                            <ShoppingCart size={18} className="text-cyan-400" /> Trade Console
                        </h2>
                        {selectedItem ? (
                            <div className="space-y-6">
                                <div className="flex items-center gap-4">
                                    <ItemIcon item={selectedItem} size="md" className="rounded-lg shadow-lg" />
                                    <div>
                                        <span className="block font-bold text-xl text-white leading-none mb-1">{selectedItem.name}</span>
                                        <span className="text-xs text-slate-500 font-mono">{selectedItem.code}</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-lg border border-slate-800">
                                    <button
                                        className={`py-2 text-sm font-bold rounded-md transition-all ${tradeMode === 'BUY' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                                        onClick={() => setTradeMode('BUY')}
                                    >
                                        BUY
                                    </button>
                                    <button
                                        className={`py-2 text-sm font-bold rounded-md transition-all ${tradeMode === 'SELL' ? 'bg-red-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                                        onClick={() => setTradeMode('SELL')}
                                    >
                                        SELL
                                    </button>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex justify-between items-center text-xs text-slate-400 uppercase font-bold tracking-wider">
                                        <span>Quantity</span>
                                        <span className="text-cyan-400">Inventory: {getOwnedQuantity(selectedItem.id)}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-10 h-10 flex items-center justify-center bg-slate-800 rounded border border-slate-700 hover:border-cyan-500 transition-colors text-xl font-bold">-</button>
                                        <input
                                            type="number"
                                            value={quantity}
                                            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                                            className="flex-1 bg-slate-950 border border-slate-700 rounded h-10 text-center font-mono text-lg focus:border-cyan-500 outline-none transition-colors"
                                        />
                                        <button onClick={() => setQuantity(quantity + 1)} className="w-10 h-10 flex items-center justify-center bg-slate-800 rounded border border-slate-700 hover:border-cyan-500 transition-colors text-xl font-bold">+</button>
                                    </div>
                                </div>

                                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-400">Unit Price</span>
                                        <span className="font-mono text-white">{selectedItem.current_price.toLocaleString()} G</span>
                                    </div>
                                    <div className="h-px bg-slate-800 my-2" />
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-300 font-bold">Total</span>
                                        <span className="font-mono text-xl text-yellow-400 font-bold">{(selectedItem.current_price * quantity).toLocaleString()} G</span>
                                    </div>
                                </div>

                                <button
                                    onClick={handleTrade}
                                    className={`w-full py-4 rounded-xl font-bold text-white transition-all shadow-lg flex items-center justify-center gap-2 ${tradeMode === 'BUY'
                                        ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 shadow-emerald-900/20'
                                        : 'bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 shadow-red-900/20'}`}
                                >
                                    {tradeMode === 'BUY' ? 'CONFIRM ORDER' : 'LIQUIDATE ASSETS'}
                                </button>
                            </div>
                        ) : (
                            <div className="h-64 flex flex-col items-center justify-center text-slate-500 text-sm text-center px-4 border border-dashed border-slate-800 rounded-xl bg-slate-950/50">
                                <ShoppingCart size={32} className="mb-4 opacity-20" />
                                <p>Select a commodity from the market list to initiate transaction sequence.</p>
                            </div>
                        )}
                    </div>

                    {/* Inventory Box */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                        <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-white uppercase tracking-wide"><Package size={18} className="text-cyan-400" /> Local Storage</h2>
                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                            {inventory.length > 0 ? inventory.map((inv, idx) => (
                                <div key={idx} className="flex justify-between items-center p-3 bg-slate-950 rounded border border-slate-800 hover:border-slate-700 transition-colors">
                                    <span className="text-sm font-medium text-slate-300">{inv.name}</span>
                                    <span className="font-mono font-bold text-cyan-400 bg-cyan-950/30 px-2 py-0.5 rounded text-xs">{inv.quantity.toLocaleString()}</span>
                                </div>
                            )) : (
                                <div className="text-slate-500 text-xs text-center py-8 bg-slate-950 rounded border border-dashed border-slate-800">Storage Empty</div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
