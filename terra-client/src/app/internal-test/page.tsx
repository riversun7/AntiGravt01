"use client";

import { useState } from 'react';
import InternalBaseMap from '@/components/map/InternalBaseMap';

export default function InternalMapTestPage() {
    const [showMap, setShowMap] = useState(true);

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4 text-white">
            <h1 className="text-2xl font-bold">Internal Map Prototype Test</h1>
            <p className="text-gray-400">Testing isometric projection and rotation</p>

            <button
                onClick={() => setShowMap(true)}
                className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 rounded font-bold transition-all"
            >
                Open Internal Map
            </button>

            {showMap && (
                <InternalBaseMap
                    onClose={() => setShowMap(false)}
                    gridSize={15}
                />
            )}
        </div>
    );
}
