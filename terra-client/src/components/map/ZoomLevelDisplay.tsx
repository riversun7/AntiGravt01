"use client";

import { useEffect, useState } from 'react';
import { useMap } from 'react-leaflet';

interface ZoomLevelDisplayProps {
    onZoomChange?: (zoom: number) => void;
}

/**
 * Display current zoom level with min/max bounds
 * Updates in real-time as user zooms
 */
export default function ZoomLevelDisplay({ onZoomChange }: ZoomLevelDisplayProps) {
    const map = useMap();
    const [zoom, setZoom] = useState(map.getZoom());
    const [minZoom] = useState(map.getMinZoom());
    const [maxZoom] = useState(map.getMaxZoom());

    useEffect(() => {
        const handleZoom = () => {
            const currentZoom = map.getZoom();
            setZoom(currentZoom);
            onZoomChange?.(currentZoom);
        };

        // Initial call
        handleZoom();

        // Listen to zoom events
        map.on('zoom', handleZoom);
        map.on('zoomend', handleZoom);

        return () => {
            map.off('zoom', handleZoom);
            map.off('zoomend', handleZoom);
        };
    }, [map, onZoomChange]);

    return (
        <div className="absolute top-4 right-4 z-[1000] pointer-events-none">
            <div className="bg-black/80 border border-cyan-500/50 rounded px-3 py-2 backdrop-blur-sm">
                <div className="text-xs text-gray-400 font-mono mb-1">ZOOM LEVEL</div>
                <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-cyan-400 font-mono">
                        {zoom}
                    </span>
                    <span className="text-sm text-gray-500 font-mono">
                        / {maxZoom}
                    </span>
                </div>
                <div className="mt-1 h-1 bg-gray-800 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-cyan-500 to-green-400 transition-all duration-200"
                        style={{
                            width: `${((zoom - minZoom) / (maxZoom - minZoom)) * 100}%`,
                        }}
                    />
                </div>
            </div>
        </div>
    );
}
