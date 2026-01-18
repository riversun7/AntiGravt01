"use client";

import { useEffect, useState, useMemo } from "react";
import { CircleMarker, Popup } from "react-leaflet";

interface Npc {
    cyborg_id: number;
    user_id: number;
    cyborg_name: string;
    level: number;
    username: string;
    lat: number;
    lng: number;
    destination: { lat: number; lng: number } | null;
    npc_type: string;
    faction_name: string;
    faction_color: string;
    faction_id: number;
}

interface NpcCyborgMarkersProps {
    playerPosition: [number, number];
    viewRangeKm: number;
    calculateDistance: (lat1: number, lon1: number, lat2: number, lon2: number) => number;
}

export default function NpcCyborgMarkers({
    playerPosition,
    viewRangeKm,
    calculateDistance
}: NpcCyborgMarkersProps) {
    const [npcs, setNpcs] = useState<Npc[]>([]);
    const [loading, setLoading] = useState(true);

    // Fetch NPC positions
    useEffect(() => {
        const fetchNpcs = async () => {
            try {
                const response = await fetch(
                    `${typeof window !== 'undefined' ? window.location.origin : ''}/api/npcs`
                );
                const data = await response.json();
                setNpcs(data.npcs || []);
            } catch (error) {
                console.error('Failed to fetch NPCs:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchNpcs();

        // Refresh every 30 seconds to show NPC movement
        const interval = setInterval(fetchNpcs, 30000);
        return () => clearInterval(interval);
    }, []);

    // Filter NPCs by view range
    const visibleNpcs = useMemo(() => {
        return npcs.filter(npc => {
            const dist = calculateDistance(npc.lat, npc.lng, playerPosition[0], playerPosition[1]);
            return dist <= viewRangeKm;
        });
    }, [npcs, playerPosition, viewRangeKm, calculateDistance]);

    if (loading || visibleNpcs.length === 0) return null;

    return (
        <>
            {visibleNpcs.map(npc => (
                <CircleMarker
                    key={`npc-${npc.cyborg_id}`}
                    center={[npc.lat, npc.lng]}
                    radius={8}
                    pathOptions={{
                        fillColor: npc.faction_color,
                        color: '#FFFFFF',
                        weight: 2,
                        opacity: 1,
                        fillOpacity: 0.8
                    }}
                >
                    <Popup>
                        <div className="text-sm">
                            <div className="font-bold text-base mb-1">{npc.cyborg_name}</div>
                            <div className="text-gray-600">Level {npc.level} {npc.npc_type}</div>
                            <div className="mt-1" style={{ color: npc.faction_color }}>
                                {npc.faction_name}
                            </div>
                            {npc.destination && (
                                <div className="mt-2 text-xs text-blue-600">
                                    → Moving to {npc.destination.lat.toFixed(4)}, {npc.destination.lng.toFixed(4)}
                                </div>
                            )}
                            <div className="mt-1 text-xs text-gray-500">
                                Position: {npc.lat.toFixed(4)}, {npc.lng.toFixed(4)}
                            </div>
                        </div>
                    </Popup>
                </CircleMarker>
            ))}
        </>
    );
}
