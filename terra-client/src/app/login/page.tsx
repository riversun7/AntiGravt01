"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Zap, ArrowRight, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

export default function LoginPage() {
    const [nickname, setNickname] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!nickname.trim()) return;

        setLoading(true);
        try {
            const res = await fetch("http://localhost:3001/api/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username: nickname, password }),
            });

            if (!res.ok) {
                if (res.status === 401) throw new Error("Invalid Credentials");
                throw new Error("Login failed");
            }

            const data = await res.json();

            // Simple Auth: Store ID in localStorage
            localStorage.setItem("terra_user_id", data.user.id);
            localStorage.setItem("terra_username", data.user.username);
            localStorage.setItem("terra_role", data.user.role);

            router.push("/dashboard");
        } catch (err) {
            console.error(err);
            alert("System Error: Connection Failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0 bg-background -z-20" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] -z-10" />

            <div className="w-full max-w-md">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-card p-8 border-primary/20"
                >
                    <div className="flex flex-col items-center gap-4 mb-8">
                        <div className="p-4 rounded-full bg-primary/10 border border-primary/30 text-primary shadow-[0_0_15px_rgba(0,240,255,0.3)]">
                            <Zap size={32} />
                        </div>
                        <h1 className="text-2xl font-bold tracking-wider text-center">ACCESS TERMINAL</h1>
                        <p className="text-gray-500 text-sm">Terra In-Cognita Network</p>
                    </div>

                    <form onSubmit={handleLogin} className="flex flex-col gap-6">
                        <div className="space-y-2">
                            <label className="text-xs uppercase tracking-widest text-primary font-semibold ml-1">Identity (Nickname)</label>
                            <input
                                type="text"
                                value={nickname}
                                onChange={(e) => setNickname(e.target.value)}
                                className="w-full bg-surface-light border border-surface-border focus:border-primary focus:ring-1 focus:ring-primary h-12 px-4 rounded-md text-white placeholder-gray-600 outline-none transition-all"
                                placeholder="Enter your codename..."
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs uppercase tracking-widest text-primary font-semibold ml-1">Access Code (Optional/Admin)</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-surface-light border border-surface-border focus:border-primary focus:ring-1 focus:ring-primary h-12 px-4 rounded-md text-white placeholder-gray-600 outline-none transition-all"
                                placeholder="Enter password if admin"
                            />
                        </div>

                        <button
                            disabled={loading}
                            className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-md flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wide"
                        >
                            {loading ? <Loader2 className="animate-spin" /> : <>Initialize <ArrowRight size={18} /></>}
                        </button>
                    </form>
                </motion.div>
            </div>
        </div>
    );
}
