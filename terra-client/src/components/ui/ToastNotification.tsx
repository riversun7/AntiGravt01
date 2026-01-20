import { useEffect, useState } from 'react';

interface ToastNotificationProps {
    message: string;
    type?: 'info' | 'error' | 'success';
    show: boolean;
    onClose: () => void;
}

/**
 * @file ToastNotification.tsx
 * @description 개별 토스트 알림 메시지를 표시하는 단일 컴포넌트 (레거시/개별 사용)
 * @role 단순 메시지 표시 및 자동 닫힘 타이머 처리
 * @dependencies react
 * @status Deprecated (System-wide toast preferred)
 * 
 * @analysis
 * - `ToastSystem`이 도입되면서 직접 사용 빈도는 줄었으나, 간단한 로컬 알림이 필요할 때 사용 가능.
 * - 3초 후 자동 닫힘(setTimeout) 로직 포함.
 */
export default function ToastNotification({ message, type = 'info', show, onClose }: ToastNotificationProps) {
    useEffect(() => {
        if (show) {
            const timer = setTimeout(() => {
                onClose();
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [show, onClose]);

    if (!show) return null;

    const bgColors = {
        info: 'bg-slate-800',
        error: 'bg-red-900',
        success: 'bg-green-900',
    };

    const borderColors = {
        info: 'border-slate-600',
        error: 'border-red-500',
        success: 'border-green-500',
    };

    const textColors = {
        info: 'text-white',
        error: 'text-red-100',
        success: 'text-green-100',
    };

    return (
        <div className={`pointer-events-auto flex items-center gap-2 px-6 py-3 rounded-full shadow-lg backdrop-blur-md border border-white/10 transition-all ${bgColors[type]} ${borderColors[type]}`}>
            <span className={`font-medium text-sm whitespace-nowrap ${textColors[type]}`}>
                {message}
            </span>
        </div>
    );
}
