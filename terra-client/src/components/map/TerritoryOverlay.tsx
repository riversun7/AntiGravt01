import { Polygon, Tooltip } from 'react-leaflet';
import { useMemo } from 'react';
import * as L from 'leaflet';
import * as turf from '@turf/turf';

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
    npc_type?: string; // ABSOLUTE, FREE, PLAYER
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
    // Advanced Visualization: Voronoi Tessellation clipped by Max Radius Circles
    // This allows perfect 1:1 splitting of overlapping areas.

    const renderData = useMemo(() => {
        if (!territories || territories.length === 0) return [];

        const results: any[] = [];

        try {
            // D3 Delaunay를 dynamic import로 로드
            if (typeof window === 'undefined') return [];

            // Power Diagram 시뮬레이션: 각 영토에 대해 가중치 기반 폴리곤 생성
            territories.forEach((t, idx) => {
                const lat = Number(t.x);
                const lng = Number(t.y);
                const radiusKm = t.territory_radius || 5.0;

                if (isNaN(lat) || isNaN(lng)) return;

                // 1. 겹치는 이웃 찾기
                const neighbors = territories.filter(other => {
                    if (other.id === t.id) return false;
                    const otherLat = Number(other.x);
                    const otherLng = Number(other.y);
                    const otherRadius = other.territory_radius || 5.0;
                    const distance = turf.distance(
                        [lng, lat],
                        [otherLng, otherLat],
                        { units: 'kilometers' }
                    );
                    return distance < (radiusKm + otherRadius);
                });

                // 2. 원본 Circle 폴리곤 생성
                let boundaryPoly = turf.circle([lng, lat], radiusKm, {
                    steps: 64,
                    units: 'kilometers'
                });

                // 3. 각 이웃에 대해 Power Diagram 경계선 계산
                neighbors.forEach(neighbor => {
                    const neighborLat = Number(neighbor.x);
                    const neighborLng = Number(neighbor.y);
                    const neighborRadius = neighbor.territory_radius || 5.0;

                    // Power Diagram 공식: radical axis
                    // 경계선은 두 원에서 같은 "power"를 가지는 점들
                    // power(p, circle) = distance²(p, center) - radius²

                    const d = turf.distance([lng, lat], [neighborLng, neighborLat], { units: 'kilometers' });

                    // Radical axis 위치
                    const radicalDist = (d * d + radiusKm * radiusKm - neighborRadius * neighborRadius) / (2 * d);

                    // 경계선이 내 중심에서 radicalDist 떨어진 곳
                    const bearing = turf.bearing([lng, lat], [neighborLng, neighborLat]);
                    const cutPoint = turf.destination([lng, lat], radicalDist, bearing, { units: 'kilometers' });

                    // 경계선에 수직인 Half-Plane 생성
                    const perpBearing = bearing + 90;
                    const lineExt = 500; // km

                    const p1 = turf.destination(cutPoint, lineExt, perpBearing, { units: 'kilometers' });
                    const p2 = turf.destination(cutPoint, lineExt, perpBearing + 180, { units: 'kilometers' });
                    const p3 = turf.destination(p2, lineExt * 2, bearing + 180, { units: 'kilometers' });
                    const p4 = turf.destination(p1, lineExt * 2, bearing + 180, { units: 'kilometers' });

                    const halfPlane = turf.polygon([[
                        turf.getCoord(p1),
                        turf.getCoord(p2),
                        turf.getCoord(p3),
                        turf.getCoord(p4),
                        turf.getCoord(p1)
                    ]]);

                    // Clip
                    const clipped = turf.intersect(turf.featureCollection([boundaryPoly, halfPlane]));
                    if (clipped) {
                        boundaryPoly = clipped as any;
                    }
                });

                // 4. Leaflet 좌표로 변환
                const coords = boundaryPoly.geometry.coordinates;
                const flip = (ring: any[]) => ring.map((c: any[]) => [c[1], c[0]] as [number, number]);

                let positions: any = [];
                if (boundaryPoly.geometry.type === 'Polygon') {
                    positions = coords.map(flip);
                } else if (boundaryPoly.geometry.type === 'MultiPolygon') {
                    positions = coords.map((poly: any) => poly.map(flip));
                }

                const userId = String(t.user_id);
                const isMine = userId === String(currentUserId);
                const isNpc = t.npc_type === 'ABSOLUTE' || t.npc_type === 'FREE';

                results.push({
                    id: t.id,
                    positions,
                    color: t.color || (isMine ? '#00FFFF' : (isNpc ? '#FFA500' : '#FF4444')),
                    isMine,
                    ownerName: t.owner_name || `User ${t.user_id}`,
                    npcType: t.npc_type,
                    factionName: t.faction_name,
                    radius: radiusKm
                });

            });

        } catch (e) {
            console.error("Territory rendering error:", e);
        }

        return results;
    }, [territories, currentUserId]);


    return (
        <>
            {renderData.map((item) => (
                <Polygon
                    key={`terr-poly-${item.id}`}
                    positions={item.positions}
                    pathOptions={{
                        color: item.color,
                        fillColor: item.color,
                        fillOpacity: item.isMine ? 0.15 : 0.3,
                        weight: 2,
                        dashArray: item.isMine ? undefined : '5, 5'
                    }}
                    interactive={true}
                    eventHandlers={{
                        click: (e: any) => {
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
                                {item.radius}km (Power Diagram)
                            </div>
                        </div>
                    </Tooltip>
                </Polygon>
            ))}
        </>
    );
}
