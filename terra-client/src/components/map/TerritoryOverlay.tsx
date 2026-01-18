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

        // 1. Group by User
        const userGroups = new Map<string, Territory[]>();
        territories.forEach(t => {
            const key = String(t.user_id);
            if (!userGroups.has(key)) userGroups.set(key, []);
            userGroups.get(key)!.push(t);
        });

        // Data structure to hold Pass 1 results
        interface UserHullData {
            userId: string;
            isMine: boolean;
            isNpc: boolean;
            color: string;
            ownerName: string;
            factionName?: string;
            npcType?: string;

            // Command Centers
            commandCenters: Territory[];
            ccHull: any | null;

            // Beacons
            beacons: Territory[];
            beaconHull: any | null;
        }

        const userHulls = new Map<string, UserHullData>();
        const allCenters: any[] = [];

        // =========================================================
        // PASS 1: Generate Raw Hulls & Collect Circle Data
        // =========================================================
        userGroups.forEach((userTerritories, userId) => {
            try {
                const first = userTerritories[0];
                const isMine = String(userId) === String(currentUserId);
                const isNpc = first.npc_type === 'ABSOLUTE' || first.npc_type === 'FREE';
                const color = first.color || (isMine ? '#00FFFF' : (isNpc ? '#FFA500' : '#FF4444'));

                const territoryCenters = userTerritories.filter(t => t.is_territory_center === 1);

                const commandCentersList = territoryCenters.filter(t =>
                    t.type === 'COMMAND_CENTER' || t.building_type_code === 'COMMAND_CENTER'
                );
                const beaconsList = territoryCenters.filter(t =>
                    t.type === 'AREA_BEACON' || t.building_type_code === 'AREA_BEACON'
                );
                const otherList = territoryCenters.filter(t =>
                    t.type !== 'COMMAND_CENTER' && t.building_type_code !== 'COMMAND_CENTER' &&
                    t.type !== 'AREA_BEACON' && t.building_type_code !== 'AREA_BEACON'
                );

                // --- Generate CC Hull ---
                let ccHull: any = null;
                const ccPoints = commandCentersList.map(cc => {
                    const lat = Number(cc.x);
                    const lng = Number(cc.y);
                    return (!isNaN(lat) && !isNaN(lng)) ? turf.point([lng, lat]) : null;
                }).filter(p => p !== null) as any[];

                if (ccPoints.length >= 3) {
                    const fc = turf.featureCollection(ccPoints);
                    ccHull = turf.concave(fc, { maxEdge: 20, units: 'kilometers' }) || turf.convex(fc);
                }

                // --- Generate Beacon Hull ---
                let beaconHull: any = null;
                const beaconPoints = beaconsList.map(b => {
                    const lat = Number(b.x);
                    const lng = Number(b.y);
                    return (!isNaN(lat) && !isNaN(lng)) ? turf.point([lng, lat]) : null;
                }).filter(p => p !== null) as any[];

                if (beaconPoints.length >= 3) {
                    const fc = turf.featureCollection(beaconPoints) as any;
                    beaconHull = turf.concave(fc, { maxEdge: 30, units: 'kilometers' }) || turf.convex(fc);
                }

                // Store in Map
                userHulls.set(userId, {
                    userId, isMine, isNpc, color,
                    ownerName: first.owner_name || `User ${userId}`,
                    factionName: first.faction_name,
                    npcType: first.npc_type,
                    commandCenters: commandCentersList,
                    ccHull,
                    beacons: beaconsList,
                    beaconHull
                });

                // --- Prepare Render Data for Circles ---
                const addCircleData = (list: Territory[], bType: string) => {
                    list.forEach(item => {
                        const lat = Number(item.x);
                        const lng = Number(item.y);
                        if (!isNaN(lat) && !isNaN(lng)) {
                            allCenters.push({
                                id: item.id,
                                center: [lat, lng] as [number, number],
                                radius: item.territory_radius || 5.0,
                                color,
                                isMine,
                                isNpc,
                                ownerName: item.owner_name || `User ${userId}`,
                                factionName: item.faction_name,
                                npcType: item.npc_type,
                                buildingType: bType
                            });
                        }
                    });
                };

                addCircleData(commandCentersList, 'command_center');
                addCircleData(otherList, 'territory');

            } catch (e) {
                console.error('Error in Pass 1 for user', userId, e);
            }
        });

        // =========================================================
        // PASS 2: Subtract Foreign Hulls/Circles
        // =========================================================
        const finalBorders: any[] = [];

        userHulls.forEach((myData, myUserId) => {
            // Processing Beacon Hull (Expansion Territory)
            if (myData.beaconHull) {
                let processedHull = myData.beaconHull;

                // Subtract overlapping foreign territories
                userHulls.forEach((otherData, otherUserId) => {
                    if (myUserId === otherUserId) return; // Self

                    // 1. Subtract Foreign Beacon Hull (Priority: Connected Area)
                    if (otherData.beaconHull) {
                        try {
                            const diff = turf.difference(turf.featureCollection([processedHull, otherData.beaconHull]));
                            if (diff) {
                                processedHull = diff;
                                console.log(`[Hull] Subtracted beacon hull of user ${otherUserId} from user ${myUserId}`);
                            }
                        } catch (e) {
                            console.warn(`[Hull] Failed to subtract beacon hull: ${e}`);
                        }
                    } else {
                        // If no hull, subtract individual beacon circles
                        otherData.beacons.forEach(b => {
                            try {
                                const lat = Number(b.x);
                                const lng = Number(b.y);
                                const radius = b.territory_radius || 1.0;
                                const circle = turf.circle([lng, lat], radius, { steps: 24, units: 'kilometers' });
                                if (!turf.booleanDisjoint(processedHull, circle)) {
                                    const diff = turf.difference(turf.featureCollection([processedHull, circle]));
                                    if (diff) processedHull = diff;
                                }
                            } catch (e) { }
                        });
                    }

                    // 2. Subtract Foreign CC Hull (Absolute Priority)
                    if (otherData.ccHull) {
                        try {
                            const diff = turf.difference(turf.featureCollection([processedHull, otherData.ccHull]));
                            if (diff) {
                                processedHull = diff;
                                console.log(`[Hull] Subtracted CC hull of user ${otherUserId} from user ${myUserId}`);
                            }
                        } catch (e) {
                            console.warn(`[Hull] Failed to subtract CC hull: ${e}`);
                        }
                    } else {
                        // Subtract individual CC circles
                        otherData.commandCenters.forEach(cc => {
                            try {
                                const lat = Number(cc.x);
                                const lng = Number(cc.y);
                                const radius = cc.territory_radius || 5.0;
                                const circle = turf.circle([lng, lat], radius, { steps: 24, units: 'kilometers' });
                                if (!turf.booleanDisjoint(processedHull, circle)) {
                                    const diff = turf.difference(turf.featureCollection([processedHull, circle]));
                                    if (diff) processedHull = diff;
                                }
                            } catch (e) { }
                        });
                    }
                });

                // Convert to Leaflet Coords & Add to Borders
                try {
                    const flipCoords = (ring: any[]) => ring.map(c => [c[1], c[0]]);
                    let leafPos: any[] = [];

                    if (processedHull.geometry.type === 'Polygon') {
                        leafPos = processedHull.geometry.coordinates.map(flipCoords);
                    } else if (processedHull.geometry.type === 'MultiPolygon') {
                        leafPos = processedHull.geometry.coordinates.map((poly: any[]) => poly.map(flipCoords));
                    }

                    if (leafPos.length > 0) {
                        finalBorders.push({
                            key: `beacon-border-${myData.userId}`,
                            positions: leafPos,
                            color: myData.color,
                            isMine: myData.isMine,
                            isNpc: myData.isNpc,
                            ownerName: myData.ownerName,
                            factionName: myData.factionName,
                            npcType: myData.npcType,
                            beaconCount: myData.beacons.length,
                            borderType: 'beacon',
                            userId: myData.userId
                        });
                    }
                } catch (e) {
                    console.error("Error converting coords", e);
                }
            }

            // CC Hulls (Absolute)
            if (myData.ccHull) {
                try {
                    const flipCoords = (ring: any[]) => ring.map(c => [c[1], c[0]]);
                    let leafPos: any[] = [];
                    if (myData.ccHull.geometry.type === 'Polygon') {
                        leafPos = myData.ccHull.geometry.coordinates.map(flipCoords);
                    } else if (myData.ccHull.geometry.type === 'MultiPolygon') {
                        leafPos = myData.ccHull.geometry.coordinates.map((poly: any[]) => poly.map(flipCoords));
                    }

                    if (leafPos.length > 0) {
                        finalBorders.push({
                            key: `cc-border-${myData.userId}`,
                            positions: leafPos,
                            color: myData.color,
                            isMine: myData.isMine,
                            isNpc: myData.isNpc,
                            ownerName: myData.ownerName,
                            factionName: myData.factionName,
                            npcType: myData.npcType,
                            beaconCount: myData.commandCenters.length,
                            borderType: 'command_center',
                            userId: myData.userId
                        });
                    }
                } catch (e) { }
            }
        });

        return { commandCenters: allCenters, beaconBorders: finalBorders };
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
                                <div className="text-[9px] text-slate-400">UserID: {border.userId}</div>
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
                        interactive={false}
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
