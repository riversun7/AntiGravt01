"use client";

import { useState, useEffect, useMemo } from "react";
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
    }, [npcs, playerPosition, viewRangeKm]); // Remove calculateDistance from deps

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
    // Calculate position using useMemo instead of requestAnimationFrame
    const position: [number, number] = useMemo(() => {
        // Validate position data first
        if (!npc.lat || !npc.lng || isNaN(npc.lat) || isNaN(npc.lng)) {
            console.error('[NPC MARKER] Invalid position data for', npc.cyborg_name);
            return [36.0, 127.0] as [number, number]; // Fallback to Seoul
        }

        // Default to current position
        const defaultPos: [number, number] = [npc.lat, npc.lng];

        // Check if NPC has valid movement data
        if (!npc.destination || !npc.start_pos || !npc.departure_time || !npc.arrival_time) {
            return defaultPos;
        }

        // Validate destination and start_pos
        if (isNaN(npc.destination.lat) || isNaN(npc.destination.lng) ||
            isNaN(npc.start_pos.lat) || isNaN(npc.start_pos.lng)) {
            return defaultPos;
        }

        const start = new Date(npc.departure_time).getTime();
        const end = new Date(npc.arrival_time).getTime();
        const now = Date.now();

        // Validate timestamps
        if (isNaN(start) || isNaN(end) || start >= end) {
            return defaultPos;
        }

        // If journey hasn't started yet
        if (now < start) {
            return [npc.start_pos.lat, npc.start_pos.lng] as [number, number];
        }

        // If journey has ended
        if (now >= end) {
            return [npc.destination.lat, npc.destination.lng] as [number, number];
        }

        // Calculate interpolated position
        const progress = (now - start) / (end - start);
        const lat = npc.start_pos.lat + (npc.destination.lat - npc.start_pos.lat) * progress;
        const lng = npc.start_pos.lng + (npc.destination.lng - npc.start_pos.lng) * progress;

        // Validate calculated position
        if (isNaN(lat) || isNaN(lng)) {
            console.error('[NPC MARKER] Calculation produced NaN for', npc.cyborg_name);
            return defaultPos;
        }

        return [lat, lng] as [number, number];
    }, [npc.lat, npc.lng, npc.destination, npc.start_pos, npc.departure_time, npc.arrival_time]);



    return (
        <Marker
            position={position}
            icon={createIcon(npc.faction_color, npc.npc_type)}
            zIndexOffset={1000000}
            eventHandlers={{
                click: (e) => {
                    console.log('[MARKER CLICK]', npc.npc_type, npc.cyborg_name);
                    // Stop ALL event propagation immediately
                    if (e.originalEvent) {
                        e.originalEvent.preventDefault();
                        e.originalEvent.stopPropagation();
                        e.originalEvent.stopImmediatePropagation();
                    }
                    L.DomEvent.stopPropagation(e as any);
                    L.DomEvent.preventDefault(e as any);

                    if (onClick) {
                        onClick(npc);
                    }
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
