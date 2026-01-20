/**
 * @file api.ts
 * @description 캐릭터 관련 API 호출을 위한 래퍼 함수 모음
 * @role API 호출 로직 중앙화 - 타입 안전성 및 에러 처리 제공
 * @dependencies config.ts (API_BASE_URL), @/types/character (타입 정의)
 * @usedBy 캐릭터 페이지, 미니언 관리 컴포넌트
 * @status Active
 * 
 * @analysis
 * **API 래퍼 패턴:**
 * 
 * 장점:
 * - 타입 안전: TypeScript 타입 체크
 * - 중앙화: API 변경 시 한 곳만 수정
 * - 재사용: 여러 컴포넌트에서 동일 함수 사용
 * - 에러 핸들링: 통일된 에러 처리
 * 
 * **API 그룹:**
 * - characterApi.getCyborg: 사이보그 정보 조회
 * - characterApi.getMinions: 미니언 목록 조회
 * - characterApi.restMinion: 미니언 휴식 (HP 회복)
 * - characterApi.equipItem: 장비 착용
 * 
 * **에러 처리:**
 * - !res.ok 시 Error throw
 * - 호출하는 쪽에서 try-catch로 처리
 */

import { CyborgResponse, MinionsResponse, MinionDetailResponse, MinionType } from '@/types/character';

import { API_BASE_URL } from './config';

/**
 * API 기본 경로
 * 
 * 예시:
 * - 브라우저: '' + '/api' = '/api'
 * - SSR: 'http://localhost:3001' + '/api' = 'http://localhost:3001/api'
 */
const API_BASE = `${API_BASE_URL}/api`;

/**
 * @const characterApi
 * @description 캐릭터 관련 API 엔드포인트 래퍼 객체
 * 
 * 모든 함수는 async로 Promise 반환
 * 에러 발생 시 throw Error
 */
export const characterApi = {
    // ═══ 사이보그 (플레이어 메인 캐릭터) ═══

    /**
     * 사이보그 정보 조회
     * GET /api/character/:userId/cyborg
     */
    getCyborg: async (userId: string | number): Promise<CyborgResponse> => {
        const res = await fetch(`${API_BASE}/character/${userId}/cyborg`);
        if (!res.ok) throw new Error('Failed to fetch cyborg');
        return res.json();
    },

    updateCyborg: async (userId: string | number, name: string) => {
        const res = await fetch(`${API_BASE}/character/${userId}/cyborg`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        if (!res.ok) throw new Error('Failed to update cyborg');
        return res.json();
    },

    // Minions
    getMinions: async (userId: string | number): Promise<MinionsResponse> => {
        const res = await fetch(`${API_BASE}/character/${userId}/minions`);
        if (!res.ok) throw new Error('Failed to fetch minions');
        return res.json();
    },

    getMinion: async (userId: string | number, minionId: number): Promise<MinionDetailResponse> => {
        const res = await fetch(`${API_BASE}/character/${userId}/minion/${minionId}`);
        if (!res.ok) throw new Error('Failed to fetch minion details');
        return res.json();
    },

    createMinion: async (userId: string | number, type: MinionType, name: string, species?: string) => {
        const res = await fetch(`${API_BASE}/character/${userId}/minion`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type, name, species })
        });
        if (!res.ok) throw new Error('Failed to create minion');
        return res.json();
    },

    deleteMinion: async (userId: string | number, minionId: number) => {
        const res = await fetch(`${API_BASE}/character/${userId}/minion/${minionId}`, {
            method: 'DELETE'
        });
        if (!res.ok) throw new Error('Failed to delete minion');
        return res.json();
    },

    // Mechanics
    restMinion: async (userId: string | number, minionId: number) => {
        const res = await fetch(`${API_BASE}/character/${userId}/minion/${minionId}/rest`, {
            method: 'POST'
        });
        if (!res.ok) throw new Error('Failed to rest minion');
        return res.json();
    },

    chargeMinion: async (userId: string | number, minionId: number) => {
        const res = await fetch(`${API_BASE}/character/${userId}/minion/${minionId}/charge`, {
            method: 'POST'
        });
        if (!res.ok) throw new Error('Failed to charge android');
        return res.json();
    },

    feedMinion: async (userId: string | number, minionId: number) => {
        const res = await fetch(`${API_BASE}/character/${userId}/minion/${minionId}/feed`, {
            method: 'POST'
        });
        if (!res.ok) throw new Error('Failed to feed minion');
        return res.json();
    },

    // Equipment
    equipItem: async (userId: string | number, itemId: number, slot: string) => {
        const res = await fetch(`${API_BASE}/equipment/equip`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, itemId, slot })
        });
        if (!res.ok) throw new Error('Failed to equip item');
        return res.json();
    },

    unequipItem: async (userId: string | number, slot: string) => {
        const res = await fetch(`${API_BASE}/equipment/unequip`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, slot })
        });
        if (!res.ok) throw new Error('Failed to unequip item');
        return res.json();
    }
};
