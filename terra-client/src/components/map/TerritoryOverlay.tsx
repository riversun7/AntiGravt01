import { Polygon, Tooltip } from 'react-leaflet';
import { useMemo } from 'react';
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
    // Parsed cache
    _boundaryPoints?: [number, number][]; // Flattened ring for logic
    _rawBoundary?: any; // Leaflet format for render
}

interface TerritoryOverlayProps {
    territories: Territory[];
    currentUserId: string | null;
    onTerritoryClick?: (territory: Territory, e: any) => void;
}

export default function TerritoryOverlay({ territories, currentUserId, onTerritoryClick }: TerritoryOverlayProps) {
    // Pre-process territories to parse boundaries once
    const processedTerritories = useMemo(() => {
        if (!territories) return [];
        return territories.map(t => {
            if (t.custom_boundary) {
                try {
                    const parsed = JSON.parse(t.custom_boundary);
                    let ring: [number, number][] = [];

                    if (Array.isArray(parsed[0]) && typeof parsed[0][0] === 'number') {
                        ring = parsed as [number, number][];
                    } else if (Array.isArray(parsed[0]) && Array.isArray(parsed[0][0])) {
                        ring = parsed[0] as [number, number][];
                    } else {
                        ring = parsed as any;
                    }

                    return { ...t, _boundaryPoints: ring, _rawBoundary: parsed };
                } catch (e) {
                    console.error("Bound parse err", e);
                    return t;
                }
            }
            return t;
        });
    }, [territories]);

    if (!processedTerritories || processedTerritories.length === 0) return null;

    return (
        <>
            {processedTerritories.map((t) => {
                const isMine = String(t.user_id) === String(currentUserId);
                // Use server color if available, else fallback
                const color = t.color || (isMine ? '#00FFFF' : '#FF4444');

                // Calculate geometry
                let positions: any = [];
                if (t._rawBoundary) {
                    positions = t._rawBoundary;
                } else {
                    positions = calculateClippedTerritory(t, processedTerritories);
                }

                return (
                    <Polygon
                        key={t.id}
                        positions={positions}
                        interactive={true}
                        eventHandlers={{
                            click: (e) => {
                                L.DomEvent.stopPropagation(e.originalEvent);
                                if (onTerritoryClick) onTerritoryClick(t, e);
                            }
                        }}
                        pathOptions={{
                            color: color,
                            fillColor: color,
                            fillOpacity: t.npc_type === 'ABSOLUTE' ? 0.3 : 0.15, // Denser for official nations
                            weight: isMine ? 3 : 2,
                            dashArray: isMine || t.npc_type === 'ABSOLUTE' ? undefined : '5, 5'
                        }}
                    >
                        <Tooltip sticky direction="top">
                            <div className="text-center">
                                <strong>{t.owner_name || `Territory #${t.id}`}</strong>
                                <br />
                                <span className="text-xs">{t.npc_type === 'ABSOLUTE' ? 'City-State' : (t.npc_type === 'FREE' ? 'Free Faction' : 'User Territory')}</span>
                            </div>
                        </Tooltip>
                    </Polygon>
                );
            })}
        </>
    );
}

// Geometry Helpers
function calculateClippedTerritory(current: Territory, all: Territory[]): [number, number][] {
    const points: [number, number][] = [];
    const steps = 72; // Every 5 degrees

    // Scale longitude to match latitude distance roughly (at current lat)
    const latRad = current.x * Math.PI / 180;
    const lngScale = Math.cos(latRad);

    const maxRadiusDeg = current.territory_radius / 111.32;

    // Convert current to "Projected" space
    const cx = current.y * lngScale; // Lng * scale
    const cy = current.x;            // Lat

    for (let i = 0; i < steps; i++) {
        const angle = (i * 360 / steps) * (Math.PI / 180);
        const ux = Math.cos(angle);
        const uy = Math.sin(angle);

        let rayLen = maxRadiusDeg;

        // Check against all neighbors
        for (const other of all) {
            if (other.id === current.id) continue;

            // ABSOLUTE TERRITORY CHECK (Polygon Clipping)
            if (other._boundaryPoints) {
                // Project Polygon points and intersect
                const poly = other._boundaryPoints;
                // Optimization Check: Distance to Center of Polygon? 
                // Or simplified BBox check. 
                // Let's assume poly is close enough to check.

                for (let j = 0; j < poly.length; j++) {
                    const p1 = poly[j];
                    const p2 = poly[(j + 1) % poly.length];

                    // Project Coordinates
                    const ax = p1[1] * lngScale; const ay = p1[0];
                    const bx = p2[1] * lngScale; const by = p2[0];

                    // Intersection: Ray(cx,cy, ux,uy) vs Segment(ax,ay, bx,by)
                    // Ray: P = O + tD
                    // Seg: P = A + u(B-A)

                    const v1x = ax - cx;
                    const v1y = ay - cy;
                    const v2x = bx - ax; // Segment Vector
                    const v2y = by - ay;
                    // Ray Vector (ux, uy)

                    // Solve for t (Ray Dist) and u (Seg Param)
                    // O + tD = A + uV2
                    // tD - uV2 = A - O
                    // Matrix: [ux  -v2x] [t] = [v1x]
                    //         [uy  -v2y] [u] = [v1y]

                    const det = ux * (-v2y) - (-v2x) * uy; // -ux*v2y + v2x*uy
                    if (Math.abs(det) < 1e-9) continue; // Parallel

                    const t = (v1x * (-v2y) - (-v2x) * v1y) / det;
                    const u = (ux * v1y - v1x * uy) / det;

                    if (u >= 0 && u <= 1 && t > 0) {
                        // Valid intersection with segment
                        if (t < rayLen) {
                            rayLen = t;
                            // We found a hard wall.
                        }
                    }
                }
                continue;
            }

            // STANDARD VORONOI CHECK (Circle/Point Clipping)
            const ox = other.y * lngScale;
            const oy = other.x;

            const vx = ox - cx;
            const vy = oy - cy;
            const distSq = vx * vx + vy * vy;
            const dist = Math.sqrt(distSq);

            // Optimization
            if (dist > (current.territory_radius + other.territory_radius) / 111.0 * 1.5) continue;

            const dot = ux * vx + uy * vy;

            if (dot > 0) {
                const t = (0.5 * distSq) / dot;
                if (t < rayLen) {
                    rayLen = t;
                }
            }
        }

        const px = cx + ux * rayLen;
        const py = cy + uy * rayLen;
        const finalLng = px / lngScale;
        const finalLat = py;

        points.push([finalLat, finalLng]);
    }

    return points;
}
