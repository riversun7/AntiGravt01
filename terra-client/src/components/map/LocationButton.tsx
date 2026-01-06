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
 * Button to center map on user's GPS location
 * Shows loading and error states
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
                    <span className="text-xs">Locating...</span>
                </>
            );
        }

        if (error) {
            return (
                <>
                    <NavigationOff className="w-4 h-4" />
                    <span className="text-xs">GPS Error</span>
                </>
            );
        }

        return (
            <>
                <Navigation className={`w-4 h-4 ${watching ? 'text-green-400' : ''}`} />
                <span className="text-xs">My Location</span>
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

            {/* Accuracy indicator */}
            {position && geolocation.accuracy && !error && (
                <div className="mt-2 text-xs text-gray-500 font-mono text-right">
                    ±{Math.round(geolocation.accuracy)}m
                </div>
            )}
        </div>
    );
}
