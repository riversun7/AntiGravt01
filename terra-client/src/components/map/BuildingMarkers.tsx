"use client";

import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

interface Building {
    id: number;
    type: string;
    lat: number;
    lng: number;
}

interface BuildingMarkersProps {
    buildings: Building[];
    onBuildingClick?: (building: Building) => void;
}

const getBuildingIcon = (type: string) => {
    const iconMap: Record<string, string> = {
        house: '🏠',
        castle: '🏰',
        factory: '🏭',
        mine: '⛏️',
        warehouse: '📦',
        barracks: '🏡',
    };

    const emoji = iconMap[type.toLowerCase()] || '🏢';

    return L.divIcon({
        html: `
      <div style="
        width: 36px;
        height: 36px;
        background: rgba(30, 41, 59, 0.95);
        border: 2px solid #3b82f6;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 22px;
        box-shadow: 0 2px 12px rgba(59, 130, 246, 0.5);
        cursor: pointer;
        transition: transform 0.2s;
      "
      class="building-icon-hover"
      >
        ${emoji}
      </div>
    `,
        className: 'building-marker',
        iconSize: [36, 36],
        iconAnchor: [18, 18],
    });
};

export default function BuildingMarkers({ buildings, onBuildingClick }: BuildingMarkersProps) {
    return (
        <>
            {buildings.map((building, index) => (
                <Marker
                    key={`building-${building.id}-${index}`}
                    position={[building.lat, building.lng]}
                    icon={getBuildingIcon(building.type)}
                    eventHandlers={{
                        click: () => {
                            if (onBuildingClick) {
                                onBuildingClick(building);
                            }
                        },
                    }}
                >
                    <Popup>
                        <b>{building.type.charAt(0).toUpperCase() + building.type.slice(1)}</b><br />
                        Position: ({building.lat.toFixed(4)}, {building.lng.toFixed(4)})<br />
                        <small>클릭하여 관리</small>
                    </Popup>
                </Marker>
            ))}
        </>
    );
}
