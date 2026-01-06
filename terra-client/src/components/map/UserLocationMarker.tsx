"use client";

import { useEffect, useRef } from 'react';
import { Marker, Circle, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { GeolocationState } from '@/hooks/useGeolocation';

interface UserLocationMarkerProps {
    geolocation: GeolocationState;
    showAccuracyCircle?: boolean;
}

/**
 * Display user's GPS location on the map with accuracy circle
 */
export default function UserLocationMarker({
    geolocation,
    showAccuracyCircle = true
}: UserLocationMarkerProps) {
    const { position, accuracy, watching } = geolocation;
    const map = useMap();
    const markerRef = useRef<L.Marker>(null);

    useEffect(() => {
        // Animate marker when position updates
        if (markerRef.current && position) {
            markerRef.current.setLatLng(position);
        }
    }, [position]);

    if (!position) {
        return null;
    }

    // Custom user location icon
    const userIcon = L.divIcon({
        html: `
      <div class="relative">
        <div class="absolute inset-0 animate-ping">
          <div class="w-6 h-6 rounded-full bg-blue-500/50"></div>
        </div>
        <div class="relative w-6 h-6 rounded-full bg-blue-500 border-2 border-white shadow-lg flex items-center justify-center">
          <div class="w-2 h-2 rounded-full bg-white"></div>
        </div>
      </div>
    `,
        className: 'user-location-marker',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
    });

    return (
        <>
            <Marker
                position={position}
                icon={userIcon}
                ref={markerRef}
            >
                <Popup>
                    <div className="text-sm">
                        <strong className="text-blue-600">Your Location</strong>
                        <div className="text-xs text-gray-600 mt-1">
                            📍 {position[0].toFixed(6)}, {position[1].toFixed(6)}
                        </div>
                        {accuracy && (
                            <div className="text-xs text-gray-500 mt-1">
                                Accuracy: ±{Math.round(accuracy)}m
                            </div>
                        )}
                        {watching && (
                            <div className="text-xs text-green-600 mt-1">
                                🟢 Live tracking
                            </div>
                        )}
                    </div>
                </Popup>
            </Marker>

            {/* Accuracy circle */}
            {showAccuracyCircle && accuracy && (
                <Circle
                    center={position}
                    radius={accuracy}
                    pathOptions={{
                        color: '#3b82f6',
                        fillColor: '#3b82f6',
                        fillOpacity: 0.1,
                        weight: 1,
                    }}
                />
            )}
        </>
    );
}
