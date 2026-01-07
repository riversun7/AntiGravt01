"use client";

import { useEffect, useState } from "react";
import { Send, Users, Package, Calendar } from "lucide-react";
import { AdminUser } from "@/types/admin";
import SearchableSelect from "@/components/ui/SearchableSelect";
import DateTimePicker from "@/components/ui/DateTimePicker";
import { API_BASE_URL } from "@/lib/config";

interface MarketItem {
    id: number;
    name: string;
    code: string;
    type: string;
}

export default function AdminMailPage() {
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [items, setItems] = useState<MarketItem[]>([]);

    // Form State
    const [recipient, setRecipient] = useState<string | number>("ALL"); // 'ALL' or userId
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [attachedItems, setAttachedItems] = useState<{ code: string, qty: number }[]>([]);
    const [scheduledAt, setScheduledAt] = useState("");
    const [expirationMode, setExpirationMode] = useState("NEVER");
    const [customExpiresAt, setCustomExpiresAt] = useState("");
    const [notification, setNotification] = useState<string | null>(null);

    // Item Picker State
    const [selectedItemCode, setSelectedItemCode] = useState<string | number>("");
    const [itemQty, setItemQty] = useState(1);

    useEffect(() => {
        // Fetch Users
        fetch(`${API_BASE_URL}/api/admin/users`)
            .then(res => res.json())
            .then(data => setUsers(data));

        // Fetch Items
        fetch(`${API_BASE_URL}/api/market`)
            .then(res => res.json())
            .then(data => setItems(data));
    }, []);

    const handleAddItem = () => {
        if (!selectedItemCode || itemQty <= 0) return;
        setAttachedItems(prev => [...prev, { code: String(selectedItemCode), qty: itemQty }]);
        setSelectedItemCode("");
        setItemQty(1);
    };

    const handleRemoveItem = (idx: number) => {
        setAttachedItems(prev => prev.filter((_, i) => i !== idx));
    };

    const handleSend = () => {
        if (!title.trim()) {
            alert("Title is required");
            return;
        }

        // Calculate Expiration
        let finalExpiresAt: string | null = null;
        if (expirationMode !== 'NEVER') {
            const now = new Date();
            if (expirationMode === '1_DAY') now.setDate(now.getDate() + 1);
            if (expirationMode === '7_DAYS') now.setDate(now.getDate() + 7);
            if (expirationMode === '30_DAYS') now.setDate(now.getDate() + 30);

            finalExpiresAt = (expirationMode === 'CUSTOM' && customExpiresAt)
                ? new Date(customExpiresAt).toISOString()
                : now.toISOString();
        }

        const payload = {
            recipientId: recipient,
            title,
            content,
            items: JSON.stringify(attachedItems),
            scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
            expiresAt: finalExpiresAt
        };

        fetch(`${API_BASE_URL}/api/admin/mail/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    setNotification(`Mail sent to ${data.count} recipients!`);
                    setTitle("");
                    setContent("");
                    setAttachedItems([]);
                    setScheduledAt("");
                    setTimeout(() => setNotification(null), 3000);
                } else {
                    alert("Failed: " + data.error);
                }
            });
    };

    // Prepare Options for SearchableSelect
    const userOptions = [
        { label: "ALL USERS (Mass Mail)", value: "ALL", category: "System" },
        ...users.map(u => ({
            label: u.username,
            value: u.id,
            category: "Users",
            subtext: `ID: ${u.id} | ${u.role}`
        }))
    ];

    const itemOptions = [
        { label: "Gold (Currency)", value: "GOLD", category: "Currencies" },
        { label: "Gem (Premium)", value: "GEM", category: "Currencies" },
        ...items.map(i => ({
            label: i.name,
            value: i.code,
            category: i.type,
            subtext: `Code: ${i.code}`
        }))
    ];

    return (
        <div className="max-w-4xl mx-auto">
            {notification && (
                <div className="fixed top-4 right-4 bg-green-500 text-black px-6 py-3 rounded shadow-lg font-bold z-50 animate-bounce">
                    {notification}
                </div>
            )}

            <h2 className="text-2xl font-bold mb-6 text-white flex items-center gap-2">
                <Send size={24} className="text-cyan-400" /> Mail Console
            </h2>

            <div className="bg-surface border border-surface-border p-6 rounded-xl space-y-6 shadow-2xl">

                {/* Recipient */}
                <div className="z-20 relative">
                    <SearchableSelect
                        label="Recipient"
                        options={userOptions}
                        value={recipient}
                        onChange={setRecipient}
                        placeholder="Select Recipient..."
                    />
                </div>

                {/* Message */}
                <div className="grid grid-cols-1 gap-4">
                    <div>
                        <label className="block text-sm text-gray-400 mb-2">Title</label>
                        <input
                            type="text"
                            className="w-full bg-surface-dark border border-surface-border rounded p-3 text-white focus:border-cyan-500 outline-none transition-colors"
                            placeholder="Event Rewards / System Notice"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-400 mb-2">Content</label>
                        <textarea
                            className="w-full bg-surface-dark border border-surface-border rounded p-3 text-white h-32 focus:border-cyan-500 outline-none resize-none transition-colors"
                            placeholder="Write your message here..."
                            value={content}
                            onChange={e => setContent(e.target.value)}
                        />
                    </div>
                </div>

                {/* Items */}
                <div className="bg-black/20 p-4 rounded-lg border border-dashed border-slate-700 z-10 relative">
                    <label className="block text-sm text-gray-400 mb-4 flex items-center gap-2">
                        <Package size={16} /> Attachments
                    </label>

                    <div className="flex gap-2 mb-4 items-start">
                        <div className="flex-1">
                            <SearchableSelect
                                options={itemOptions}
                                value={selectedItemCode}
                                onChange={setSelectedItemCode}
                                placeholder="Search Item..."
                            />
                        </div>
                        <input
                            type="number"
                            className="w-20 bg-surface-dark border border-surface-border rounded p-3 text-white text-center h-[50px] font-mono"
                            value={itemQty}
                            onChange={e => setItemQty(Math.max(1, Number(e.target.value)))}
                        />
                        <button
                            onClick={handleAddItem}
                            className="px-6 h-[50px] bg-slate-700 hover:bg-slate-600 text-white rounded font-bold transition-colors"
                        >
                            Add
                        </button>
                    </div>

                    {/* Attached List */}
                    <div className="flex flex-wrap gap-2 min-h-[40px]">
                        {attachedItems.length === 0 && <span className="text-gray-600 text-sm italic py-2">No items attached</span>}
                        {attachedItems.map((item, idx) => (
                            <div key={idx} className="bg-cyan-900/30 border border-cyan-800 px-3 py-1 rounded-full flex items-center gap-2 text-sm text-cyan-200 animate-in zoom-in duration-200">
                                <span className="font-mono">{item.code}</span>
                                <span className="bg-black/30 px-2 rounded text-cyan-400 font-bold">x{item.qty}</span>
                                <button onClick={() => handleRemoveItem(idx)} className="text-cyan-500 hover:text-white ml-1">×</button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Scheduling & Expiration */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="z-0 relative">
                        <DateTimePicker
                            label="Schedule Delivery (Optional)"
                            value={scheduledAt}
                            onChange={setScheduledAt}
                        />
                        <p className="text-xs text-gray-500 mt-1 pl-1">Leave empty to send immediately.</p>
                    </div>

                    <div className="z-0 relative">
                        <label className="block text-sm text-gray-400 mb-2">Expiration</label>
                        <select
                            className="w-full bg-surface-dark border border-surface-border rounded p-3 text-white outline-none focus:border-cyan-500 transition-colors"
                            value={expirationMode}
                            onChange={e => setExpirationMode(e.target.value)}
                        >
                            <option value="NEVER">Never Expires</option>
                            <option value="1_DAY">1 Day</option>
                            <option value="7_DAYS">7 Days</option>
                            <option value="30_DAYS">30 Days</option>
                            <option value="CUSTOM">Custom Date...</option>
                        </select>

                        {expirationMode === 'CUSTOM' && (
                            <div className="mt-2">
                                <DateTimePicker
                                    label="Expires At"
                                    value={customExpiresAt}
                                    onChange={setCustomExpiresAt}
                                />
                            </div>
                        )}
                    </div>
                </div>

                <div className="pt-4 border-t border-slate-800 flex justify-end">
                    <button
                        onClick={handleSend}
                        className="flex items-center gap-2 px-8 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded shadow-lg shadow-cyan-900/20 transition-all hover:scale-105 active:scale-95"
                    >
                        <Send size={18} /> Send Mail
                    </button>
                </div>
            </div>

            {/* Sent History */}
            <SentHistory />
        </div>
    );
}

function SentHistory() {
    const [logs, setLogs] = useState<any[]>([]);

    const fetchHistory = () => {
        fetch(`${API_BASE_URL}/api/admin/mail/history`)
            .then(res => res.json())
            .then(data => setLogs(data));
    };

    const handleRevoke = (id: number) => {
        if (!confirm("Are you sure you want to revoke/delete this mail? The user will no longer see it.")) return;
        fetch(`${API_BASE_URL}/api/admin/mail/${id}`, { method: 'DELETE' })
            .then(res => res.json())
            .then(data => {
                if (data.success) fetchHistory();
            });
    };

    useEffect(() => {
        fetchHistory();
        const interval = setInterval(fetchHistory, 5000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="mt-8">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Calendar size={20} className="text-gray-400" /> Sent History (Last 100)
            </h3>
            <div className="bg-surface border border-surface-border rounded-xl overflow-hidden shadow-lg">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-black/40 text-gray-400 text-sm border-b border-surface-border">
                                <th className="p-4">ID</th>
                                <th className="p-4">To</th>
                                <th className="p-4">Title</th>
                                <th className="p-4">Items</th>
                                <th className="p-4">Time</th>
                                <th className="p-4">Status</th>
                                <th className="p-4">Action</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {logs.map(log => (
                                <tr key={log.id} className="border-b border-surface-border/50 hover:bg-white/5 transition-colors">
                                    <td className="p-4 font-mono text-gray-500">#{log.id}</td>
                                    <td className="p-4">
                                        <span className="text-cyan-300 font-bold">{log.username || 'Unknown'}</span>
                                        <span className="text-xs text-gray-600 ml-2">({log.recipient_id})</span>
                                    </td>
                                    <td className="p-4 text-white">{log.title}</td>
                                    <td className="p-4 text-gray-400">
                                        {log.items === '[]' ? '-' : (
                                            <span className="text-yellow-500 text-xs bg-yellow-900/20 px-2 py-1 rounded border border-yellow-700/30">
                                                Attached
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-4 text-gray-500 text-xs">
                                        {new Date(log.created_at).toLocaleString()}
                                    </td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${log.is_claimed ? 'bg-green-900/50 text-green-400' : 'bg-gray-800 text-gray-400'}`}>
                                            {log.is_claimed ? 'CLAIMED' : 'UNREAD'}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        {!log.is_claimed && (
                                            <button
                                                onClick={() => handleRevoke(log.id)}
                                                className="text-red-400 hover:text-red-300 text-xs underline"
                                            >
                                                Revoke
                                            </button>
                                        )}
                                        {log.is_claimed && <span className="text-gray-600 text-xs text-center block">-</span>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
