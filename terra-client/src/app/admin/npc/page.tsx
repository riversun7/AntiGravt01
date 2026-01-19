"use client";

import { useState, useEffect } from 'react';
import { Users, Shield, Map as MapIcon, Edit2, Save, X, RefreshCw } from 'lucide-react';

interface NPC {
    id: number;
    username: string;
    npc_type: 'ABSOLUTE' | 'FREE' | 'NONE';
    cyborg_model?: string;
    building_id?: number;
    x?: number;
    y?: number;
    custom_boundary?: string;
    territory_radius?: number;
}

export default function NPCAdminPage() {
    const [npcs, setNpcs] = useState<NPC[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedNPC, setSelectedNPC] = useState<NPC | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Form State
    const [editForm, setEditForm] = useState<{
        npc_type: string;
        boundary: string;
        radius: number;
    }>({ npc_type: 'ABSOLUTE', boundary: '', radius: 5 });

    useEffect(() => {
        fetchNPCs();
    }, []);

    const fetchNPCs = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/admin/npcs?_t=${Date.now()}`);
            const data = await res.json();
            setNpcs(data.npcs || []);
        } catch (e) {
            console.error("Failed to fetch NPCs", e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleEditClick = (npc: NPC) => {
        setSelectedNPC(npc);
        setEditForm({
            npc_type: npc.npc_type,
            boundary: npc.custom_boundary || '',
            radius: npc.territory_radius || 5
        });
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!selectedNPC) return;

        try {
            const res = await fetch(`/api/admin/npcs/${selectedNPC.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    npc_type: editForm.npc_type,
                    boundary: editForm.boundary,
                    building_id: selectedNPC.building_id,
                    radius: editForm.radius
                })
            });

            if (res.ok) {
                setIsModalOpen(false);
                fetchNPCs();
                alert("NPC Updated Successfully");
            } else {
                alert("Failed to update NPC");
            }
        } catch (e) {
            console.error("Update failed", e);
            alert("Error updating NPC");
        }
    };

    return (
        <div className="h-full flex flex-col p-6 bg-[#0d1117] text-slate-300">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Shield className="text-purple-500" /> NPC Faction Manager
                </h1>
                <div className="flex gap-2">
                    <button
                        onClick={async () => {
                            if (!confirm("Seeding will create random NPC factions and modify the database. Continue?")) return;
                            try {
                                const res = await fetch('/api/admin/seed-factions', { method: 'POST' });
                                const data = await res.json();
                                if (data.success) {
                                    alert("NPC Factions Seeded Successfully!");
                                    fetchNPCs(); // Refresh list
                                } else {
                                    alert("Failed: " + data.error);
                                }
                            } catch (e) {
                                alert("Error calling seed API");
                            }
                        }}
                        className="px-4 py-2 bg-red-500/10 border border-red-500 hover:bg-red-500/20 text-red-500 rounded font-bold text-sm transition-colors"
                    >
                        INIT NPC FACTIONS
                    </button>
                    <button
                        onClick={fetchNPCs}
                        className="p-2 bg-slate-800 rounded hover:bg-slate-700 text-white flex items-center gap-1"
                    >
                        <RefreshCw size={16} /> Refresh
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-auto bg-[#161b22] border border-slate-800 rounded-xl shadow-xl">
                {isLoading ? (
                    <div className="h-full flex items-center justify-center">Loading...</div>
                ) : (
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-[#21262d] text-slate-400 text-sm uppercase sticky top-0">
                            <tr>
                                <th className="p-4 border-b border-slate-700">ID</th>
                                <th className="p-4 border-b border-slate-700">Username</th>
                                <th className="p-4 border-b border-slate-700">Type</th>
                                <th className="p-4 border-b border-slate-700">Model</th>
                                <th className="p-4 border-b border-slate-700">Territory Center</th>
                                <th className="p-4 border-b border-slate-700">Boundary</th>
                                <th className="p-4 border-b border-slate-700">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 text-sm">
                            {npcs.map(npc => (
                                <tr key={npc.id} className="hover:bg-white/5 transition-colors">
                                    <td className="p-4 font-mono text-slate-500">#{npc.id}</td>
                                    <td className="p-4 font-bold text-white flex items-center gap-2">
                                        <Users size={14} className="text-slate-500" />
                                        {npc.username}
                                    </td>
                                    <td className="p-4">
                                        <span className={`px-2 py-0.5 rounded textxs font-bold ${npc.npc_type === 'ABSOLUTE' ? 'bg-purple-900/50 text-purple-300 border border-purple-800' :
                                            npc.npc_type === 'FREE' ? 'bg-green-900/50 text-green-300 border border-green-800' :
                                                'bg-slate-800 text-slate-400'
                                            }`}>
                                            {npc.npc_type}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        <span className="text-xs font-mono text-cyan-300">
                                            {npc.cyborg_model || '-'}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        {npc.building_id ? (
                                            <div className="text-xs">
                                                <div className="text-cyan-400">CC #{npc.building_id}</div>
                                                <div className="text-slate-500">({npc.x?.toFixed(4)}, {npc.y?.toFixed(4)})</div>
                                                <div className="text-yellow-600">Rad: {npc.territory_radius}km</div>
                                            </div>
                                        ) : (
                                            <span className="text-slate-600 italic">No Command Center</span>
                                        )}
                                    </td>
                                    <td className="p-4 max-w-xs truncate font-mono text-xs text-slate-500">
                                        {npc.custom_boundary ? '✅ Custom GeoJSON' : '❌ Radius Only'}
                                    </td>
                                    <td className="p-4">
                                        <button
                                            onClick={() => handleEditClick(npc)}
                                            className="p-1.5 bg-blue-600/20 text-blue-400 hover:bg-blue-600/40 rounded border border-blue-500/50"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {npcs.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="p-8 text-center text-slate-500">No NPC Factions found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Edit Modal */}
            {isModalOpen && selectedNPC && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setIsModalOpen(false)}>
                    <div className="bg-[#161b22] w-full max-w-2xl rounded-xl border border-slate-700 shadow-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-slate-800 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-white">Edit NPC: {selectedNPC.username}</h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-500 hover:text-white"><X /></button>
                        </div>

                        <div className="p-6 space-y-4 overflow-y-auto">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">NPC Type</label>
                                <select
                                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white focus:border-purple-500 outline-none"
                                    value={editForm.npc_type}
                                    onChange={e => setEditForm({ ...editForm, npc_type: e.target.value })}
                                >
                                    <option value="ABSOLUTE">ABSOLUTE (Fixed Territory, Invulnerable)</option>
                                    <option value="FREE">FREE (AI Player, Expandable)</option>
                                    <option value="NONE">NONE (Convert to Regular Player)</option>
                                </select>
                            </div>

                            {selectedNPC.building_id && (
                                <>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Territory Radius (km)</label>
                                            <input
                                                type="number"
                                                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white focus:border-purple-500 outline-none"
                                                value={editForm.radius}
                                                onChange={e => setEditForm({ ...editForm, radius: Number(e.target.value) })}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex justify-between">
                                            <span>Custom Boundary (GeoJSON Points)</span>
                                            <a href="https://geojson.io" target="_blank" className="text-blue-400 hover:underline">GeoJSON Tool ↗</a>
                                        </label>
                                        <p className="text-[10px] text-slate-400 mb-2">
                                            Format: `[[lat, lng], [lat, lng], ...]` (Simple Polygon) OR GeoJSON Feature.
                                            Ideally provide the raw coordinate array `[[lat,lon],...]`.
                                        </p>
                                        <textarea
                                            className="w-full h-40 bg-slate-900 border border-slate-700 rounded p-2 text-xs font-mono text-green-400 focus:border-purple-500 outline-none resize-y"
                                            value={editForm.boundary}
                                            onChange={e => setEditForm({ ...editForm, boundary: e.target.value })}
                                            placeholder='e.g. [[37.5, 127.0], [37.6, 127.0], ...]'
                                        />
                                    </div>
                                </>
                            )}
                            {!selectedNPC.building_id && (
                                <div className="p-4 bg-orange-900/20 border border-orange-900/50 rounded text-orange-200 text-sm">
                                    <AlertCircle size={16} className="inline mr-2" />
                                    This NPC has no Command Center. Boundaries cannot be set.
                                </div>
                            )}
                        </div>

                        <div className="p-6 border-t border-slate-800 flex justify-end gap-2 bg-[#0d1117]/50 rounded-b-xl">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="px-4 py-2 text-slate-400 hover:text-white font-bold"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                className="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded font-bold flex items-center gap-2 shadow-lg"
                            >
                                <Save size={16} /> Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function AlertCircle({ size, className }: { size?: number, className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width={size || 24} height={size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
    )
}
