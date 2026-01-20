"use client";

import { useEffect } from "react";

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("Global Error Caught:", error);
    }, [error]);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-red-500 gap-6 p-4">
            <div className="bg-red-900/20 p-8 rounded-lg border border-red-500/50 backdrop-blur-sm max-w-md w-full text-center shadow-xl shadow-red-900/20">
                <h2 className="text-3xl font-bold mb-2">⚠️ SYSTEM FAILURE</h2>
                <p className="text-gray-300 mb-6">Createical error detected in the neural interface.</p>

                <div className="bg-black/50 p-4 rounded text-left font-mono text-xs overflow-auto max-h-32 mb-6 border border-red-900/50">
                    {error.message || "Unknown Error Occurred"}
                    {error.digest && <div className="mt-2 text-gray-500">Digest: {error.digest}</div>}
                </div>

                <div className="flex gap-4 justify-center">
                    <button
                        onClick={() => reset()}
                        className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white rounded font-bold transition-all hover:scale-105 active:scale-95 shadow-lg shadow-red-900/50"
                    >
                        REBOOT SYSTEM
                    </button>
                    <button
                        onClick={() => window.location.href = '/'}
                        className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded font-bold transition-all"
                    >
                        RETURN TO HQ
                    </button>
                </div>
            </div>
        </div>
    );
}
