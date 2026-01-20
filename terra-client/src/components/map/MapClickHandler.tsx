import { useRef } from 'react';
import { useMapEvents } from 'react-leaflet';
import { LeafletMouseEvent } from 'leaflet';

interface MapClickHandlerProps {
    isConstructing: boolean;
    geolocation: { position: [number, number] | null; error: string | null; loading: boolean; watching: boolean };
    playerPosition: [number, number];
    maxMovementRange: number;
    onMove: (position: [number, number]) => void;
    calculateDistance: (lat1: number, lon1: number, lat2: number, lon2: number) => number;
    onError: (message: string) => void;
    onTileClick?: (lat: number, lng: number, point: { x: number; y: number }) => void;
}

/**
 * @file MapClickHandler.tsx
 * @description 지도상의 클릭/더블클릭 이벤트를 처리하는 핸들러
 * @role 타일 정보 확인(클릭) 및 플레이어 이동 명령(더블클릭) 처리
 * @dependencies react, react-leaflet, leaflet
 * @status Active
 * 
 * @analysis
 * - `click`과 `dblclick` 이벤트를 구분하기 위해 타이머(setTimeout) 로직 사용 (200ms 딜레이).
 * - 더블클릭 시 작전 반경(`maxMovementRange`) 체크 후 `onMove` 콜백 호출.
 * - 건설 모드(`isConstructing`)일 때는 이동 명령 무시.
 */
export default function MapClickHandler({
    isConstructing,
    geolocation,
    playerPosition,
    maxMovementRange,
    onMove,
    calculateDistance,
    onError,
    onTileClick
}: MapClickHandlerProps) {
    const clickTimerRef = useRef<NodeJS.Timeout | null>(null);

    useMapEvents({
        click: (e: LeafletMouseEvent) => {
            if (clickTimerRef.current) {
                clearTimeout(clickTimerRef.current);
                clickTimerRef.current = null;
            }

            clickTimerRef.current = setTimeout(() => {
                if (onTileClick) {
                    onTileClick(e.latlng.lat, e.latlng.lng, e.containerPoint);
                }
                clickTimerRef.current = null;
            }, 200); // Reduced to 200ms for faster response (was 300ms)
        },
        dblclick: (e: LeafletMouseEvent) => {
            if (clickTimerRef.current) {
                clearTimeout(clickTimerRef.current);
                clickTimerRef.current = null;
            }

            if (isConstructing) return;

            const { lat, lng } = e.latlng;

            // Calculate distance from GPS center (or player position if GPS not available)
            const centerLat = geolocation?.position ? geolocation.position[0] : playerPosition[0];
            const centerLng = geolocation?.position ? geolocation.position[1] : playerPosition[1];

            const distance = calculateDistance(centerLat, centerLng, lat, lng);

            if (distance <= maxMovementRange) {
                // OLD: onMove([lat, lng]); -> NEW: Call Server API
                if (onMove) {
                    // Pass to parent to handle API call or call here?
                    // Let's call API here to keep logic clean, OR delegate.
                    // The Plan said "MapClickHandler calls API".
                    onMove([lat, lng]); // This just updates local state? No.
                    // Let's check props. onMove is (position: [number, number]) => void;
                    // We should probably change onMove to trigger the API call in TerrainMapContent 
                    // OR handle it here if we have userId. 
                    // MapClickHandler doesn't have userId currently.
                    // Let's defer to onMove logic which will be updated in TerrainMapContent.
                    onMove([lat, lng]);
                }
            } else {
                onError(`이동 불가: 작전 반경(${maxMovementRange}km)을 벗어날 수 없습니다.\n현재 거리: ${distance.toFixed(2)}km`);
            }
        },
    });

    return null;
}
