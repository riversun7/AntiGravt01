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

/**
 * @file NpcCyborgMarkers.tsx
 * @description NPC(Non-Player Character) 및 사이보그의 위치를 지도에 표시
 * @role 서버로부터 NPC 위치를 받아오고, 이동 중인 NPC의 위치를 클라이언트에서 보간(Interpolate)하여 부드럽게 표시
 * @dependencies react-leaflet, leaflet, fetch API
 * @status Active
 */
export default function NpcCyborgMarkers({
    playerPosition,
    viewRangeKm,
    calculateDistance,
    onNpcClick,
    refreshKey = 0
}: NpcCyborgMarkersProps) {
    const [npcs, setNpcs] = useState<Npc[]>([]);
    const [loading, setLoading] = useState(true);

    // NPC 위치 데이터 조회
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

        // 60초마다 데이터 갱신 (서버 AI 틱 주기와 맞춤)
        const interval = setInterval(fetchNpcs, 60000);
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

// 이동 보간을 처리하는 별도의 컴포넌트
function InterpolatedNpcMarker({ npc, createIcon, onClick }: { npc: Npc, createIcon: (c: string, t: string) => L.DivIcon, onClick?: (n: Npc) => void }) {
    // requestAnimationFrame 대신 useMemo를 사용하여 위치 계산 (현재는 렌더링 시점에만 계산)
    // 개선사항: useAnimationFrame을 사용하여 실시간으로 부드럽게 움직이도록 변경 필요
    const position: [number, number] = useMemo(() => {
        // 위치 데이터 유효성 검사
        if (!npc.lat || !npc.lng || isNaN(npc.lat) || isNaN(npc.lng)) {
            console.error('[NPC MARKER] Invalid position data for', npc.cyborg_name);
            return [36.0, 127.0] as [number, number]; // Fallback (서울)
        }

        // 기본값: 현재(마지막으로 확인된) 위치
        const defaultPos: [number, number] = [npc.lat, npc.lng];

        // 이동 데이터가 없으면 정지 상태로 간주
        if (!npc.destination || !npc.start_pos || !npc.departure_time || !npc.arrival_time) {
            return defaultPos;
        }

        // 목적지 및 출발지 데이터 검증
        if (isNaN(npc.destination.lat) || isNaN(npc.destination.lng) ||
            isNaN(npc.start_pos.lat) || isNaN(npc.start_pos.lng)) {
            return defaultPos;
        }

        const start = new Date(npc.departure_time).getTime();
        const end = new Date(npc.arrival_time).getTime();
        const now = Date.now();

        // 시간 데이터 검증
        if (isNaN(start) || isNaN(end) || start >= end) {
            return defaultPos;
        }

        // 출발 전
        if (now < start) {
            return [npc.start_pos.lat, npc.start_pos.lng] as [number, number];
        }

        // 도착 후
        if (now >= end) {
            return [npc.destination.lat, npc.destination.lng] as [number, number];
        }

        // 이동 중: 선형 보간 (Linear Interpolation) 계산
        const progress = (now - start) / (end - start);
        const lat = npc.start_pos.lat + (npc.destination.lat - npc.start_pos.lat) * progress;
        const lng = npc.start_pos.lng + (npc.destination.lng - npc.start_pos.lng) * progress;

        // 계산된 위치 검증
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
