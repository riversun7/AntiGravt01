/**
 * @file config.ts
 * @description API 기본 URL 설정 및 환경 변수 관리
 * @role클라이언트/서버 환경에 따라 적절한 백엔드 API URL 반환
 * @dependencies 없음 (순수 유틸리티)
 * @usedBy api.ts, 모든 API 호출 코드
 * @status Active
 * 
 * @analysis
 * **환경별 API URL 전략:**
 * 
 * 1. **클라언트 사이드 (브라우저)**:
 *    - 빈 문자열('') 반환
 *    - Next.js의 rewrites 기능이 자동으로 백엔드로 프록시
 *    - next.config.js에서 /api/* → localhost:3001/api/* 매핑
 *    - 장점: CORS 문제 없음, 도메인 변경 시 설정 한 곳만 수정
 * 
 * 2. **서버 사이드 (SSR/SSG)**:
 *    - 내부 API URL 사용 (Docker 환경)
 *    - 컨테이너 간 통신: http://terra-server:3001
 *    - 로컬 개발: http://localhost:3001
 *    - 이유: 서버는 브라우저 프록시를 사용할 수 없음
 * 
 * **환경 변수:**
 * - INTERNAL_API_URL: Docker/프로덕션 환경에서 내부 API 주소
 * - 미설정 시 localhost:3001로 폴백 (로컬 개발용)
 * 
 * **배포 환경 예시:**
 * ```env
 * # .env.production
 * INTERNAL_API_URL=http://terra-server:3001
 * ```
 */

/**
 * @function getApiBaseUrl
 * @description 현재 실행 환경에 맞는 API 기본 URL을 반환
 * 
 * @returns {string} API 기본 URL (프로토콜 + 도메인)
 * 
 * @example
 * // 클라이언트 사이드 (브라우저)
 * getApiBaseUrl(); // → ''
 * 
 * // 서버 사이드 (Docker)
 * process.env.INTERNAL_API_URL = 'http://terra-server:3001';
 * getApiBaseUrl(); // → 'http://terra-server:3001'
 * 
 * // 서버 사이느 (로컬)
 * getApiBaseUrl(); // → 'http://localhost:3001'
 * 
 * @analysis
 * **환경 판별 로직:**
 * 
 * `typeof window !== 'undefined'`:
 * - window 객체는 브라우저에만 존재
 * - Node.js (서버)에서는 undefined
 * - React의 SSR/SSG 시 서버에서도 컴포넌트 실행되므로 구분 필수
 * 
 * **실행 흐름:**
 * 1. window 존재 확인 → 브라우저면 '' 반환
 * 2. INTERNAL_API_URL 환경변수 확인 → 있으면 사용
 * 3. 둘 다 아니면 localhost:3001 폴백
 */
export const getApiBaseUrl = (): string => {
    // === 1단계: 클라이언트 사이드 확인 ===
    /**
     * 브라우저 환경 판별:
     * 
     * typeof window !== 'undefined':
     * - 브라우저: window 객체 존재 (true)
     * - Node.js: window 객체 없음 (false)
     * 
     * 브라우저에서는 Next.js 프록시 사용:
     * - fetch('/api/users') → next.config.js rewrites
     * - rewrites가 자동으로 http://localhost:3001/api/users로 전달
     * - 클라이언트는 백엔드 주소를 알 필요 없음
     */
    if (typeof window !== 'undefined') {
        return ''; // 빈 문자열 = 상대 경로 사용
    }

    // === 2단계: 서버 사이드 - Docker/프로덕션 환경 ===
    /**
     * 내부 API URL 환경변수:
     * 
     * Docker Compose 예시:
     * ```yaml
     * services:
     *   terra-client:
     *     environment:
     *       INTERNAL_API_URL: http://terra-server:3001
     * ```
     * 
     * 컨테이너 네트워크:
     * - terra-server: 서비스 이름으로 접근 가능
     * - localhost 사용 불가 (각 컨테이너가 별도 환경)
     */
    if (process.env.INTERNAL_API_URL) {
        return process.env.INTERNAL_API_URL;
    }

    // === 3단계: 서버 사이드 - 로컬 개발 환경 ===
    /**
     * 기본 폴백:
     * 
     * 로컬 개발 시나리오:
     * 1. 터미널 1: terra-server 실행 (port 3001)
     * 2. 터미널 2: terra-client 실행 (port 3000)
     * 3. SSR 시 서버가 localhost:3001로 데이터 fetch
     * 
     * 참고:
     * - 브라우저는 1단계에서 이미 반환됨
     * - 이 코드는 SSR/SSG 빌드 타임에만 실행
     */
    return 'http://localhost:3001';
};

/**
 * @const API_BASE_URL
 * @description 전역적으로 사용할 API 기본 URL
 * 
 * 사용 예시:
 * ```typescript
 * import { API_BASE_URL } from '@/lib/config';
 * 
 * const response = await fetch(`${API_BASE_URL}/api/users`);
 * ```
 * 
 * 결과:
 * - 브라우저: fetch('/api/users')
 * - SSR: fetch('http://localhost:3001/api/users')
 * 
 * 장점:
 * - 한 번만 호출 (모듈 로드 시)
 * - 모든 코드에서 일관된 URL 사용
 * - 환경 변경 시 이 파일만 수정
 */
export const API_BASE_URL = getApiBaseUrl();
