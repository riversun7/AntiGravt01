"use client";

import { useEffect, useState, useRef } from "react";
import { Mail, Gift, Check, Clock, X, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { API_BASE_URL } from "@/lib/config";

interface MailItem {
    id: number;
    title: string;
    content: string;
    items: string; // JSON
    is_claimed: number;
    created_at: string;
    scheduled_at: string;
    expires_at: string | null;
}

import { useToast } from "@/context/ToastContext";

export default function Mailbox() {
    const { addToast } = useToast();
    const isFirstLoad = useRef(true);
    const prevMailsRef = useRef<MailItem[]>([]);
    const lastFetchRef = useRef<number>(0);
    const [isOpen, setIsOpen] = useState(false);
    const [mails, setMails] = useState<MailItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);

    useEffect(() => {
        const uid = localStorage.getItem("terra_user_id");
        setUserId(uid);
    }, []);

    const handleOpen = () => {
        setIsOpen(true);
        fetchMail();
    };

    const fetchMail = (silent = false) => {
        if (!userId) return;
        if (!silent) setLoading(true);
        fetch(`${API_BASE_URL}/api/mail/${userId}`)
            .then(res => res.json())
            .then(data => {
                lastFetchRef.current = Date.now();
                const prevMails = prevMailsRef.current;
                const unreadCount = data.filter((m: MailItem) => !m.is_claimed).length;

                // 1. First Load (Login) Notification
                if (isFirstLoad.current) {
                    isFirstLoad.current = false;
                    if (unreadCount > 0) {
                        addToast({
                            title: "Welcome Back",
                            message: `You have ${unreadCount} unread message(s).`,
                            type: "info",
                            duration: 5000,
                            action: {
                                label: "Open Mailbox",
                                onClick: handleOpen
                            }
                        });
                    }
                }
                // 2. New Mail Arrived (Polling)
                else if (data.length > prevMails.length) {
                    addToast({
                        title: "New Message Received!",
                        message: "A new secure transmission has arrived.",
                        type: "info",
                        duration: 8000,
                        action: {
                            label: "Open Mailbox",
                            onClick: handleOpen
                        }
                    });
                }

                // Update Refs and State
                prevMailsRef.current = data;
                setMails(data);
                if (!silent) setLoading(false);
            })
            .catch(err => {
                console.error(err);
                if (!silent) setLoading(false);
            });
    };

    // Optimized Polling: Fetch on mount + Window Focus (Throttled 10m)
    useEffect(() => {
        if (!userId) return;

        // 1. Initial Fetch
        fetchMail(true);

        // 2. Window Focus Handler
        const handleFocus = () => {
            const lastFetch = lastFetchRef.current;
            const now = Date.now();
            // Only fetch if > 10 minutes passed since last fetch to reduce load
            if (now - lastFetch > 10 * 60 * 1000) {
                console.log("[Mailbox] 10+ mins passed, re-fetching on focus...");
                fetchMail(true);
            }
        };

        window.addEventListener('focus', handleFocus);
        return () => window.removeEventListener('focus', handleFocus);
    }, [userId]);

    const handleClaim = (mail: MailItem) => {
        if (mail.is_claimed) return;

        fetch(`${API_BASE_URL}/api/mail/claim`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mailId: mail.id, userId })
        })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    // Update Local State
                    setMails(prev => prev.map(m => m.id === mail.id ? { ...m, is_claimed: 1 } : m));
                    addToast({
                        title: "Acquisition Verified",
                        message: "Resources have been transferred to your inventory.",
                        type: "success"
                    });
                } else {
                    addToast({
                        title: "Transaction Failed",
                        message: data.error,
                        type: "error"
                    });
                }
            });
    };

    const [activeTab, setActiveTab] = useState<'inbox' | 'history'>('inbox');

    const handleClaimAll = () => {
        const unclaimedWithItems = mails.filter(m => !m.is_claimed && m.items && m.items !== '[]');
        if (unclaimedWithItems.length === 0) return;

        fetch(`${API_BASE_URL}/api/mail/claim-all`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId })
        })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    setMails(prev => prev.map(m => (!m.is_claimed && (!m.expires_at || new Date(m.expires_at) > new Date())) ? { ...m, is_claimed: 1 } : m));
                    addToast({
                        title: "All Rewards Claimed",
                        message: `Successfully collected rewards from ${data.count} messages.`,
                        type: "success"
                    });
                }
            });
    };

    const handleDeleteClaimed = () => {
        fetch(`${API_BASE_URL}/api/mail/claimed`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId })
        })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    setMails(prev => prev.filter(m => !m.is_claimed));
                    addToast({
                        title: "History Cleared",
                        message: `Deleted ${data.deleted} archived messages.`,
                        type: "info"
                    });
                }
            });
    };

    const unreadCount = mails.filter(m => !m.is_claimed).length;

    return (
        <>
            {/* Local Toast Removed - Global System Active */}

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
                        className="fixed inset-0 z-[9999] bg-black/80 flex items-start justify-center pt-24 px-4"
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
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

                            <div className="flex border-b border-slate-800 bg-slate-950/30">
                                <button
                                    onClick={() => setActiveTab('inbox')}
                                    className={`flex-1 py-3 text-sm font-bold transition-colors relative ${activeTab === 'inbox' ? 'text-cyan-400 bg-cyan-950/10' : 'text-slate-500 hover:text-slate-300'}`}
                                >
                                    INBOX
                                    {unreadCount > 0 && (
                                        <span className="ml-2 bg-red-500 text-white text-[10px] px-1.5 rounded-full">{unreadCount}</span>
                                    )}
                                    {activeTab === 'inbox' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-500/50 shadow-[0_0_10px_rgba(34,211,238,0.5)]" />}
                                </button>
                                <button
                                    onClick={() => setActiveTab('history')}
                                    className={`flex-1 py-3 text-sm font-bold transition-colors relative ${activeTab === 'history' ? 'text-cyan-400 bg-cyan-950/10' : 'text-slate-500 hover:text-slate-300'}`}
                                >
                                    HISTORY
                                    {activeTab === 'history' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-500/50 shadow-[0_0_10px_rgba(34,211,238,0.5)]" />}
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 space-y-4 relative">
                                {loading && <div className="text-center text-gray-500 py-4">Scanning frequencies...</div>}

                                {!loading && (
                                    <>
                                        {/* Bulk Actions Header */}
                                        {activeTab === 'inbox' && mails.some(m => !m.is_claimed && m.items && m.items !== '[]') && (
                                            <div className="mb-4 flex justify-end">
                                                <button
                                                    onClick={handleClaimAll}
                                                    className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded flex items-center gap-2 shadow-lg shadow-cyan-900/20 transition-all"
                                                >
                                                    <Gift size={14} /> CLAIM ALL REWARDS
                                                </button>
                                            </div>
                                        )}
                                        {activeTab === 'history' && mails.some(m => m.is_claimed) && (
                                            <div className="mb-4 flex justify-end">
                                                <button
                                                    onClick={handleDeleteClaimed}
                                                    className="px-3 py-1.5 bg-red-900/30 hover:bg-red-900/50 border border-red-900/50 text-red-400 text-xs font-bold rounded flex items-center gap-2 transition-all"
                                                >
                                                    <Trash2 size={14} /> CLEAR HISTORY
                                                </button>
                                            </div>
                                        )}

                                        {/* Mail List */}
                                        {mails.filter(m => activeTab === 'inbox' ? !m.is_claimed : m.is_claimed).length === 0 && (
                                            <div className="text-center text-gray-500 py-12 flex flex-col items-center">
                                                <Mail size={48} className="mb-4 opacity-10" />
                                                <p className="text-sm">No {activeTab} messages found.</p>
                                            </div>
                                        )}

                                        {mails
                                            .filter(m => activeTab === 'inbox' ? !m.is_claimed : m.is_claimed)
                                            .map(mail => (
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
                                                        <div className="bg-black/30 p-2 rounded border border-slate-800 flex flex-wrap gap-2 mb-3">
                                                            {JSON.parse(mail.items).map((item: { code: string; qty: number }, idx: number) => (
                                                                <span key={idx} className="text-xs text-yellow-400 bg-yellow-900/20 px-2 py-1 rounded border border-yellow-500/20">
                                                                    {item.code} x{item.qty}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {!mail.is_claimed && (
                                                        <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-800/50">
                                                            <div className="text-xs text-orange-400 font-mono">
                                                                {mail.expires_at && (
                                                                    <span className="flex items-center gap-1">
                                                                        <Clock size={10} /> Expires: {new Date(mail.expires_at).toLocaleDateString()}
                                                                    </span>
                                                                )}
                                                            </div>

                                                            <button
                                                                onClick={() => handleClaim(mail)}
                                                                className={`px-4 py-2 text-white text-xs font-bold rounded flex items-center gap-2 transition-all ${(mail.items && mail.items !== '[]')
                                                                    ? 'bg-cyan-600 hover:bg-cyan-500 shadow-lg shadow-cyan-900/20'
                                                                    : 'bg-slate-700 hover:bg-slate-600'
                                                                    }`}
                                                            >
                                                                {(mail.items && mail.items !== '[]')
                                                                    ? <><Gift size={14} /> CLAIM REWARDS</>
                                                                    : <><Check size={14} /> MARK READ</>}
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                    </>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
