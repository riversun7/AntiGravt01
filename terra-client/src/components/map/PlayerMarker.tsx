"use client";

import { Marker, Popup, useMapEvents } from 'react-leaflet';
import { useState, useEffect, useRef } from 'react';
import L from 'leaflet';

interface PlayerMarkerProps {
    initialPosition: [number, number];
    maxDistanceKm: number;
    onMove: (position: [number, number]) => void;
    isConstructing?: boolean;
    constructionTimeLeft?: number;
    isAdmin?: boolean; // Admin moves at 100km/s
}

// Calculate distance between two points in km (Haversine formula)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

export default function PlayerMarker({
    initialPosition,
    maxDistanceKm,
    onMove,
    isConstructing = false,
    constructionTimeLeft = 0,
    isAdmin = false,
}: PlayerMarkerProps) {
    const [position, setPosition] = useState<[number, number]>(initialPosition);
    const [basePosition] = useState<[number, number]>(initialPosition);
    const [isMoving, setIsMoving] = useState(false);
    const [remainingDistance, setRemainingDistance] = useState(0);
    const [remainingTime, setRemainingTime] = useState(0);
    const animationRef = useRef<number | null>(null);

    // Update position when initialPosition changes
    useEffect(() => {
        setPosition(initialPosition);
    }, [initialPosition]);

    // Smooth movement animation
    const animateMovement = (start: [number, number], end: [number, number], durationMs: number) => {
        const startTime = Date.now();
        const totalDistance = calculateDistance(start[0], start[1], end[0], end[1]);
        setIsMoving(true);

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / durationMs, 1);
            const remaining = durationMs - elapsed;

            // Calculate remaining distance
            const currentDistance = totalDistance * (1 - progress);
            setRemainingDistance(currentDistance);
            setRemainingTime(Math.max(0, Math.ceil(remaining / 1000))); // seconds

            if (progress < 1) {
                const currentLat = start[0] + (end[0] - start[0]) * progress;
                const currentLng = start[1] + (end[1] - start[1]) * progress;
                setPosition([currentLat, currentLng]);
                animationRef.current = requestAnimationFrame(animate);
            } else {
                setPosition(end);
                setIsMoving(false);
                setRemainingDistance(0);
                setRemainingTime(0);
                onMove(end);
            }
        };

        animationRef.current = requestAnimationFrame(animate);
    };

    // Create custom cyborg icon
    const getCyborgIcon = () => {
        let statusColor = '#6366f1'; // Default blue
        let statusText = '';

        if (isConstructing) {
            statusColor = '#f59e0b'; // Orange for construction
            statusText = `⏱ ${constructionTimeLeft}s`;
        } else if (isMoving) {
            statusColor = '#10b981'; // Green for moving
            statusText = `${remainingDistance.toFixed(2)}km | ${remainingTime}s`;
        }

        return L.divIcon({
            html: `
        <div style="position: relative;">
          <div style="
            width: 40px;
            height: 40px;
            background: linear-gradient(135deg, #8b5cf6 0%, ${statusColor} 100%);
            border: 3px solid #ffffff;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            box-shadow: 0 4px 12px rgba(139, 92, 246, 0.6);
            cursor: ${isConstructing || isMoving ? 'not-allowed' : 'pointer'};
          ">
            🤖
          </div>
          ${statusText ? `
            <div style="
              position: absolute;
              top: -20px;
              left: 50%;
              transform: translateX(-50%);
              background: rgba(0,0,0,0.8);
              color: white;
              padding: 2px 8px;
              border-radius: 10px;
              font-size: 10px;
              white-space: nowrap;
              font-weight: bold;
            ">
              ${statusText}
            </div>
          ` : ''}
        </div>
      `,
            className: 'player-marker',
            iconSize: [40, 40],
            iconAnchor: [20, 20],
        });
    };

    // Handle map clicks for movement
    useMapEvents({
        click(e) {
            // Block movement if constructing or already moving
            if (isConstructing || isMoving) {
                console.warn(isConstructing ? 'Cannot move while constructing' : 'Already moving');
                return;
            }

            const clickedLat = e.latlng.lat;
            const clickedLng = e.latlng.lng;

            // Calculate distance from base position
            const distance = calculateDistance(
                basePosition[0],
                basePosition[1],
                clickedLat,
                clickedLng
            );

            if (distance <= maxDistanceKm) {
                const newPosition: [number, number] = [clickedLat, clickedLng];

                // Calculate movement duration: Admin 100km/s, Normal 1km/s
                const speedKmPerSec = isAdmin ? 100 : 1;
                const durationMs = (distance / speedKmPerSec) * 1000;

                animateMovement(position, newPosition, durationMs);
            } else {
                console.warn(`Cannot move ${distance.toFixed(2)}km away. Maximum distance is ${maxDistanceKm}km.`);
            }
        },
    });

    // Cleanup animation on unmount
    useEffect(() => {
        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, []);

    return (
        <Marker position={position} icon={getCyborgIcon()}>
            <Popup>
                <b>Your Cyborg</b><br />
                Position: ({position[0].toFixed(4)}, {position[1].toFixed(4)})<br />
                {isConstructing && <span className="text-orange-500">🏗️ Constructing... {constructionTimeLeft}s</span>}
                {isMoving && <span className="text-green-500">🚶 {remainingDistance.toFixed(2)}km 남음 | {remainingTime}초</span>}
                {!isConstructing && !isMoving && <small>Click within {maxDistanceKm}km to move</small>}
            </Popup>
        </Marker>
    );
}
