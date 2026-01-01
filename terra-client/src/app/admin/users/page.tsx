"use client";

import { useEffect, useState } from "react";
import { AdminUser } from "@/types/admin";

export default function UsersPage() {
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("http://localhost:3001/api/admin/users")
            .then(res => res.json())
            .then(data => {
                setUsers(data as AdminUser[]);
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to fetch users", err);
                setLoading(false);
            });
    }, []);

    const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
    const [editForm, setEditForm] = useState<Partial<AdminUser>>({});
    const [notification, setNotification] = useState<string | null>(null);

    const handleEditClick = (user: AdminUser) => {
        setEditingUser(user);
        setEditForm({
            gold: user.gold,
            gem: user.gem,
            strength: user.strength,
            dexterity: user.dexterity,
            constitution: user.constitution,
            intelligence: user.intelligence,
            wisdom: user.wisdom,
            agility: user.agility
        });
    };

    const handleSave = () => {
        if (!editingUser) return;

        fetch(`http://localhost:3001/api/admin/users/${editingUser.id}/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(editForm)
        })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    setNotification(`User ${editingUser.username} updated successfully!`);
                    setEditingUser(null);
                    // Refresh list
                    setUsers(prev => prev.map(u => u.id === editingUser.id ? { ...u, ...editForm } : u));
                    setTimeout(() => setNotification(null), 3000);
                }
            })
            .catch(err => console.error(err));
    };

    if (loading) return <div className="text-gray-500">Loading users...</div>;

    return (
        <div className="relative">
            {notification && (
                <div className="fixed top-4 right-4 bg-green-500 text-black px-6 py-3 rounded shadow-lg font-bold z-50 animate-bounce">
                    {notification}
                </div>
            )}

            <h2 className="text-2xl font-bold mb-6 text-white">User Management</h2>
            <div className="overflow-x-auto bg-surface rounded-lg border border-surface-border">
                <table className="w-full text-left text-sm text-gray-400">
                    <thead className="bg-surface-light text-xs uppercase text-gray-200">
                        <tr>
                            <th className="px-6 py-3">ID</th>
                            <th className="px-6 py-3">Username</th>
                            <th className="px-6 py-3">Role</th>
                            <th className="px-6 py-3">Model</th>
                            <th className="px-6 py-3 text-yellow-400">Gold</th>
                            <th className="px-6 py-3 text-cyan-400">Gem</th>
                            <th className="px-6 py-3">STR</th>
                            <th className="px-6 py-3">DEX</th>
                            <th className="px-6 py-3">CON</th>
                            <th className="px-6 py-3">INT</th>
                            <th className="px-6 py-3">WIS</th>
                            <th className="px-6 py-3">AGI</th>
                            <th className="px-6 py-3">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-border">
                        {users.map(user => (
                            <tr key={user.id} className="hover:bg-surface-light/50 transition-colors">
                                <td className="px-6 py-4 font-mono">{user.id}</td>
                                <td className="px-6 py-4 text-white font-bold">{user.username}</td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded text-xs ${user.role === 'admin' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                                        {user.role}
                                    </span>
                                </td>
                                <td className="px-6 py-4">{user.cyborg_model || "-"}</td>
                                <td className="px-6 py-4 font-mono text-yellow-500">{user.gold?.toLocaleString()}</td>
                                <td className="px-6 py-4 font-mono text-cyan-500">{user.gem?.toLocaleString()}</td>
                                <td className="px-6 py-4">{user.strength}</td>
                                <td className="px-6 py-4">{user.dexterity}</td>
                                <td className="px-6 py-4">{user.constitution}</td>
                                <td className="px-6 py-4">{user.intelligence}</td>
                                <td className="px-6 py-4">{user.wisdom}</td>
                                <td className="px-6 py-4">{user.agility}</td>
                                <td className="px-6 py-4">
                                    <button
                                        onClick={() => handleEditClick(user)}
                                        className="text-cyan-400 hover:text-cyan-200 underline"
                                    >
                                        Edit
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Edit Modal */}
            {editingUser && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-surface border border-surface-border p-8 rounded-xl w-full max-w-2xl shadow-2xl">
                        <h3 className="text-xl font-bold text-white mb-6">Edit User: {editingUser.username}</h3>

                        <div className="grid grid-cols-2 gap-6 mb-8">
                            <div>
                                <h4 className="text-gray-400 text-sm uppercase mb-3">Resources</h4>
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">Gold</label>
                                        <input
                                            type="number"
                                            value={editForm.gold}
                                            onChange={e => setEditForm({ ...editForm, gold: Number(e.target.value) })}
                                            className="w-full bg-black/50 border border-slate-700 rounded px-3 py-2 text-yellow-500 font-mono"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">Gem</label>
                                        <input
                                            type="number"
                                            value={editForm.gem}
                                            onChange={e => setEditForm({ ...editForm, gem: Number(e.target.value) })}
                                            className="w-full bg-black/50 border border-slate-700 rounded px-3 py-2 text-cyan-500 font-mono"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <h4 className="text-gray-400 text-sm uppercase mb-3">Stats</h4>
                                <div className="grid grid-cols-2 gap-3">
                                    {['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'agility'].map(stat => (
                                        <div key={stat}>
                                            <label className="block text-xs text-gray-500 mb-1 capitalize">{stat.slice(0, 3)}</label>
                                            <input
                                                type="number"
                                                value={editForm[stat as keyof AdminUser] as number}
                                                onChange={e => setEditForm({ ...editForm, [stat]: Number(e.target.value) })}
                                                className="w-full bg-black/50 border border-slate-700 rounded px-3 py-2 text-white font-mono"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-4">
                            <button
                                onClick={() => setEditingUser(null)}
                                className="px-4 py-2 text-gray-400 hover:text-white"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-bold transition-colors"
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
