import { Polygon, Tooltip } from 'react-leaflet';

interface Territory {
    id: number;
    user_id: string | number;
    x: number; // lat
    y: number; // lng
    territory_radius: number; // km
    is_territory_center: number; // 1 or 0
}

interface TerritoryOverlayProps {
    territories: Territory[];
    currentUserId: string | null;
}

export default function TerritoryOverlay({ territories, currentUserId }: TerritoryOverlayProps) {
    if (!territories || territories.length === 0) return null;

    return (
        <>
            {territories.map((t) => {
                const isMine = String(t.user_id) === String(currentUserId);
                const color = isMine ? '#00FFFF' : '#FF4444'; // Cyan for mine, Red for others

                // Calculate geometry
                const positions = calculateClippedTerritory(t, territories);

                return (
                    <Polygon
                        key={t.id}
                        positions={positions}
                        interactive={false} // Disable interaction so clicks pass through to map
                        pathOptions={{
                            color: color,
                            fillColor: color,
                            fillOpacity: 0.1,
                            weight: 2,
                            dashArray: isMine ? undefined : '5, 10'
                        }}
                    >
                        <Tooltip sticky direction="top">
                            {isMine ? "My Territory" : `Territory #${t.id}`}
                            <br />
                            Radius: {t.territory_radius}km
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

    // Radius in degrees (approximate: 1 deg lat = 111km)
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

            const ox = other.y * lngScale;
            const oy = other.x;

            // Vector to neighbor
            const vx = ox - cx;
            const vy = oy - cy;
            const distSq = vx * vx + vy * vy;
            const dist = Math.sqrt(distSq);

            // Optimization: If neighbor is too far (sum of radii), ignore
            // Max possible interaction distance is roughly (r1 + r2) / 111
            // 10km / 111 ~= 0.1 deg. If dist > 0.15, likely no overlap.
            if (dist > (current.territory_radius + other.territory_radius) / 111.0 * 1.5) continue;

            // Dot product of Ray Direction and Vector to Neighbor
            const dot = ux * vx + uy * vy;

            // If dot > 0, neighbor is roughly in front. Check bisector intersection.
            if (dot > 0) {
                // Distance to bisector along ray
                // t = (0.5 * |V|^2) / (U . V)
                const t = (0.5 * distSq) / dot;
                if (t < rayLen) {
                    rayLen = t;
                }
            }
        }

        // Convert back to Lat/Lng
        const px = cx + ux * rayLen;
        const py = cy + uy * rayLen;
        const finalLng = px / lngScale;
        const finalLat = py;

        points.push([finalLat, finalLng]);
    }

    return points;
}
