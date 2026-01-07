import { useEffect, useState } from 'react';

export interface GeolocationState {
    position: [number, number] | null;
    error: string | null;
    loading: boolean;
    accuracy: number | null;
    watching: boolean;
}

export interface GeolocationOptions extends PositionOptions {
    watch?: boolean;
}

/**
 * Custom hook for GPS geolocation tracking
 * Supports both one-time position retrieval and continuous watching
 */
export function useGeolocation(options: GeolocationOptions = {}) {
    const {
        watch = true,
        enableHighAccuracy = true,
        timeout = 10000,
        maximumAge = 0
    } = options;

    const [state, setState] = useState<GeolocationState>({
        position: null,
        error: null,
        loading: true,
        accuracy: null,
        watching: false,
    });

    useEffect(() => {
        // Check if geolocation is supported
        if (!navigator.geolocation) {
            setState(prev => ({
                ...prev,
                error: 'Geolocation is not supported by your browser',
                loading: false,
            }));
            return;
        }

        const geoOptions: PositionOptions = {
            enableHighAccuracy,
            timeout,
            maximumAge,
        };

        const handleSuccess = (position: GeolocationPosition) => {
            setState({
                position: [position.coords.latitude, position.coords.longitude],
                accuracy: position.coords.accuracy,
                error: null,
                loading: false,
                watching: watch,
            });
        };

        const handleError = (error: GeolocationPositionError) => {
            let errorMessage = 'Unable to retrieve your location';

            switch (error.code) {
                case error.PERMISSION_DENIED:
                    errorMessage = 'Location permission denied';
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMessage = 'Location information unavailable';
                    break;
                case error.TIMEOUT:
                    errorMessage = 'Location request timed out';
                    break;
            }

            setState(prev => ({
                ...prev,
                error: errorMessage,
                loading: false,
                watching: false,
            }));
        };

        if (watch) {
            // Watch position continuously
            const watchId = navigator.geolocation.watchPosition(
                handleSuccess,
                handleError,
                geoOptions
            );

            return () => {
                navigator.geolocation.clearWatch(watchId);
            };
        } else {
            // Get position once
            navigator.geolocation.getCurrentPosition(
                handleSuccess,
                handleError,
                geoOptions
            );
        }
    }, [watch, enableHighAccuracy, timeout, maximumAge]);

    return state;
}
