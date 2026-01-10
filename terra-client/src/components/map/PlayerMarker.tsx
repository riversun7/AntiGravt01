"use client";

import { Marker, Popup } from 'react-leaflet';
import { useState, useEffect } from 'react';
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


export default function PlayerMarker({
    initialPosition,
    // maxDistanceKm, // unused in logic but kept for interface consistency or future
    // onMove, // unused locally because animation is disabled
    isConstructing = false,
    constructionTimeLeft = 0,
    // isAdmin = false, // unused
}: PlayerMarkerProps) {
    const [position, setPosition] = useState<[number, number]>(initialPosition);

    // Update position when initialPosition changes
    useEffect(() => {
        setPosition(initialPosition);
    }, [initialPosition]);

    // Create custom cyborg icon
    const getCyborgIcon = () => {
        let statusColor = '#6366f1'; // Default blue
        let statusText = '';

        if (isConstructing) {
            statusColor = '#f59e0b'; // Orange for construction
            statusText = `⏱ ${constructionTimeLeft}s`;
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
            cursor: ${isConstructing ? 'not-allowed' : 'pointer'};
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

    return (
        <Marker position={position} icon={getCyborgIcon()}>
            <Popup>
                <b>Your Cyborg</b><br />
                Position: ({position[0].toFixed(4)}, {position[1].toFixed(4)})<br />
                {isConstructing && <span className="text-orange-500">🏗️ Constructing... {constructionTimeLeft}s</span>}
            </Popup>
        </Marker>
    );
}
