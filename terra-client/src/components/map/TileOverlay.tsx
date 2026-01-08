'use client';

import { Rectangle, Popup } from 'react-leaflet';

interface TileData {
    id: string; // x_y
    x: number; // grid x
    y: number; // grid y
    owner_id?: number | null;
    faction?: string | null;
}

interface TileOverlayProps {
    ownedTiles: TileData[];
}

export default function TileOverlay({ ownedTiles }: TileOverlayProps) {
    // Grid constants
    const LAT_PER_TILE = 180 / 80; // Total Lat 180 deg / 80 rows
    const LNG_PER_TILE = 360 / 160; // Total Lng 360 deg / 160 cols

    return (
        <>
            {ownedTiles.map((tile) => {
                // Calculate bounds from grid coordinates
                // Lat: 90 to -90. Row 0 starts at 90.
                const north = 90 - (tile.y * LAT_PER_TILE);
                const south = 90 - ((tile.y + 1) * LAT_PER_TILE);

                // Lng: -180 to 180. Col 0 starts at -180.
                const west = -180 + (tile.x * LNG_PER_TILE);
                const east = -180 + ((tile.x + 1) * LNG_PER_TILE);

                const bounds: [[number, number], [number, number]] = [[north, west], [south, east]];

                // Color based on owner
                // Owner 1 (Admin/Player) = Blue/Cyan, Others = Red?
                const color = tile.owner_id === 1 ? '#22d3ee' : '#ef4444';

                return (
                    <Rectangle
                        key={`tile-${tile.id}`}
                        bounds={bounds}
                        pathOptions={{ color: color, weight: 1, fillOpacity: 0.1 }}
                    >
                        <Popup>
                            <div className="text-sm">
                                <span className="font-bold">Owned Territory</span><br />
                                Owner: User {tile.owner_id}<br />
                                Grid: {tile.x}, {tile.y}
                            </div>
                        </Popup>
                    </Rectangle>
                );
            })}
        </>
    );
}
