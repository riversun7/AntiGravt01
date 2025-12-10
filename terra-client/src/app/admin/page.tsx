"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Users, FileCode, Database, ArrowLeft } from "lucide-react";

interface AdminUser {
    id: number;
    username: string;
    role: string;
    cyborg_model: string;
    gold: number;
    gem: number;
    strength: number;
    agility: number;
    intelligence: number;
    wisdom: number;
    dexterity: number;
    constitution: number;
    last_login: string;
}

interface ServerFile {
    name: string;
    path: string;
}

export default function AdminPage() {
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [files, setFiles] = useState<ServerFile[]>([]);
    const [activeTab, setActiveTab] = useState<'USERS' | 'FILES'>('USERS');
    const router = useRouter();

    useEffect(() => {
        const role = localStorage.getItem("terra_role");
        if (role !== 'admin') {
            router.push("/dashboard");
            return;
        }

        fetch("http://localhost:3001/api/admin/users")
            .then(res => res.json())
            .then(data => setUsers(data as AdminUser[]));

        fetch("http://localhost:3001/api/admin/files")
            .then(res => res.json())
            .then(data => setFiles(data as ServerFile[]));
    }, [router]);

    return (
        <div className="min-h-screen bg-background text-white p-8 font-sans">
            <header className="flex items-center justify-between mb-8 border-b border-surface-border pb-4">
                <div className="flex items-center gap-4">
                    <button onClick={() => router.push("/dashboard")} className="p-2 hover:bg-surface-light rounded-full text-gray-400 hover:text-white">
                        <ArrowLeft size={20} />
                    </button>
                    <h1 className="text-2xl font-bold text-red-500 flex items-center gap-2">
                        <Database className="text-red-500" /> ADMIN CONSOLE
                    </h1>
                </div>
                <div className="flex gap-2">
                    <TabButton active={activeTab === 'USERS'} onClick={() => setActiveTab('USERS')} icon={<Users size={16} />} label="Users" />
                    <TabButton active={activeTab === 'FILES'} onClick={() => setActiveTab('FILES')} icon={<FileCode size={16} />} label="DB Files" />
                </div>
            </header>

            <main>
                {activeTab === 'USERS' && (
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
                )}

                {activeTab === 'FILES' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {files.map(file => (
                            <div key={file.name} className="bg-surface p-4 rounded-lg border border-surface-border flex items-center gap-4 hover:border-primary transition-colors cursor-pointer group">
                                <FileCode size={32} className="text-gray-500 group-hover:text-primary" />
                                <div>
                                    <p className="text-white font-bold">{file.name}</p>
                                    <p className="text-xs text-gray-500 font-mono">{file.path}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}

function TabButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-2 px-4 py-2 rounded-md font-bold transition-all ${active ? "bg-red-600 text-white shadow-lg" : "bg-surface-light text-gray-400 hover:text-white"}`}
        >
            {icon}
            <span>{label}</span>
        </button>
    )
}
