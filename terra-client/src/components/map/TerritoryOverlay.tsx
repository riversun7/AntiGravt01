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

        try {
            const results: any[] = [];

            // ✨ 가중치 기반 경계선 알고리즘 (Apollonius Circle 근사)
            territories.forEach((t) => {
                try {
                    const center = [Number(t.y), Number(t.x)]; // lng, lat
                    const radiusKm = t.territory_radius || 5.0;

                    // 1. 원본 Circle 생성
                    let finalPoly = turf.circle(center, radiusKm, {
                        steps: 64,
                        units: 'kilometers'
                    });

                    // 2. 겹치는 이웃 영토들 찾기
                    const overlappingNeighbors = territories.filter(other => {
                        if (other.id === t.id) return false;
                        const otherCenter = [Number(other.y), Number(other.x)];
                        const otherRadius = other.territory_radius || 5.0;
                        const distance = turf.distance(center, otherCenter, { units: 'kilometers' });
                        return distance < (radiusKm + otherRadius);
                    });

                    // 3. 각 이웃에 대해 반경 비율로 경계선 생성 및 자르기
                    overlappingNeighbors.forEach(neighbor => {
                        const neighborCenter = [Number(neighbor.y), Number(neighbor.x)];
                        const neighborRadius = neighbor.territory_radius || 5.0;

                        // Apollonius 경계점 계산
                        const d = turf.distance(center, neighborCenter, { units: 'kilometers' });
                        const ratio = radiusKm / (radiusKm + neighborRadius);
                        const cutDistance = d * ratio;

                        // center에서 neighbor 방향으로 cutDistance만큼 이동
                        const bearing = turf.bearing(center, neighborCenter);
                        const cutPoint = turf.destination(center, cutDistance, bearing, { units: 'kilometers' });

                        // cutPoint를 지나고 연결선에 수직인 선으로 Half-Plane 생성
                        const perpBearing = bearing + 90;
                        const lineLength = 500; // 충분히 긴 거리 (km)

                        // 수직선의 양 끝점
                        const p1 = turf.destination(cutPoint, lineLength, perpBearing, { units: 'kilometers' });
                        const p2 = turf.destination(cutPoint, lineLength, perpBearing + 180, { units: 'kilometers' });

                        // center 방향 (뒤쪽)으로 확장한 점들
                        const backBearing = bearing + 180;
                        const p3 = turf.destination(p1, lineLength * 2, backBearing, { units: 'kilometers' });
                        const p4 = turf.destination(p2, lineLength * 2, backBearing, { units: 'kilometers' });

                        // Half-Plane 폴리곤 (t의 영역을 유지하는 쪽)
                        const halfPlane = turf.polygon([[
                            turf.getCoord(p1),
                            turf.getCoord(p2),
                            turf.getCoord(p4),
                            turf.getCoord(p3),
                            turf.getCoord(p1) // 닫기
                        ]]);

                        // 원과 Half-Plane의 교집합
                        const clipped = turf.intersect(
                            turf.featureCollection([finalPoly, halfPlane])
                        );

                        if (clipped) {
                            finalPoly = clipped as any;
                        }
                    });

                    // 4. Leaflet 좌표로 변환
                    const coords = finalPoly.geometry.coordinates;
                    const flip = (ring: any[]) => ring.map((c: any) => [c[1], c[0]] as [number, number]);

                    let leafletPositions: [number, number][][] | [number, number][][][] = [];

                    if (finalPoly.geometry.type === 'Polygon') {
                        leafletPositions = coords.map(flip);
                    } else if (finalPoly.geometry.type === 'MultiPolygon') {
                        leafletPositions = coords.map((poly: any) => poly.map(flip));
                    }

                    const userId = String(t.user_id);
                    const isMine = userId === String(currentUserId);
                    const isNpc = t.npc_type === 'ABSOLUTE' || t.npc_type === 'FREE';

                    results.push({
                        id: t.id,
                        positions: leafletPositions,
                        color: t.color || (isMine ? '#00FFFF' : (isNpc ? '#FFA500' : '#FF4444')),
                        isMine,
                        ownerName: t.owner_name || `User ${t.user_id}`,
                        npcType: t.npc_type,
                        factionName: t.faction_name,
                        lat: t.x,
                        lng: t.y
                    });
                } catch (e) {
                    console.error(`Error processing territory ${t.id}:`, e);
                }
            });

            return results;

        } catch (e) {
            console.error("Critical Error in Territory Logic:", e);
            return [];
        }
    }, [territories, currentUserId]);


    if (!renderData || renderData.length === 0) return null;

    return (
        <>
            {renderData.map((item) => (
                <Polygon
                    key={`terr-poly-${item.id}`}
                    positions={item.positions as any}
                    pathOptions={{
                        color: item.color,
                        fillColor: item.color,
                        fillOpacity: item.isMine ? 0.1 : 0.3, // Make visible!
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
                            {item.factionName && <div className="text-xs text-blue-300">{item.factionName}</div>}
                            <div className="text-[10px] mt-1 opacity-75">
                                {item.npcType ? `[${item.npcType}]` : '[PLAYER]'}
                                <br />
                                Click for info
                            </div>
                        </div>
                    </Tooltip>
                </Polygon>
            ))}
        </>
    );
}
