import { useEffect } from 'react';
import { useMap, CircleMarker } from 'react-leaflet';
import L from 'leaflet';

interface SelectedPointMarkerProps {
    position: [number, number] | null;
}

export default function SelectedPointMarker({ position }: SelectedPointMarkerProps) {
    const map = useMap();

    if (!position) return null;

    return (
        <CircleMarker
            center={position}
            radius={6}
            pathOptions={{
                color: '#22d3ee', // Cyan
                fillColor: '#22d3ee',
                fillOpacity: 0.8,
                weight: 2
            }}
            eventHandlers={{
                click: (e) => {
                    // Pass through click without stopping, so map can handle deselection if needed?
                    // Or stop propagation?
                    // Usually marker click should select marker.
                    // But this marker IS the selection.
                }
            }}
        />
    );
}
