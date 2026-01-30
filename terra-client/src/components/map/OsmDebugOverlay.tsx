
import React, { useEffect, useState } from 'react';
import { Rectangle, useMap } from 'react-leaflet';
import L from 'leaflet';

interface TerrainPoint {
    lat: number;
    lng: number;
    type: string;
    elevation: number;
}

export default function OsmDebugOverlay({ enabled, center }: { enabled: boolean, center: [number, number] }) {
    const map = useMap();
    const [points, setPoints] = useState<{ point: { lat: number, lng: number }, terrain: TerrainPoint }[]>([]);

    useEffect(() => {
        if (!enabled) {
            setPoints([]);
            return;
        }

        const fetchTerrain = async () => {
            const bounds = map.getBounds();
            const center = map.getCenter();

            // Limit query to avoid overload
            try {
                // Increased radius to 30 (approx 6km box) to cover more area
                const res = await fetch(`/api/game/debug/terrain?lat=${center.lat}&lng=${center.lng}&radius=30`);
                const data = await res.json();
                if (data.points && data.terrains) {
                    const combined = data.points.map((p: any, i: number) => ({
                        point: p,
                        terrain: data.terrains[i]
                    }));
                    setPoints(combined);
                }
            } catch (e) {
                console.error("Debug fetch failed", e);
            }
        };

        fetchTerrain();
        const interval = setInterval(fetchTerrain, 3000); // 3s polling
        return () => clearInterval(interval);

    }, [enabled, map]);

    if (!enabled) return null;

    return (
        <>
            {points.map((item, idx) => {
                const size = 0.001; // ~100m
                const bounds: L.LatLngBoundsExpression = [
                    [item.point.lat - size / 2, item.point.lng - size / 2],
                    [item.point.lat + size / 2, item.point.lng + size / 2]
                ];

                let color = 'transparent';
                let opacity = 0.4;

                if (item.terrain.type === 'WATER') color = '#2563eb'; // Blue
                else if (item.terrain.type === 'MOUNTAIN') color = '#dc2626'; // Red
                else if (item.terrain.type === 'FOREST') color = '#16a34a'; // Green
                else if (item.terrain.type === 'CONCRETE') color = '#475569'; // Gray
                else if (item.terrain.type === 'DIRT') color = '#d97706'; // Orange
                else if (item.terrain.type === 'PLAIN') {
                    color = '#ffffff'; // White for Plain
                    opacity = 0.3; // More visible
                }

                if (color === 'transparent') return null;

                return (
                    <Rectangle
                        key={idx}
                        bounds={bounds}
                        pathOptions={{ color: color, weight: 0, fillOpacity: opacity, stroke: false }}
                    />
                );
            })}

            {/* Debug Legend */}
            <div className="leaflet-bottom leaflet-right" style={{ bottom: '20px', right: '10px', pointerEvents: 'auto' }}>
                <div className="bg-white/90 p-2 rounded shadow-lg text-xs font-bold text-black border border-gray-300">
                    <div className="mb-1 border-b pb-1">Terrain Debug</div>
                    <div className="flex items-center gap-2"><span className="w-3 h-3 bg-blue-600 block"></span> Water</div>
                    <div className="flex items-center gap-2"><span className="w-3 h-3 bg-red-600 block"></span> Mountain</div>
                    <div className="flex items-center gap-2"><span className="w-3 h-3 bg-green-600 block"></span> Forest</div>
                    <div className="flex items-center gap-2"><span className="w-3 h-3 bg-gray-600 block"></span> Urban</div>
                    <div className="flex items-center gap-2"><span className="w-3 h-3 bg-orange-600 block"></span> Dirt</div>
                    <div className="flex items-center gap-2"><span className="w-3 h-3 bg-gray-200 border border-gray-400 block"></span> Plain</div>
                </div>
            </div>
        </>
    );
}
