import { Circle, Tooltip, useMap, Pane } from 'react-leaflet';
import { useMemo, useState, useEffect } from 'react';
import * as L from 'leaflet';

export interface Territory {
    id: number;
    user_id: string | number;
    x: number; // lat
    y: number; // lng
    territory_radius: number; // km
    is_territory_center: number; // 1 or 0
    custom_boundary?: string; // JSON string of coordinates
    color?: string; // Hex color from server
    owner_name?: string;
    npc_type?: string;
    faction_name?: string;
    type?: string;
    level?: number;
}

interface TerritoryOverlayProps {
    territories: Territory[];
    currentUserId: string | null;
    onTerritoryClick?: (territory: Territory, e: any) => void;
}

export default function TerritoryOverlay({ territories, currentUserId, onTerritoryClick }: TerritoryOverlayProps) {
    // Gooey Effect를 위한 CSS 스타일 주입
    // Pane의 z-index와 filter 설정
    useEffect(() => {
        const style = document.createElement('style');
        style.innerHTML = `
            .leaflet-pane.leaflet-gooey-pane {
                z-index: 399; /* 오버레이보다 아래, 타일보다 위 */
                filter: url('#goo');
                opacity: 0.9;
            }
        `;
        document.head.appendChild(style);
        return () => {
            document.head.removeChild(style);
        };
    }, []);

    // 가장 기본적인 Circle 렌더링으로 복구하여 안정성 확보
    const renderData = useMemo(() => {
        if (!territories || territories.length === 0) return [];

        return territories.map(t => {
            try {
                const lat = Number(t.x);
                const lng = Number(t.y);
                const radiusKm = t.territory_radius || 5.0;

                if (isNaN(lat) || isNaN(lng)) return null;

                const userId = String(t.user_id);
                const isMine = userId === String(currentUserId);
                const isNpc = t.npc_type === 'ABSOLUTE' || t.npc_type === 'FREE';

                return {
                    id: t.id,
                    center: [lat, lng] as [number, number],
                    radius: radiusKm,
                    color: t.color || (isMine ? '#00FFFF' : (isNpc ? '#FFA500' : '#FF4444')),
                    isMine,
                    ownerName: t.owner_name || `User ${t.user_id}`,
                    npcType: t.npc_type,
                    factionName: t.faction_name
                };
            } catch (e) {
                return null;
            }
        }).filter(item => item !== null) as any[];
    }, [territories, currentUserId]);

    return (
        <>
            {/* SVG Filter Definition (Invisible) */}
            <svg style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }}>
                <defs>
                    <filter id="goo">
                        {/* Blur the shapes */}
                        <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
                        {/* Contrast to sharpen edges */}
                        <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" result="goo" />
                        {/* Original colors interaction */}
                        <feBlend in="SourceGraphic" in2="goo" />
                    </filter>
                </defs>
            </svg>

            <Pane name="gooey" style={{ zIndex: 399 }}>
                {renderData.map((item) => (
                    <Circle
                        key={`terr-circle-${item.id}`}
                        center={item.center}
                        radius={item.radius * 1000} // km to meters
                        pathOptions={{
                            color: 'transparent', // 테두리 없음
                            fillColor: item.color,
                            fillOpacity: 1.0, // 필터를 위해 불투명하게 시작 (나중에 흐려짐)
                        }}
                        interactive={true}
                        eventHandlers={{
                            click: (e) => {
                                L.DomEvent.stopPropagation(e.originalEvent);
                                const orig = territories.find(t => t.id === item.id);
                                if (onTerritoryClick && orig) onTerritoryClick(orig, e);
                            }
                        }}
                    >
                        <Tooltip sticky direction="top">
                            <div className="text-center">
                                <strong>{item.ownerName}</strong>
                                {item.factionName && <div className="text-xs text-blue-300">{item.factionName}</div>}
                                <div className="text-[10px] mt-1 opacity-75">
                                    {item.npcType ? `[${item.npcType}]` : '[PLAYER]'}
                                    <br />
                                    {item.radius}km 영토
                                </div>
                            </div>
                        </Tooltip>
                    </Circle>
                ))}
            </Pane>
        </>
    );
}
