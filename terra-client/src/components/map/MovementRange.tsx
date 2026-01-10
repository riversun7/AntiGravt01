"use client";

import { useMap, Circle } from 'react-leaflet';
import { useEffect } from 'react';

interface MovementRangeProps {
    center: [number, number];
    radiusKm: number;
    color?: string;
}

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
