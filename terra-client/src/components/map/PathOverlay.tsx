import React from 'react';
import { Polyline, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

interface PathOverlayProps {
    path: Array<{ lat: number; lng: number }>;
    waypoints: Array<{ lat: number; lng: number }>;
    onWaypointClick?: (index: number) => void;
}

/**
 * @file PathOverlay.tsx
 * @description 지도 상에 이동 경로(Polyline)와 경유지(Waypoint)를 렌더링하는 컴포넌트
 * @role A* 알고리즘 등으로 계산된 경로를 시각화하고, 경유지 추가/삭제 인터랙션을 제공
 * @dependencies react-leaflet, leaflet
 * @status Active
 */
const PathOverlay = React.memo(function PathOverlay({ path, waypoints, onWaypointClick }: PathOverlayProps) {
    if (!path || path.length === 0) return null;

    // Leaflet 호환 좌표 포맷으로 변환 ([lat, lng])
    const positions = path
        .filter(p => p && typeof p.lat === 'number' && typeof p.lng === 'number')
        .map(p => [p.lat, p.lng] as [number, number]);

    if (positions.length === 0) return null;

    // Waypoint Icons
    // Waypoint Icons (Safe DivIcon)
    const waypointIcon = new L.DivIcon({
        className: 'custom-div-icon',
        html: `<div style="background-color:rgba(0,0,0,0.5); border-radius:50%; width:24px; height:24px; display:flex; justify-content:center; align-items:center; border:2px solid #fbbf24;">📍</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });

    return (
        <>
            <Polyline
                positions={positions}
                pathOptions={{ color: '#fbbf24', weight: 4, opacity: 0.8, dashArray: '10, 10' }} // 노란색 점선 스타일
            />
            {waypoints.map((wp, i) => (
                <Marker
                    key={`wp-${i}`}
                    position={[wp.lat, wp.lng]}
                    icon={waypointIcon}
                    eventHandlers={{
                        click: () => onWaypointClick && onWaypointClick(i)
                    }}
                >
                    <Popup>
                        경유지 {i + 1}
                        <br />
                        <button
                            className="bg-red-500 text-white px-2 py-1 rounded text-xs mt-1"
                            onClick={() => onWaypointClick && onWaypointClick(i)}
                        >
                            삭제 (Remove)
                        </button>
                    </Popup>
                </Marker>
            ))}
        </>
    );
});

export default PathOverlay;
