import { Circle, Polygon, Tooltip, Pane } from 'react-leaflet';
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
    npc_type?: string;
    faction_name?: string;
    type?: string;
    building_type_code?: string;
    level?: number;
}

interface TerritoryOverlayProps {
    territories: Territory[];
    currentUserId: string | null;
    onTerritoryClick?: (territory: Territory, e: any) => void;
}

export default function TerritoryOverlay({ territories, currentUserId, onTerritoryClick }: TerritoryOverlayProps) {

    const { commandCenters, beaconBorders } = useMemo(() => {
        if (!territories || territories.length === 0) {
            return { commandCenters: [], beaconBorders: [] };
        }

        // 사용자별로 그룹화
        const userGroups = new Map<string, Territory[]>();

        territories.forEach(t => {
            const key = String(t.user_id);
            if (!userGroups.has(key)) userGroups.set(key, []);
            userGroups.get(key)!.push(t);
        });

        const centers: any[] = [];
        const borders: any[] = [];

        // 각 사용자별 처리
        userGroups.forEach((userTerritories, userId) => {
            try {
                const first = userTerritories[0];
                const isMine = String(userId) === String(currentUserId);
                const isNpc = first.npc_type === 'ABSOLUTE' || first.npc_type === 'FREE';
                const color = first.color || (isMine ? '#00FFFF' : (isNpc ? '#FFA500' : '#FF4444'));

                // is_territory_center = 1인 모든 건물 찾기
                const territoryCenters = userTerritories.filter(t => t.is_territory_center === 1);

                // 사령부: COMMAND_CENTER 타입만
                const commandCenters = territoryCenters.filter(t =>
                    t.type === 'COMMAND_CENTER' ||
                    t.building_type_code === 'COMMAND_CENTER'
                );

                // 비콘: AREA_BEACON 타입만
                const beacons = territoryCenters.filter(t =>
                    t.type === 'AREA_BEACON' ||
                    t.building_type_code === 'AREA_BEACON'
                );

                // 기타 영토 건물 (사령부도 비콘도 아닌 것들)
                const otherTerritories = territoryCenters.filter(t =>
                    t.type !== 'COMMAND_CENTER' &&
                    t.building_type_code !== 'COMMAND_CENTER' &&
                    t.type !== 'AREA_BEACON' &&
                    t.building_type_code !== 'AREA_BEACON'
                );

                // 사령부 국경선 (2개 이상 있을 때 Concave Hull)
                if (commandCenters.length >= 2) {
                    const ccPoints = commandCenters
                        .map(cc => {
                            const lat = Number(cc.x);
                            const lng = Number(cc.y);
                            if (isNaN(lat) || isNaN(lng)) return null;
                            return turf.point([lng, lat]);
                        })
                        .filter(p => p !== null) as any[];

                    if (ccPoints.length >= 2) {
                        try {
                            const ccCollection = turf.featureCollection(ccPoints);
                            const ccHull = turf.concave(ccCollection, { maxEdge: 20, units: 'kilometers' }) ||
                                turf.convex(ccCollection); // Fallback to convex if concave fails

                            if (ccHull && ccHull.geometry.type === 'Polygon') {
                                const coords = ccHull.geometry.coordinates[0];
                                const positions = coords.map(c => [c[1], c[0]] as [number, number]);

                                borders.push({
                                    key: `cc-border-${userId}`,
                                    positions: [positions],
                                    color,
                                    isMine,
                                    isNpc,
                                    ownerName: first.owner_name || `User ${userId}`,
                                    factionName: first.faction_name,
                                    npcType: first.npc_type,
                                    beaconCount: commandCenters.length,
                                    borderType: 'command_center'
                                });
                            }
                        } catch (err) {
                            console.warn('Concave/Convex hull calculation failed for CCs', userId, err);
                        }
                    }
                }

                // 사령부 원형 렌더링 (국경선이 있어도 중심점 표시용)
                commandCenters.forEach(cc => {
                    const lat = Number(cc.x);
                    const lng = Number(cc.y);
                    const radius = cc.territory_radius || 5.0;

                    if (!isNaN(lat) && !isNaN(lng)) {
                        centers.push({
                            id: cc.id,
                            center: [lat, lng] as [number, number],
                            radius,
                            color,
                            isMine,
                            isNpc,
                            ownerName: cc.owner_name || `User ${userId}`,
                            factionName: cc.faction_name,
                            npcType: cc.npc_type,
                            buildingType: 'command_center'
                        });
                    }
                });

                // 기타 영토 건물도 원형으로 표시
                otherTerritories.forEach(ot => {
                    const lat = Number(ot.x);
                    const lng = Number(ot.y);
                    const radius = ot.territory_radius || 5.0;

                    if (!isNaN(lat) && !isNaN(lng)) {
                        centers.push({
                            id: ot.id,
                            center: [lat, lng] as [number, number],
                            radius,
                            color,
                            isMine,
                            isNpc,
                            ownerName: ot.owner_name || `User ${userId}`,
                            factionName: ot.faction_name,
                            npcType: ot.npc_type,
                            buildingType: ot.type || 'territory'
                        });
                    }
                });

                // 비콘 국경 렌더링 (3개 이상일 때만)
                if (beacons.length >= 3) {
                    // Concave Hull 계산
                    const points = beacons
                        .map(b => {
                            const lat = Number(b.x);
                            const lng = Number(b.y);
                            if (isNaN(lat) || isNaN(lng)) return null;
                            return turf.point([lng, lat]);
                        })
                        .filter(p => p !== null) as any[];

                    if (points.length >= 3) {
                        try {
                            const featureCollection = turf.featureCollection(points);
                            let hull = turf.concave(featureCollection, { maxEdge: 30, units: 'kilometers' }) ||
                                turf.convex(featureCollection); // Fallback

                            if (hull) {
                                // Foreign Territory Exclusion Logic
                                // 내 영토가 아닌 모든 영토(사령부/비콘)를 순회하며 겹치는 부분을 빼냄
                                territories.forEach(ft => {
                                    // 내 영토이거나, 영토 센터가 아니면 패스
                                    if (String(ft.user_id) === String(userId) || ft.is_territory_center !== 1) return;

                                    try {
                                        const fLat = Number(ft.x);
                                        const fLng = Number(ft.y);
                                        const fRadius = ft.territory_radius || 1.0;

                                        // 상대방 영토 Polygon 생성 (Circle)
                                        const fPoly = turf.circle([fLng, fLat], fRadius, { steps: 24, units: 'kilometers' });

                                        // 겹치지 않으면 연산 불필요 (성능 최적화)
                                        if (turf.booleanDisjoint(hull, fPoly)) return;

                                        // 차집합 연산 (Hull - Foreign)
                                        const diff = turf.difference(hull, fPoly);
                                        if (diff) {
                                            hull = diff;
                                        }
                                    } catch (err) {
                                        // 연산 실패 시 무시 (원본 유지)
                                    }
                                });

                                // 좌표 변환 (GeoJSON -> Leaflet)
                                // Handle Polygon and MultiPolygon
                                let leafPos: any[] = [];

                                const flipCoords = (ring: any[]) => ring.map(c => [c[1], c[0]]); // [lng, lat] -> [lat, lng]

                                if (hull.geometry.type === 'Polygon') {
                                    // Polygon: coordinates = [ [outer], [hole], ... ]
                                    leafPos = hull.geometry.coordinates.map(flipCoords);
                                } else if (hull.geometry.type === 'MultiPolygon') {
                                    // MultiPolygon: coordinates = [ [[outer],[hole]], ... ]
                                    leafPos = hull.geometry.coordinates.map((poly: any[]) => poly.map(flipCoords));
                                }

                                if (leafPos.length > 0) {
                                    borders.push({
                                        key: `beacon-border-${userId}`,
                                        positions: leafPos,
                                        color,
                                        isMine,
                                        isNpc,
                                        ownerName: first.owner_name || `User ${userId}`,
                                        factionName: first.faction_name,
                                        npcType: first.npc_type,
                                        beaconCount: beacons.length,
                                        borderType: 'beacon'
                                    });
                                }
                            }
                        } catch (err) {
                            console.warn('Hull calculation failed for beacons', userId, err);
                        }
                    }
                }

            } catch (e) {
                console.error('Error processing territory for user', userId, e);
            }
        });

        // Loop through borders and apply subtraction (Foreign Territory Exclusion)
        // We do this here to access the full scope of territories if needed, 
        // but actually we can do it inside the loop above if we have access to 'territories' array (we do).
        // Refactoring the loop above to include subtraction:

        // ... Wait, I will edit the code inside the loop directly in this ReplacementChunk ...
        // Re-implementing the beacon hull part with subtraction logic:

    } catch (e) {
        // console.error...
    }
});

// Retrying with correct placement inside the loop logic
// I will replace the "if (points.length >= 3)" block entirely.

return { commandCenters: centers, beaconBorders: borders };
    }, [territories, currentUserId]);

return (
    <>
        {/* Layer 1: 비콘 국경선 (하위 레이어, z-index 399) */}
        <Pane name="beacon-borders" style={{ zIndex: 399 }}>
            {beaconBorders.map((border) => (
                <Polygon
                    key={border.key}
                    positions={border.positions}
                    pathOptions={{
                        color: border.color,
                        fillColor: border.color,
                        fillOpacity: border.isMine ? 0.1 : 0.15,
                        weight: 2,
                        opacity: 0.7,
                        dashArray: border.isMine ? undefined : '8, 4'
                    }}
                    interactive={true}
                >
                    <Tooltip sticky direction="top">
                        <div className="text-center">
                            <strong>{border.ownerName}</strong>
                            {border.factionName && <div className="text-xs text-blue-300">{border.factionName}</div>}
                            <div className="text-[10px] mt-1 opacity-75">
                                {border.npcType ? `[${border.npcType}]` : '[PLAYER]'}
                                <br />
                                {border.borderType === 'command_center'
                                    ? `🏛️ 영토 국경 (${border.beaconCount} 사령부)`
                                    : `📡 확장 국경 (${border.beaconCount} 비콘)`
                                }
                            </div>
                        </div>
                    </Tooltip>
                </Polygon>
            ))}
        </Pane>

        {/* Layer 2: 사령부 절대 영역 (상위 레이어, z-index 400) */}
        <Pane name="command-centers" style={{ zIndex: 400 }}>
            {commandCenters.map((cc) => (
                <Circle
                    key={`cc-${cc.id}`}
                    center={cc.center}
                    radius={cc.radius * 1000} // km to meters
                    pathOptions={{
                        color: cc.color,
                        fillColor: cc.color,
                        fillOpacity: cc.isMine ? 0.35 : 0.4,
                        weight: cc.isMine ? 3 : 2,
                        opacity: 1,
                        dashArray: undefined
                    }}
                    interactive={true}
                    eventHandlers={{
                        click: (e) => {
                            L.DomEvent.stopPropagation(e.originalEvent);
                            const orig = territories.find(t => t.id === cc.id);
                            if (onTerritoryClick && orig) onTerritoryClick(orig, e);
                        }
                    }}
                >
                    <Tooltip sticky direction="top">
                        <div className="text-center">
                            <strong>{cc.ownerName}</strong>
                            {cc.factionName && <div className="text-xs text-blue-300">{cc.factionName}</div>}
                            <div className="text-[10px] mt-1 opacity-75">
                                {cc.npcType ? `[${cc.npcType}]` : '[PLAYER]'}
                                <br />
                                🏛️ 사령부 ({cc.radius}km 절대 영역)
                            </div>
                        </div>
                    </Tooltip>
                </Circle>
            ))}
        </Pane>
    </>
);
}
