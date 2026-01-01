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

    if (loading) return <div className="text-gray-500">Loading users...</div>;

    return (
        <div>
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
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
