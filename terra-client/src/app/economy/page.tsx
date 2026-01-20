/**
 * @file economy/page.tsx
 * @description 경제 시스템 통합 페이지
 * @role 창고(Warehouse), 시장(Market), 미니언 상태를 한 화면에 표시
 * @dependencies WarehousePanel, MarketPanel, MinionStatusPanel
 * @status Active
 * 
 * @analysis
 * **주요 기능:**
 * - 창고: 자원 저장 및 관리
 * - 시장: 아이템 거래
 * - 미니언 상태: 작업 중인 미니언 현황
 * 
 * **레이아웃:**
 * - 2컬럼 그리드 (lg 이상)
 * - 미니언 패널은 전체 너비
 */

'use client';

import React, { useEffect, useState } from 'react';
import WarehousePanel from '@/components/economy/WarehousePanel';
import MarketPanel from '@/components/economy/MarketPanel';
import MinionStatusPanel from '@/components/minion/MinionStatusPanel';
import SystemMenu from '@/components/SystemMenu';

export default function EconomyPage() {
    const [userId, setUserId] = useState<number | null>(null);

    useEffect(() => {
        // Get user ID from localStorage
        const storedUserId = localStorage.getItem('terra_user_id');
        if (storedUserId) {
            setUserId(parseInt(storedUserId));
        }
    }, []);

    if (!userId) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <p className="text-gray-400">로그인이 필요합니다.</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 p-6">
            <SystemMenu activePage="economy" />

            <div className="max-w-7xl mx-auto">
                <h1 className="text-3xl font-bold text-white mb-8">경제 시스템</h1>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Warehouse Panel */}
                    <WarehousePanel userId={userId} />

                    {/* Market Panel */}
                    <MarketPanel userId={userId} />

                    {/* Minion Status Panel */}
                    <div className="lg:col-span-2">
                        <MinionStatusPanel userId={userId} />
                    </div>
                </div>
            </div>
        </div>
    );
}
