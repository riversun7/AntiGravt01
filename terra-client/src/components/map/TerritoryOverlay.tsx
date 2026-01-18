import { Circle, Tooltip } from 'react-leaflet'; // Changed to Circle
import { useMemo } from 'react';
import * as L from 'leaflet';
// import * as turf from '@turf/turf'; // Turf no longer needed for Circles

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
    type?: string;
    level?: number;
}

interface TerritoryOverlayProps {
    territories: Territory[];
    currentUserId: string | null;
    onTerritoryClick?: (territory: Territory, e: any) => void;
}

export default function TerritoryOverlay({ territories, currentUserId, onTerritoryClick }: TerritoryOverlayProps) {
    // EMERGENCY FIX: Use <Circle> component directly.
    // Avoids Polygon coordinate formatting issues completely.

    const renderData = useMemo(() => {
        if (!territories || territories.length === 0) return [];

        const results: any[] = [];

        territories.forEach(t => {
            try {
                const lat = Number(t.x);
                const lng = Number(t.y);

                if (isNaN(lat) || isNaN(lng)) return;

                const userId = String(t.user_id);
                const isMine = userId === String(currentUserId);

                // For Circle, we just need center [lat, lng] and radius in meters.
                results.push({
                    id: t.id,
                    center: [lat, lng] as [number, number],
                    radius: (t.territory_radius || 5) * 1000, // KM -> Meters (Leaflet Circle uses meters)
                    color: t.color || (isMine ? '#00FFFF' : '#FF4444'),
                    isMine,
                    ownerName: t.owner_name || `User ${t.user_id}`,
                    npcType: t.npc_type
                });

            } catch (e) {
                console.error("Error generating circle for t=" + t.id, e);
            }
        });

        return results;
    }, [territories, currentUserId]);


    if (!renderData || renderData.length === 0) return null;

    return (
        <>
            {renderData.map((item) => (
                <Circle
                    key={`terr-circle-${item.id}`}
                    center={item.center}
                    radius={item.radius}
                    pathOptions={{
                        color: item.color,
                        fillColor: item.isMine ? 'transparent' : item.color,
                        fillOpacity: item.isMine ? 0 : 0.2,
                        weight: 2,
                        dashArray: item.isMine ? undefined : '5, 5'
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
                            <br />
                            <span className="text-xs">
                                {item.npcType === 'ABSOLUTE' ? 'City-State' : 'Territory (Circle)'}
                            </span>
                        </div>
                    </Tooltip>
                </Circle>
            ))}
        </>
    );
}
