"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Coins, TrendingUp, TrendingDown, RefreshCw, ShoppingCart, Package } from "lucide-react";

interface MarketItem {
    id: number;
    name: string;
    code: string;
    base_price: number;
    current_price: number;
    previous_price: number | null;
    volatility: number;
    description: string;
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

    return (
        <div className="min-h-screen bg-background text-white p-6 font-sans">
            {/* Header */}
            <header className="flex items-center justify-between mb-8 pb-4 border-b border-surface-border">
                <div className="flex items-center gap-4">
                    <button onClick={() => router.push("/dashboard")} className="p-2 hover:bg-surface-light rounded-full text-gray-400 hover:text-white">
                        <ArrowLeft size={24} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2 text-cyan-400">
                            <TrendingUp /> CITY MARKET
                        </h1>
                        <p className="text-xs text-gray-500 font-mono">REAL-TIME COMMODITY TRADING</p>
                    </div>
                </div>
                <div className="flex items-center gap-4 px-6 py-2 bg-surface-light rounded-full border border-surface-border">
                    <Coins className="text-yellow-400" size={20} />
                    <span className="font-mono font-bold text-yellow-400 text-lg">{userGold.toLocaleString()} G</span>
                </div>
            </header>

            <main className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Market List */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex justify-between items-center mb-2">
                        <h2 className="text-lg font-bold text-white flex items-center gap-2"><ShoppingCart size={18} /> Commodities</h2>
                        <button onClick={fetchData} className="text-xs text-gray-400 hover:text-white flex items-center gap-1">
                            <RefreshCw size={12} /> Refresh
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {items.map(item => {
                            const isUp = item.previous_price ? item.current_price >= item.previous_price : true;
                            const diff = item.previous_price ? ((item.current_price - item.previous_price) / item.previous_price * 100).toFixed(1) : 0;

                            return (
                                <div key={item.id}
                                    onClick={() => { setSelectedItem(item); setTradeMode('BUY'); setQuantity(1); }}
                                    className={`bg-surface p-4 rounded-lg border border-surface-border hover:border-cyan-500 cursor-pointer transition-all group relative overflow-hidden ${selectedItem?.id === item.id ? 'ring-2 ring-cyan-500' : ''}`}
                                >
                                    <div className="flex justify-between items-start z-10 relative">
                                        <div>
                                            <h3 className="font-bold text-lg">{item.name}</h3>
                                            <span className="text-xs text-gray-500 font-mono bg-surface-light px-2 py-0.5 rounded">{item.code}</span>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xl font-mono font-bold flex items-center justify-end gap-1">
                                                <Coins size={14} className="text-yellow-500" />
                                                {item.current_price.toLocaleString()}
                                            </div>
                                            <div className={`text-xs font-mono flex items-center justify-end gap-1 ${isUp ? 'text-green-400' : 'text-red-400'}`}>
                                                {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                                {Math.abs(Number(diff))}%
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-4 text-xs text-gray-400 line-clamp-2">{item.description}</div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Trade Panel & Inventory */}
                <div className="space-y-6">
                    {/* Trade Box */}
                    <div className="bg-surface border border-surface-border rounded-lg p-6">
                        <h2 className="text-lg font-bold mb-4 text-secondary">Trade Console</h2>
                        {selectedItem ? (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between pb-4 border-b border-surface-border">
                                    <span className="font-bold text-xl">{selectedItem.name}</span>
                                    <div className="text-right">
                                        <span className="block text-xs text-gray-500">Price</span>
                                        <span className="font-mono text-yellow-400">{selectedItem.current_price} G</span>
                                    </div>
                                </div>

                                <div className="flex bg-surface-light rounded-md p-1">
                                    <button
                                        className={`flex-1 py-2 text-sm font-bold rounded ${tradeMode === 'BUY' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'}`}
                                        onClick={() => setTradeMode('BUY')}
                                    >
                                        BUY
                                    </button>
                                    <button
                                        className={`flex-1 py-2 text-sm font-bold rounded ${tradeMode === 'SELL' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'}`}
                                        onClick={() => setTradeMode('SELL')}
                                    >
                                        SELL
                                    </button>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs text-gray-400">Quantity</label>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="px-3 py-1 bg-surface-border rounded hover:bg-gray-600">-</button>
                                        <input
                                            type="number"
                                            value={quantity}
                                            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                                            className="flex-1 bg-surface-light border border-surface-border rounded px-2 py-1 text-center font-mono"
                                        />
                                        <button onClick={() => setQuantity(quantity + 1)} className="px-3 py-1 bg-surface-border rounded hover:bg-gray-600">+</button>
                                    </div>
                                </div>

                                <div className="p-3 bg-black/20 rounded border border-surface-border">
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-gray-400">Total Cost</span>
                                        <span className="font-mono text-yellow-400 font-bold">{(selectedItem.current_price * quantity).toLocaleString()} G</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-gray-500">Owned</span>
                                        <span className="font-mono text-gray-300">{getOwnedQuantity(selectedItem.id)} Units</span>
                                    </div>
                                </div>

                                <button
                                    onClick={handleTrade}
                                    className={`w-full py-3 rounded font-bold text-white transition-all shadow-lg ${tradeMode === 'BUY' ? 'bg-green-600 hover:bg-green-500' : 'bg-red-600 hover:bg-red-500'}`}
                                >
                                    {tradeMode === 'BUY' ? 'CONFIRM PURCHASE' : 'CONFIRM SALE'}
                                </button>
                            </div>
                        ) : (
                            <div className="h-48 flex items-center justify-center text-gray-500 text-sm text-center px-4">
                                Select a commodity from the list to start trading
                            </div>
                        )}
                    </div>

                    {/* Inventory Box */}
                    <div className="bg-surface border border-surface-border rounded-lg p-6">
                        <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><Package size={18} /> Inventory</h2>
                        <div className="space-y-2 max-h-[300px] overflow-y-auto">
                            {inventory.length > 0 ? inventory.map((inv, idx) => (
                                <div key={idx} className="flex justify-between items-center p-3 bg-surface-light rounded">
                                    <span className="text-sm">{inv.name}</span>
                                    <span className="font-mono font-bold text-cyan-400">{inv.quantity.toLocaleString()}</span>
                                </div>
                            )) : (
                                <div className="text-gray-500 text-xs text-center py-4">Inventory Empty</div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
