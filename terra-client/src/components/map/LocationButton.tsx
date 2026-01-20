"use client";

import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import { Navigation, NavigationOff, Loader2 } from 'lucide-react';
import type { GeolocationState } from '@/hooks/useGeolocation';

interface LocationButtonProps {
    geolocation: GeolocationState;
    autoCenter?: boolean;
}

/**
 * @file LocationButton.tsx
 * @description 사용자 GPS 위치로 지도를 이동시키는 버튼 컴포넌트
 * @role 현재 위치 추적, GPS 상태(로딩, 오차, 활성) 시각화, 지도 센터링 기능 제공
 * @dependencies react-leaflet, lucide-react, useGeolocation
 * @status Active
 * 
 * @analysis
 * - `useGeolocation` 훅의 상태(loading, error, position)에 따라 버튼의 아이콘과 색상이 동적으로 변경됨.
 * - `autoCenter` 옵션을 통해 위치가 파악되면 자동으로 지도를 이동시키는 편의 기능 포함.
 * - GPS 오차(accuracy)를 미터 단위로 표시하여 신뢰도 정보를 제공.
 */
export default function LocationButton({ geolocation, autoCenter = true }: LocationButtonProps) {
    const map = useMap();
    const { position, error, loading, watching } = geolocation;

    // Auto-center on position when available
    useEffect(() => {
        if (autoCenter && position && !error) {
            map.setView(position, map.getZoom());
        }
    }, [position, autoCenter, error, map]);

    const handleClick = () => {
        if (position) {
            map.setView(position, Math.max(map.getZoom(), 15), {
                animate: true,
                duration: 1,
            });
        }
    };

    const getButtonContent = () => {
        if (loading) {
            return (
                <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-xs">위치 확인 중...</span>
                </>
            );
        }

        if (error) {
            return (
                <>
                    <NavigationOff className="w-4 h-4" />
                    <span className="text-xs">GPS 오류</span>
                </>
            );
        }

        return (
            <>
                <Navigation className={`w-4 h-4 ${watching ? 'text-green-400' : ''}`} />
                <span className="text-xs">내 위치 (My Location)</span>
            </>
        );
    };

    const getStatusColor = () => {
        if (error) return 'border-red-500/50 hover:border-red-400';
        if (watching) return 'border-green-500/50 hover:border-green-400';
        return 'border-cyan-500/50 hover:border-cyan-400';
    };

    return (
        <div className="absolute bottom-24 right-4 z-[1000]">
            <button
                onClick={handleClick}
                disabled={loading || !!error || !position}
                className={`
          bg-black/80 backdrop-blur-sm border rounded px-3 py-2
          flex flex-col items-center gap-1
          transition-all duration-200
          ${getStatusColor()}
          ${loading || error || !position ? 'opacity-50 cursor-not-allowed' : 'hover:bg-black/90 cursor-pointer'}
        `}
                title={error || 'Center on my location'}
            >
                {getButtonContent()}
            </button>

            {/* GPS 정확도 표시 (오차 범위) */}
            {position && geolocation.accuracy && !error && (
                <div className="mt-2 text-xs text-gray-500 font-mono text-right">
                    ±{Math.round(geolocation.accuracy)}m
                </div>
            )}
        </div>
    );
}
