"use client";

import { useEffect, useState, useMemo } from "react";
import { Marker, Popup } from "react-leaflet";
import L from "leaflet";

interface Npc {
    cyborg_id: number;
    user_id: number;
    cyborg_name: string;
    level: number;
    username: string;
    lat: number;
    lng: number;
    destination: { lat: number; lng: number } | null;
    start_pos: { lat: number; lng: number } | null;
    departure_time: string | null;
    arrival_time: string | null;
    npc_type: string;
    faction_name: string;
    faction_color: string;
    faction_id: number;
}

interface NpcCyborgMarkersProps {
    playerPosition: [number, number];
    viewRangeKm: number;
    calculateDistance: (lat1: number, lon1: number, lat2: number, lon2: number) => number;
    onNpcClick?: (npc: Npc) => void;
    refreshKey?: number;
}

export default function NpcCyborgMarkers({
    playerPosition,
    viewRangeKm,
    calculateDistance,
    onNpcClick,
    refreshKey = 0
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

        // Refresh every 5 seconds to show real-time changes
        // Refresh every 5 seconds to show real-time changes
        const interval = setInterval(fetchNpcs, 5000);
        return () => clearInterval(interval);
    }, [refreshKey]);

    // Filter NPCs by view range
    const visibleNpcs = useMemo(() => {
        return npcs.filter(npc => {
            const dist = calculateDistance(npc.lat, npc.lng, playerPosition[0], playerPosition[1]);
            return dist <= viewRangeKm;
        });
    }, [npcs, playerPosition, viewRangeKm, calculateDistance]);

    // Create custom icon for NPC
    const createNpcIcon = (color: string, npcType: string) => {
        const emoji = npcType === 'ABSOLUTE' ? '👑' : '🤖';
        return L.divIcon({
            html: `
                <div style="
                    position: relative;
                    width: 40px;
                    height: 40px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                ">
                    <div style="
                        position: absolute;
                        width: 36px;
                        height: 36px;
                        background: ${color};
                        border: 3px solid white;
                        border-radius: 50%;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.4);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 20px;
                    ">
                        ${emoji}
                    </div>
                </div>
            `,
            className: 'npc-cyborg-marker',
            iconSize: [40, 40],
            iconAnchor: [20, 20],
            popupAnchor: [0, -20]
        });
    };

    if (loading || visibleNpcs.length === 0) return null;

    return (
        <>
            {visibleNpcs.map(npc => (
                <InterpolatedNpcMarker
                    key={`npc-${npc.cyborg_id}`}
                    npc={npc}
                    createIcon={createNpcIcon}
                    onClick={onNpcClick}
                />
            ))}
        </>
    );
}

// Separate component for interpolated movement
function InterpolatedNpcMarker({ npc, createIcon, onClick }: { npc: Npc, createIcon: (c: string, t: string) => L.DivIcon, onClick?: (n: Npc) => void }) {
    const [position, setPosition] = useState<[number, number]>([npc.lat, npc.lng]);

    useEffect(() => {
        if (!npc.destination || !npc.start_pos || !npc.departure_time || !npc.arrival_time) {
            setPosition([npc.lat, npc.lng]);
            return;
        }

        const start = new Date(npc.departure_time).getTime();
        const end = new Date(npc.arrival_time).getTime();
        const duration = end - start;

        const animate = () => {
            const now = Date.now();
            const elapsed = now - start;
            const progress = Math.min(Math.max(elapsed / duration, 0), 1);

            if (progress >= 1) {
                setPosition([npc.destination!.lat, npc.destination!.lng]);
                return;
            }

            const lat = npc.start_pos!.lat + (npc.destination!.lat - npc.start_pos!.lat) * progress;
            const lng = npc.start_pos!.lng + (npc.destination!.lng - npc.start_pos!.lng) * progress;

            setPosition([lat, lng]);
            requestAnimationFrame(animate);
        };

        const animationId = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animationId);
    }, [npc]);

    return (
        <Marker
            position={position}
            icon={createIcon(npc.faction_color, npc.npc_type)}
            zIndexOffset={1000000} // Ensure NPCs are always on top of buildings (very high z-index)
            riseOnHover={true}
            bubblingMouseEvents={false}
            eventHandlers={{
                click: (e) => {
                    L.DomEvent.stopPropagation(e as any);
                    onClick?.(npc);
                }
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
                        Position: {position[0].toFixed(4)}, {position[1].toFixed(4)}
                    </div>
                </div>
            </Popup>
        </Marker>
    );
}
