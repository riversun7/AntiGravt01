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

/**
 * @file TileOverlay.tsx
 * @description 소유된 타일(Territory)을 지도 위에 사각형(Rectangle)으로 오버레이 표시
 * @role 점령된 영역을 시각적으로 구분하고, 클릭 시 소유자 정보를 팝업으로 제공
 * @dependencies react-leaflet
 * @status Active
 * 
 * @analysis
 * - 전체 지구를 그리드(Grid)로 나누어 타일 좌표(x, y)를 위경도 경계(Bounds)로 변환.
 * - 소유자 ID에 따라 타일 색상을 구분 (예: 1번 유저는 파란색, 그 외는 빨간색).
 */
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
                                <span className="font-bold">점령지 (Owned Territory)</span><br />
                                소유자: User {tile.owner_id}<br />
                                그리드 좌표: {tile.x}, {tile.y}
                            </div>
                        </Popup>
                    </Rectangle>
                );
            })}
        </>
    );
}
