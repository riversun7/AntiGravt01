"use client";

import { useToast, ToastType, Toast } from "@/context/ToastContext";
import { motion, AnimatePresence } from "framer-motion";
import { X, Info, CheckCircle, AlertTriangle, AlertOctagon } from "lucide-react";
import { useEffect } from "react";

const icons = {
    info: <Info size={20} className="text-cyan-400" />,
    success: <CheckCircle size={20} className="text-green-400" />,
    warning: <AlertTriangle size={20} className="text-yellow-400" />,
    error: <AlertOctagon size={20} className="text-red-400" />
};

const styles = {
    info: "bg-cyan-950/90 border-cyan-500/50 text-cyan-100",
    success: "bg-green-950/90 border-green-500/50 text-green-100",
    warning: "bg-yellow-950/90 border-yellow-500/50 text-yellow-100",
    error: "bg-red-950/90 border-red-500/50 text-red-100"
};

export default function ToastSystem() {
    const { toasts, removeToast } = useToast();

    return (
        <div className="fixed top-20 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
            <AnimatePresence>
                {toasts.map(toast => (
                    <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
                ))}
            </AnimatePresence>
        </div>
    );
}

function ToastItem({ toast, onClose }: { toast: Toast, onClose: () => void }) {
    // Sound Effect on Mount
    useEffect(() => {
        playSound(toast.type);
    }, [toast.type]);

    const handleClick = () => {
        if (toast.action?.onClick) {
            toast.action.onClick();
            onClose(); // Optional: close on action? Yes usually.
        } else {
            // Default behavior if no action? Maybe just close? 
            // Or do nothing? The 'X' closes it.
            // Let's keep specific close button for closing, 
            // and main click for action if exists.
        }
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, x: 50, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.9 }}
            className={`pointer-events-auto min-w-[300px] p-4 rounded-lg border shadow-xl backdrop-blur-md flex items-start gap-3 select-none ${styles[toast.type as ToastType]} ${toast.action ? 'cursor-pointer hover:brightness-110' : ''}`}
            onClick={handleClick}
        >
            <div className="mt-0.5 shrink-0">
                {icons[toast.type as ToastType]}
            </div>
            <div className="flex-1">
                <h4 className="font-bold text-sm">{toast.title}</h4>
                {toast.message && <p className="text-xs opacity-80 mt-1 whitespace-pre-wrap">{toast.message}</p>}

                {/* Visual Hint for Action */}
                {toast.action && (
                    <div className="mt-2 text-xs font-bold underline opacity-90">
                        {toast.action.label || "Click to Open"}
                    </div>
                )}
            </div>
            <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="text-white/50 hover:text-white">
                <X size={16} />
            </button>
        </motion.div>
    );
}

let audioCtx: AudioContext | null = null;

function getAudioContext() {
    if (typeof window === 'undefined') return null;
    if (!audioCtx) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContext) {
            audioCtx = new AudioContext();
        }
    }
    return audioCtx;
}

function playSound(type: ToastType) {
    try {
        const ctx = getAudioContext();
        if (!ctx) return;

        // If context is suspended (browser policy), try to resume
        if (ctx.state === 'suspended') {
            ctx.resume().catch(() => {
                // Ignore resume errors (likely blocked waiting for gesture)
            });
        }

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        const now = ctx.currentTime;

        if (type === 'success') {
            // High Ding
            osc.frequency.setValueAtTime(880, now); // A5
            osc.frequency.exponentialRampToValueAtTime(1760, now + 0.1); // A6
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.5);
            osc.start();
            osc.stop(now + 0.5);
        } else if (type === 'error') {
            // Low Buzz
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.linearRampToValueAtTime(100, now + 0.3);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.3);
            osc.start();
            osc.stop(now + 0.3);
        } else {
            // Info/Warning Beep (Original)
            osc.type = 'sine';
            osc.frequency.setValueAtTime(523.25, now); // C5
            osc.frequency.exponentialRampToValueAtTime(1046.5, now + 0.1); // C6
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.00001, now + 0.5);
            osc.start();
            osc.stop(now + 0.5);
        }

    } catch (e) {
        console.error("Sound error", e);
    }
}
