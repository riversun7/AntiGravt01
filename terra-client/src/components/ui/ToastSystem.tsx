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

/**
 * @file ToastSystem.tsx
 * @description 전역 알림(Toast) 메시지를 표시하는 컨테이너 컴포넌트
 * @role 알림 목록 렌더링, 애니메이션 처리, 사운드 효과 재생 관리
 * @dependencies ToastContext, framer-motion, lucide-react
 * @status Active
 */
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

/**
 * @component ToastItem
 * @description 개별 알림 메시지 컴포넌트
 * @role 등장/퇴장 애니메이션, 타입별 스타일/사운드 적용, 클릭 액션 처리
 */
function ToastItem({ toast, onClose }: { toast: Toast, onClose: () => void }) {
    // 마운트 시 효과음 재생
    useEffect(() => {
        playSound(toast.type);
    }, [toast.type]);

    const handleClick = () => {
        if (toast.action?.onClick) {
            toast.action.onClick();
            onClose(); // 액션 수행 후 닫기
        } else {
            // 액션이 없으면 클릭해도 닫히지 않고 X 버튼으로만 닫힘 (의도된 동작)
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

                {/* 액션 힌트 표시 */}
                {toast.action && (
                    <div className="mt-2 text-xs font-bold underline opacity-90">
                        {toast.action.label || "클릭하여 확인"}
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

// Lazy init
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

/**
 * @function playSound
 * @description 토스트 타입(성공, 에러 등)에 따라 Web Audio API로 효과음 재생
 * @note 브라우저의 오디오 정책(AudioContext suspended)에 대응하기 위해 사용자 인터랙션 후 resume() 시도 로직 포함.
 */
function playSound(type: ToastType) {
    try {
        const ctx = getAudioContext();
        if (!ctx) return;

        // Auto-resume if suspended (fix for Chrome warning)
        if (ctx.state === 'suspended') {
            ctx.resume().catch(() => { /* User interaction required later */ });
            // If resume fails (no interaction yet), we verify state before playing
            if (ctx.state === 'suspended') return;
        }

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        const now = ctx.currentTime;

        if (type === 'success') {
            // 성공: 높은 딩 소리 (High Ding)
            osc.frequency.setValueAtTime(880, now); // A5
            osc.frequency.exponentialRampToValueAtTime(1760, now + 0.1); // A6
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.5);
            osc.start();
            osc.stop(now + 0.5);
        } else if (type === 'error') {
            // 에러: 낮은 버즈 소리 (Low Buzz)
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.linearRampToValueAtTime(100, now + 0.3);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.3);
            osc.start();
            osc.stop(now + 0.3);
        } else {
            // 정보/경고: 일반 비프음 (Beep)
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
