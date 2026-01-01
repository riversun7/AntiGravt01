"use client";

import { useEffect, useState } from "react";
import { Mail, Gift, Check, Clock, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface MailItem {
    id: number;
    title: string;
    content: string;
    items: string; // JSON
    is_claimed: number;
    created_at: string;
    scheduled_at: string;
}

export default function Mailbox() {
    const [isOpen, setIsOpen] = useState(false);
    const [mails, setMails] = useState<MailItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);

    useEffect(() => {
        const uid = localStorage.getItem("terra_user_id");
        setUserId(uid);
    }, []);

    const fetchMail = () => {
        if (!userId) return;
        setLoading(true);
        fetch(`http://localhost:3001/api/mail/${userId}`)
            .then(res => res.json())
            .then(data => {
                setMails(data);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    };

    const handleOpen = () => {
        setIsOpen(true);
        fetchMail();
    };

    const handleClaim = (mail: MailItem) => {
        if (mail.is_claimed) return;

        fetch('http://localhost:3001/api/mail/claim', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mailId: mail.id, userId })
        })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    // Update Local State
                    setMails(prev => prev.map(m => m.id === mail.id ? { ...m, is_claimed: 1 } : m));
                    alert("Rewards Claimed!");
                } else {
                    alert("Failed: " + data.error);
                }
            });
    };

    const unreadCount = mails.filter(m => !m.is_claimed).length;

    return (
        <>
            <button
                onClick={handleOpen}
                className="relative flex items-center gap-2 px-3 py-2 bg-slate-800/80 hover:bg-slate-700 border border-slate-600 rounded text-cyan-400 text-xs font-bold transition-all shadow-sm"
            >
                <Mail size={16} /> MAIL
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center animate-pulse">
                        {unreadCount}
                    </span>
                )}
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg shadow-2xl flex flex-col max-h-[80vh]"
                        >
                            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/50 rounded-t-xl">
                                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                    <Mail className="text-cyan-400" /> Communications
                                </h3>
                                <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-white">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                {loading && <div className="text-center text-gray-500 py-4">Scanning frequencies...</div>}

                                {!loading && mails.length === 0 && (
                                    <div className="text-center text-gray-500 py-8">
                                        <Mail size={48} className="mx-auto mb-2 opacity-20" />
                                        No messages found.
                                    </div>
                                )}

                                {mails.map(mail => (
                                    <div key={mail.id} className={`p-4 rounded-lg border ${mail.is_claimed ? 'border-slate-800 bg-slate-900/50 opacity-60' : 'border-cyan-500/30 bg-cyan-950/20'}`}>
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <h4 className={`font-bold ${mail.is_claimed ? 'text-gray-400' : 'text-cyan-100'}`}>{mail.title}</h4>
                                                <div className="text-xs text-gray-500 flex items-center gap-2 mt-1">
                                                    <Clock size={10} /> {new Date(mail.created_at).toLocaleString()}
                                                </div>
                                            </div>
                                            {mail.is_claimed ? (
                                                <span className="text-xs bg-slate-800 text-gray-400 px-2 py-1 rounded flex items-center gap-1">
                                                    <Check size={10} /> Claimed
                                                </span>
                                            ) : (
                                                <span className="text-xs bg-red-900/40 text-red-300 border border-red-500/20 px-2 py-1 rounded animate-pulse">
                                                    NEW
                                                </span>
                                            )}
                                        </div>

                                        <p className="text-sm text-gray-300 mb-4 whitespace-pre-wrap">{mail.content}</p>

                                        {mail.items && mail.items !== '[]' && (
                                            <div className="bg-black/30 p-2 rounded border border-slate-800 flex items-center justify-between">
                                                <div className="flex flex-wrap gap-2">
                                                    {JSON.parse(mail.items).map((item: any, idx: number) => (
                                                        <span key={idx} className="text-xs text-yellow-400 bg-yellow-900/20 px-2 py-1 rounded border border-yellow-500/20">
                                                            {item.code} x{item.qty}
                                                        </span>
                                                    ))}
                                                </div>

                                                {!mail.is_claimed && (
                                                    <button
                                                        onClick={() => handleClaim(mail)}
                                                        className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded flex items-center gap-2"
                                                    >
                                                        <Gift size={12} /> COLLECT
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
