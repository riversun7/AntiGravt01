/**
 * @file useGeolocation.ts
 * @description GPS 위치 추적을 위한 커스텀 React Hook
 * @role 브라우저 Geolocation API를 사용하여 현재 위치(위도, 경도)를 가져오거나 실시간으로 추적
 * @dependencies react
 * @usedBy TerrainMapPage (지도 중심), LocationButton (내 위치 버튼)
 * @status Active
 * 
 * @analysis
 * **브라우저 Geolocation API:**
 * 
 * 두 가지 모드:
 * 1. getCurrentPosition: 현재 위치 1회 조회
 * 2. watchPosition: 위치 변경 시 자동 업데이트 (실시간 추적)
 * 
 * **정확도 옵션:**
 * - enableHighAccuracy: true → GPS 사용 (정확하지만 배터리 소모)
 * - enableHighAccuracy: false → WiFi/셀룰러 (빠르지만 부정확)
 * 
 * **타임아웃:**
 * - timeout: 20초 (기본값)
 * - GPS 신호 약할 때 오래 걸릴 수 있음
 * 
 * **권한:**
 * - HTTPS 필수 (localhost는 예외)
 * - 사용자가 브라우저 팝업에서 허용해야 함
 */

import { useEffect, useState } from 'react';

/**
 * @interface GeolocationState
 * @description GPS 위치 추적 상태를 나타내는 인터페이스
 */
export interface GeolocationState {
    position: [number, number] | null; // [위도, 경도] 또는 null (아직 없음)
    error: string | null;              // 에러 메시지 (권한 거부, 타임아웃 등)
    loading: boolean;                  // 최초 로딩 중 여부
    accuracy: number | null;           // GPS 정확도 (미터 단위, 낮을수록 정확)
    watching: boolean;                 // 실시간 추적 활성화 여부
}

/**
 * @interface GeolocationOptions
 * @description GPS 훅 옵션
 * @extends PositionOptions 브라우저 Geolocation API 옵션 상속
 */
export interface GeolocationOptions extends PositionOptions {
    watch?: boolean; // true: 실시간 추적 (watchPosition), false: 1회 조회 (getCurrentPosition)
}

/**
 * @hook useGeolocation
 * @description GPS 위치 추적 React 훅
 * 
 * @param {GeolocationOptions} options - GPS 옵션
 * @returns {GeolocationState} 현재 GPS 상태
 * 
 * @example
 * // 실시간 추적 (기본값)
 * const { position, error, accuracy } = useGeolocation();
 * 
 * // 1회만 조회
 * const { position } = useGeolocation({ watch: false });
 * 
 * // 낮은 정확도 (빠름)
 * const { position } = useGeolocation({ enableHighAccuracy: false });
 */
export function useGeolocation(options: GeolocationOptions = {}) {
    // === 옵션 기본값 설정 ===
    const {
        watch = true,                  // 기본: 실시간 추적 활성화
        enableHighAccuracy = true,     // 기본: 고정확도 (GPS) 사용
        timeout = 20000,                // 기본: 20초 타임아웃
        maximumAge = 0                  // 기본: 캐시 사용 안 함 (항상 최신 위치)
    } = options;

    // === 상태 초기화 ===
    const [state, setState] = useState<GeolocationState>({
        position: null,    // 아직 위치 없음
        error: null,       // 에러 없음
        loading: true,     // 로딩 중
        accuracy: null,    // 정확도 미측정
        watching: false,   // 추적 시작 전
    });

    useEffect(() => {
        // === 브라우저 지원 확인 ===
        /**
         * navigator.geolocation 확인:
         * 
         * 지원하는 브라우저:
         * - Chrome, Firefox, Safari, Edge (최신 버전)
         * 
         * 지원하지 않는 경우:
         * - 구형 브라우저 (IE 8 이하)
         * - HTTP 환경 (HTTPS 필수, localhost는 예외)
         */
        if (!navigator.geolocation) {
            setState(prev => ({
                ...prev,
                error: '이 브라우저는 위치 정보를 지원하지 않습니다.',
                loading: false,
            }));
            return; // 조기 종료
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
            let errorMessage = '위치 정보를 가져올 수 없습니다.';

            switch (error.code) {
                case error.PERMISSION_DENIED:
                    errorMessage = '위치 정보 접근 권한이 거부되었습니다.';
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMessage = '위치 정보를 사용할 수 없습니다.';
                    break;
                case error.TIMEOUT:
                    errorMessage = '위치 요청 시간이 초과되었습니다.';
                    break;
            }

            const isFatal = error.code === error.PERMISSION_DENIED;

            setState(prev => ({
                ...prev,
                error: errorMessage,
                loading: false,
                watching: watch && !isFatal, // 치명적 에러(권한 거부)가 아니면 계속 시도
            }));
        };

        if (watch) {
            // 위치 실시간 추적 시작
            const watchId = navigator.geolocation.watchPosition(
                handleSuccess,
                handleError,
                geoOptions
            );

            return () => {
                navigator.geolocation.clearWatch(watchId);
            };
        } else {
            // 단발성 위치 조회
            navigator.geolocation.getCurrentPosition(
                handleSuccess,
                handleError,
                geoOptions
            );
        }
    }, [watch, enableHighAccuracy, timeout, maximumAge]);

    return state;
}
