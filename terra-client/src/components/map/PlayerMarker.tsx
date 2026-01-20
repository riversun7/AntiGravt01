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


/**
 * @file PlayerMarker.tsx
 * @description 플레이어 위치를 지도에 표시하는 마커 컴포넌트
 * @role 커스텀 아이콘(사이보그) 렌더링, 현재 상태(건설 중 등) 시각화
 * @dependencies react-leaflet, leaflet
 * @status Active
 */
export default function PlayerMarker({
  initialPosition,
  // maxDistanceKm, // 현재 로직에서 미사용 (인터페이스 호환성 유지)
  // onMove, // 로컬 애니메이션 비활성화로 미사용
  isConstructing = false,
  constructionTimeLeft = 0,
  // isAdmin = false, // 미사용
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
        <b>나의 사이보그 (Cyborg)</b><br />
        위치: ({position[0].toFixed(4)}, {position[1].toFixed(4)})<br />
        {isConstructing && <span className="text-orange-500">🏗️ 건설 중... {constructionTimeLeft}초</span>}
      </Popup>
    </Marker>
  );
}
