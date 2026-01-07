"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Cpu, Zap, Shield, ArrowRight, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import SystemMenu from "@/components/SystemMenu";
import { API_BASE_URL } from "@/lib/config";

const CYBORG_MODELS = [
    {
        id: "COMMANDER",
        name: "Tactical Commander",
        desc: "Optimized for unit management and strategic operations.",
        icon: <Cpu size={48} className="text-secondary" />,
        stats: { intelligence: "High", wisdom: "High", strength: "Low", agility: "Low", dexterity: "Low", constitution: "Medium" }
    },
    {
        id: "EXPLORER",
        name: "Frontier Scout",
        desc: "Enhanced mobility and sensory modules for deep exploration.",
        icon: <Zap size={48} className="text-primary" />,
        stats: { agility: "High", wisdom: "High", dexterity: "High", strength: "Low", intelligence: "Medium", constitution: "Low" }
    },
    {
        id: "BUILDER",
        name: "Heavy Constructor",
        desc: "Reinforced chassis for infrastructure development and defense.",
        icon: <Shield size={48} className="text-accent" />,
        stats: { strength: "High", constitution: "High", intelligence: "Medium", agility: "Low", wisdom: "Low", dexterity: "Medium" }
    }
];

export default function CreateCharacterPage() {
    const [selectedModel, setSelectedModel] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleInitialize = async () => {
        if (!selectedModel) return;
        const userId = localStorage.getItem("terra_user_id");
        if (!userId) return router.push("/login");

        setLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/user/${userId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ cyborg_model: selectedModel }),
            });

            if (!res.ok) throw new Error("Initialization failed");

            router.push("/character");
        } catch (err) {
            console.error(err);
            alert("Error: Core Initialization Failed");
        } finally {
            setLoading(false);
        }
    };

    // Check if already initialized
    useEffect(() => {
        const userId = localStorage.getItem("terra_user_id");
        if (userId) {
            fetch(`${API_BASE_URL}/api/user/${userId}`)
                .then(res => res.json())
                .then(data => {
                    if (data.cyborg_model) {
                        router.push("/character");
                    }
                });
        }
    }, [router]);

    return (
        <div className="min-h-screen bg-background text-white flex flex-col items-center justify-center p-4 relative">
            <div className="absolute top-4 left-4">
                <SystemMenu activePage="character" />
            </div>
            <div className="max-w-4xl w-full">
                <header className="text-center mb-12">
                    <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-4 text-transparent bg-clip-text bg-gradient-to-r from-primary via-white to-secondary">
                        CORE INITIALIZATION
                    </h1>
                    <p className="text-gray-400">Select your Cyborg Model to begin operations.</p>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                    {CYBORG_MODELS.map((model) => (
                        <motion.div
                            key={model.id}
                            whileHover={{ scale: 1.02 }}
                            className={`glass-card p-6 cursor-pointer border-2 transition-all relative overflow-hidden ${selectedModel === model.id ? "border-primary bg-primary/10 shadow-[0_0_30px_rgba(0,240,255,0.2)]" : "border-surface-border hover:border-white/20"}`}
                            onClick={() => setSelectedModel(model.id)}
                        >
                            <div className="flex justify-center mb-6">{model.icon}</div>
                            <h3 className="text-xl font-bold text-center mb-2">{model.name}</h3>
                            <p className="text-sm text-gray-400 text-center mb-6">{model.desc}</p>

                            <div className="space-y-2">
                                {Object.entries(model.stats).map(([key, value]) => (
                                    <div key={key} className="flex justify-between text-xs">
                                        <span className="uppercase text-gray-500">{key}</span>
                                        <span className="text-white font-mono">{value}</span>
                                    </div>
                                ))}
                            </div>

                            {selectedModel === model.id && (
                                <div className="absolute top-2 right-2">
                                    <div className="w-3 h-3 bg-primary rounded-full animate-pulse shadow-[0_0_10px_#00f0ff]" />
                                </div>
                            )}
                        </motion.div>
                    ))}
                </div>

                <div className="flex justify-center">
                    <button
                        disabled={!selectedModel || loading}
                        onClick={handleInitialize}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground text-lg font-bold py-4 px-12 rounded-full flex items-center gap-2 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(0,240,255,0.4)] hover:shadow-[0_0_40px_rgba(0,240,255,0.6)]"
                    >
                        {loading ? <Loader2 className="animate-spin" /> : <>START SYSTEM <ArrowRight /></>}
                    </button>
                </div>
            </div>
        </div>
    );
}
