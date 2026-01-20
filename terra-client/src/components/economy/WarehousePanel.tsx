'use client';

import React, { useEffect, useState } from 'react';
import { Package, TrendingUp, TrendingDown } from 'lucide-react';

/**
 * @file WarehousePanel.tsx
 * @description 사용자의 창고 현황을 보여주는 패널 컴포넌트
 * @role 창고 내 자원 보유량 및 용량(Capacity) 시각화
 * @dependencies react, lucide-react
 * @status Active
 * 
 * @analysis
 * - 용량 초과 시에 대한 시각적 경고(빨간색 막대)는 구현되어 있음.
 * - 자원 종류가 많아질 경우 스크롤 처리는 상위 컨테이너에 의존하거나 내부적으로 추가해야 함.
 * - 현재는 읽기 전용 뷰이며, 창고 업그레이드 기능 등은 별도 컴포넌트(BuildingInteractionModal 등)에서 처리됨을 유의.
 */
interface WarehouseData {
    id: number;
    user_id: number;
    capacity: number; // 최대 저장 용량
    stored_resources: Record<string, number>; // 자원 종류별 수량 (JSON 필드)
}

export default function WarehousePanel({ userId }: { userId: number }) {
    const [warehouse, setWarehouse] = useState<WarehouseData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchWarehouse = async () => {
            try {
                const response = await fetch(`/api/warehouse/${userId}`);
                const data = await response.json();
                setWarehouse(data.warehouse);
            } catch (error) {
                console.error('Failed to fetch warehouse:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchWarehouse();
    }, [userId]);

    if (loading) {
        return <div className="text-gray-400">창고 정보 로딩 중...</div>;
    }

    if (!warehouse) {
        return <div className="text-red-400">창고 정보를 불러올 수 없습니다.</div>;
    }

    // 총 저장량 계산 및 시각화용 비율 산출
    const totalStored = Object.values(warehouse.stored_resources).reduce((sum, qty) => sum + qty, 0);
    const usagePercent = (totalStored / warehouse.capacity) * 100;

    return (
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center gap-3 mb-4">
                <Package className="text-blue-400" size={24} />
                <h2 className="text-xl font-bold text-white">창고</h2>
            </div>

            {/* Capacity Bar */}
            <div className="mb-6">
                <div className="flex justify-between text-sm text-gray-400 mb-2">
                    <span>용량</span>
                    <span>{totalStored} / {warehouse.capacity}</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
                    <div
                        className={`h-full transition-all ${usagePercent > 90 ? 'bg-red-500' :
                            usagePercent > 70 ? 'bg-yellow-500' :
                                'bg-green-500'
                            }`}
                        style={{ width: `${usagePercent}%` }}
                    />
                </div>
            </div>

            {/* Resources List */}
            <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-400 uppercase">저장된 자원</h3>
                {Object.entries(warehouse.stored_resources).length === 0 ? (
                    <p className="text-gray-500 text-sm">자원이 없습니다</p>
                ) : (
                    Object.entries(warehouse.stored_resources).map(([resourceType, quantity]) => (
                        <div
                            key={resourceType}
                            className="flex justify-between items-center bg-gray-700 px-4 py-2 rounded"
                        >
                            <span className="text-white font-medium">{resourceType}</span>
                            <span className="text-blue-400 font-bold">{quantity}</span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
