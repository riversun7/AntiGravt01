'use client';

import React, { useEffect, useState } from 'react';
import { Package, TrendingUp, TrendingDown } from 'lucide-react';

interface WarehouseData {
    id: number;
    user_id: number;
    capacity: number;
    stored_resources: Record<string, number>;
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
