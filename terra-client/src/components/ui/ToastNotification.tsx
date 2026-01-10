import { useEffect, useState } from 'react';

interface ToastNotificationProps {
    message: string;
    type?: 'info' | 'error' | 'success';
    show: boolean;
    onClose: () => void;
}

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
