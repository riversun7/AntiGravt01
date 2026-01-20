import React from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

interface Building {
    id: number;
    type: string;
    lat: number;
    lng: number;
    color?: string;
}

/**
 * @file BuildingMarkers.tsx
 * @description 지도상의 건물들을 마커로 표시하는 컴포넌트
 * @role 건물 타입별 아이콘 매핑, 건물 정보 팝업 표시
 * @dependencies react-leaflet, leaflet
 * @status Active
 */
interface BuildingMarkersProps {
    buildings: Building[];
    onBuildingClick?: (building: Building) => void;
}

const getBuildingIcon = (type: string, color?: string) => {
    const iconMap: Record<string, string> = {
        'COMMAND_CENTER': '🏰',      // 사령부
        'CENTRAL_CONTROL_HUB': '🏛️', // 중앙 제어 허브
        'HOUSE': '🏠',               // 주택
        'BASIC_QUARTERS': '🏘️',      // 숙소
        'FACTORY': '🏭',             // 공장
        'MINE': '⛏️',                // 광산
        'WAREHOUSE': '📦',           // 창고
        'BASIC_WAREHOUSE': '📦',
        'ADVANCED_WAREHOUSE': '🏢',  // 고급 창고
        'BARRACKS': '⚔️',            // 병영
        'FARM': '🌾',                // 농장
        'LAB': '⚗️',                 // 연구소
        'RESEARCH_LAB': '🧪',
        'MARKET': '⚖️',              // 시장
        'LUMBERYARD': '🪓',          // 벌목장
        'AREA_BEACON': '📡',        // 영역 비콘
        'TERRITORY_UNIT': '🏴',     // 영토 유닛
    };

    // 대소문자 무관하게 타입 매칭
    const normalizedType = type.toUpperCase();
    const emoji = iconMap[normalizedType] || iconMap[type.toLowerCase()] || '🏗️'; // 기본값: 건설 크레인

    // Default blue if no color provided
    const borderColor = color || '#3b82f6';
    // Create shadow color with opacity
    const shadowColor = color ? `${color}80` : 'rgba(59, 130, 246, 0.5)'; // 80 is 50% alpha approx or use rgba

    return L.divIcon({
        html: `
      <div style="
        width: 36px;
        height: 36px;
        background: rgba(30, 41, 59, 0.95);
        border: 2px solid ${borderColor};
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 22px;
        box-shadow: 0 0 12px ${borderColor};
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

const BuildingMarkers = React.memo(function BuildingMarkers({ buildings, onBuildingClick }: BuildingMarkersProps) {
    return (
        <>
            {buildings.map((building, index) => (
                <Marker
                    key={`building-${building.id}-${index}`}
                    position={[building.lat, building.lng]}
                    icon={getBuildingIcon(building.type, building.color)}
                    eventHandlers={{
                        click: (e) => {
                            L.DomEvent.stopPropagation(e as any);
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
});

export default BuildingMarkers;
