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
    // Group territories by user and create geometric unions
    const mergedTerritories = useMemo(() => {
        if (!territories || territories.length === 0) return [];

        // 1. Prepare Points for Voronoi
        // Voronoi requires unique points. We handle duplicates by adding slight random noise if needed, 
        // but ideally game logic prevents exact overlapping buildings.
        const points = turf.featureCollection(
            territories.map(t => turf.point([t.y, t.x], { id: t.id })) // [lng, lat]
        );

        // Calculate BBox for Voronoi (World bounds or slightly larger than all points)
        // Using a generous bbox ensures edge territories aren't cut off artificially
        const bbox = turf.bbox(points);
        // Expand bbox significantly to ensure voronoi cells cover the max possible radius (e.g. 100km)
        const expandedBbox: [number, number, number, number] = [
            bbox[0] - 10, bbox[1] - 10,
            bbox[2] + 10, bbox[3] + 10
        ];

        let voronoiPolygons: any;
        try {
            voronoiPolygons = turf.voronoi(points, { bbox: expandedBbox });
        } catch (e) {
            console.warn("Voronoi generation failed", e);
            // Fallback: Continue without voronoi clipping (just overlaps)
            voronoiPolygons = { features: [] };
        }

        // Map territory ID to its Voronoi polygon
        const voronoiMap = new Map<number, any>();
        if (voronoiPolygons && voronoiPolygons.features) {
            voronoiPolygons.features.forEach((f: any) => {
                if (f && f.properties && f.properties.id) {
                    voronoiMap.set(f.properties.id, f);
                }
            });
        }

        // 1.5 Pre-calculate Base Polygons and Cores
        // "Base": The full circle/shape.
        // "Core": The part of the base that falls within its own Voronoi cell. 
        //         This is the "unchallangeable" heart of the territory vs neighbors.
        const precalc = territories.map(t => {
            try {
                // A. Base Shape
                let basePolygon: any;
                if (t.custom_boundary) {
                    try {
                        const parsed = JSON.parse(t.custom_boundary);
                        const coords = [...parsed];
                        if (coords.length >= 3) {
                            if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1]) {
                                coords.push(coords[0]);
                            }
                            basePolygon = turf.polygon([[...coords.map((c: [number, number]) => [c[1], c[0]])]]);
                        }
                    } catch (e) { /* ignore */ }
                }

                if (!basePolygon) {
                    const center = turf.point([t.y, t.x]);
                    basePolygon = turf.circle(center, t.territory_radius, { steps: 32, units: 'kilometers' });
                }

                if (!basePolygon) return null;

                // B. Core Shape (Base Intesect Voronoi)
                // This represents the territory's "Fair Share" of space.
                const voronoiCell = voronoiMap.get(t.id);
                let corePolygon = basePolygon;

                if (voronoiCell) {
                    try {
                        const intersection = turf.intersect(turf.featureCollection([basePolygon, voronoiCell]));
                        if (intersection) {
                            corePolygon = intersection;
                        }
                    } catch (err) { }
                }

                return { ...t, basePolygon, corePolygon };
            } catch (e) { return null; }
        }).filter(t => t !== null) as any[];


        // 2. Subtract Enemy Cores from My Base
        // Instead of limiting myself to my Voronoi cell (which cuts me in half if neighbor is close),
        // I keep my FULL circle, but I subtract the "Core" of any enemy that overlaps me.
        // This means if I am Huge and enemy is Small, I engulf them, except for their tiny core.
        // If we are equal, our cores meet at the middle, and we subtract each other's overlaps -> perfect split.

        const processedTerritories = precalc.map(me => {
            // Candidates to subtract: Enemy territories whose Core overlaps my Base
            // Optimization: BBox check first?

            let finalShape = me.basePolygon;

            try {
                // Iterate all others
                for (const other of precalc) {
                    if (me.id === other.id) continue;
                    if (String(me.user_id) === String(other.user_id)) continue; // Don't subtract friends

                    // Distance check for optimization
                    // Approx degree distance. 1 deg ~= 111km.
                    if (Math.abs(me.x - other.x) > 2 || Math.abs(me.y - other.y) > 2) continue;

                    // Subtract other's CORE from my BASE
                    // Why Core? because 'other' only has the right to claim its Core area. 
                    // It cannot claim space outside its Voronoi cell against me.

                    // Optimization: Check if other.core intersects my base
                    // Actually turf.difference is expensive. 
                    // We can just try difference.

                    // Important: If Diff fails, it returns null or the original.
                    const diff = turf.difference(turf.featureCollection([finalShape, other.corePolygon]));
                    if (diff) {
                        finalShape = diff;
                    }
                }
                return { ...me, geometry: finalShape };
            } catch (e) {
                console.error("Subtraction error", e);
                return { ...me, geometry: me.basePolygon };
            }
        });


        // 3. Group by User and Union
        const territoryGroups = new Map<string, typeof processedTerritories>();
        processedTerritories.forEach((t: any) => {
            const userId = String(t.user_id);
            if (!territoryGroups.has(userId)) territoryGroups.set(userId, []);
            territoryGroups.get(userId)!.push(t);
        });

        const merged: Array<{
            userId: string;
            polygon: [number, number][][];
            territories: Territory[];
            isMine: boolean;
            color: string;
            npcType?: string;
            ownerName?: string;
        }> = [];

        territoryGroups.forEach((userTerritories: any[], userId) => {
            const isMine = userId === String(currentUserId);
            const firstTerritory = userTerritories[0];
            const color = firstTerritory?.color || (isMine ? '#00FFFF' : '#FF4444');
            const npcType = firstTerritory?.npc_type;
            const ownerName = firstTerritory?.owner_name;

            try {
                // Simplify logic: Just union all geometries for this user
                // We already clipped them against neighbors via Voronoi.
                // Now unioning them removes internal boundaries between SAME user clips.

                const geoms = userTerritories.map(t => t.geometry);

                if (geoms.length === 0) return;

                let union = geoms[0];

                if (geoms.length > 1) {
                    // Batch union if possible? Turf union takes 2 usually.
                    // Loop accumulation
                    try {
                        for (let i = 1; i < geoms.length; i++) {
                            const fc: any = turf.featureCollection([union, geoms[i]]);
                            const res = turf.union(fc);
                            if (res) union = res;
                        }
                    } catch (e) {
                        console.error("Union failed for user", userId, e);
                        // Fallback: don't union, just push individual pieces? 
                        // Or just use the largest piece? 
                        // Realistically, if union fails, keeping them separate is better visuals than nothing.
                        // But implementation requires single multi-polygon logic below.
                    }
                }

                // Output conversion
                // Handle MultiPolygon and Polygon result from Union/Difference
                const polygons: any[] = [];
                if (union.geometry.type === 'Polygon') {
                    polygons.push(union.geometry.coordinates);
                } else if (union.geometry.type === 'MultiPolygon') {
                    union.geometry.coordinates.forEach((c: any) => polygons.push(c));
                }

                polygons.forEach(polyCoords => {
                    // Leaflet expects [lat, lng], Turf uses [lng, lat]
                    // Turf Polygon: [ [ [lng, lat], [lng, lat] ... ] (outer ring), [inner rings...] ]
                    const p = polyCoords[0].map((c: any) => [c[1], c[0]] as [number, number]);
                    merged.push({ userId, polygon: [p], territories: userTerritories, isMine, color, npcType, ownerName });
                });

            } catch (e) {
                console.error("Merge error", e);
            }
        });

        return merged;
    }, [territories, currentUserId]);

    if (!mergedTerritories || mergedTerritories.length === 0) return null;

    return (
        <>
            {mergedTerritories.map((merged, index) => {
                const firstTerritory = merged.territories[0];

                return (
                    <Polygon
                        key={`${merged.userId}-${index}`}
                        positions={merged.polygon}
                        interactive={true}
                        eventHandlers={{
                            click: (e) => {
                                L.DomEvent.stopPropagation(e.originalEvent);
                                if (onTerritoryClick && firstTerritory) {
                                    onTerritoryClick(firstTerritory, e);
                                }
                            }
                        }}
                        pathOptions={{
                            color: merged.color,
                            fillColor: merged.isMine ? 'transparent' : merged.color,
                            fillOpacity: merged.isMine ? 0 : (merged.npcType === 'ABSOLUTE' ? 0.3 : 0.15),
                            weight: merged.isMine ? 2 : 2,
                            dashArray: merged.isMine || merged.npcType === 'ABSOLUTE' ? undefined : '5, 5'
                        }}
                    >
                        <Tooltip sticky direction="top">
                            <div className="text-center">
                                <strong>{merged.ownerName || `User ${merged.userId}`}</strong>
                                <br />
                                <span className="text-xs">
                                    {merged.npcType === 'ABSOLUTE' ? 'City-State' :
                                        merged.territories.length > 1 ? `${merged.territories.length} Territories` : 'Territory'}
                                </span>
                            </div>
                        </Tooltip>
                    </Polygon>
                );
            })}
        </>
    );
}
