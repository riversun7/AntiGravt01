"use client";

import { useMap, Circle } from 'react-leaflet';
import { useEffect } from 'react';

interface MovementRangeProps {
    center: [number, number];
    radiusKm: number;
    color?: string;
}

/**
 * @file MovementRange.tsx
 * @description 플레이어의 이동 가능 반경을 지도에 원(Circle)으로 표시
 * @role 현재 위치(GPS 또는 기지)를 중심으로 작전 반경 시각화
 * @dependencies react-leaflet, react
 * @status Active
 * 
 * @analysis
 * - `useEffect`를 통해 `center` 값이 변경되면 해당 위치로 지도를 자동 이동(setView)시키는 로직 포함.
 * - 반경은 km 단위로 입력받아 미터 단위로 변환하여 `Circle` 컴포넌트에 전달.
 */
export default function MovementRange({ center, radiusKm, color = '#3388ff' }: MovementRangeProps) {
    const map = useMap();

    useEffect(() => {
        // Center map on player position if needed
        if (center) {
            map.setView(center, map.getZoom());
        }
    }, [center, map]);

    return (
        <Circle
            center={center}
            radius={radiusKm * 1000} // Convert km to meters
            pathOptions={{
                color: color,
                fillColor: color,
                fillOpacity: 0.1,
                weight: 2,
                dashArray: '5, 10',
            }}
        />
    );
}
