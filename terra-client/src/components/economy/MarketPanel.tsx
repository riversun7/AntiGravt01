'use client';

import React, { useEffect, useState } from 'react';
import { Store, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';

interface MarketPrice {
    resource_type: string;
    current_price: number;
    base_price: number;
    demand: number;
    supply: number;
    last_updated: string;
}

interface WarehouseData {
    id: number;
    user_id: number;
    capacity: number;
    stored_resources: Record<string, number>;
}

export default function MarketPanel({ userId }: { userId: number }) {
    const [prices, setPrices] = useState<MarketPrice[]>([]);
    const [warehouse, setWarehouse] = useState<WarehouseData | null>(null);
    const [loading, setLoading] = useState(true);
    const [selling, setSelling] = useState<string | null>(null);

    useEffect(() => {
        fetchData();
    }, [userId]);

    const fetchData = async () => {
        try {
            const [pricesRes, warehouseRes] = await Promise.all([
                fetch(`/api/market/prices`),
                fetch(`/api/warehouse/${userId}`)
            ]);

            const pricesData = await pricesRes.json();
            const warehouseData = await warehouseRes.json();

            setPrices(pricesData.prices);
            setWarehouse(warehouseData.warehouse);
        } catch (error) {
            console.error('Failed to fetch market data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSell = async (resourceType: string, quantity: number) => {
        setSelling(resourceType);
        try {
            const response = await fetch(`/api/market/sell`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, resourceType, quantity })
            });

            const data = await response.json();

            if (data.success) {
                alert(`판매 완료! ${data.goldEarned} 골드를 획득했습니다.`);
                fetchData(); // Refresh data
            } else {
                alert(`판매 실패: ${data.error}`);
            }
        } catch (error) {
            console.error('Failed to sell:', error);
            alert('판매 중 오류가 발생했습니다.');
        } finally {
            setSelling(null);
        }
    };

    if (loading) {
        return <div className="text-gray-400">시장 정보 로딩 중...</div>;
    }

    return (
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center gap-3 mb-4">
                <Store className="text-green-400" size={24} />
                <h2 className="text-xl font-bold text-white">시장</h2>
            </div>

            <div className="space-y-3">
                {prices.map((price) => {
                    const userQuantity = warehouse?.stored_resources[price.resource_type] || 0;
                    const priceChange = price.current_price - price.base_price;
                    const priceChangePercent = ((priceChange / price.base_price) * 100).toFixed(1);

                    return (
                        <div
                            key={price.resource_type}
                            className="bg-gray-700 rounded-lg p-4 flex items-center justify-between"
                        >
                            <div className="flex-1">
                                <h3 className="text-white font-semibold">{price.resource_type}</h3>
                                <div className="flex items-center gap-2 mt-1">
                                    <DollarSign size={16} className="text-yellow-400" />
                                    <span className="text-yellow-400 font-bold">{price.current_price}G</span>
                                    {priceChange !== 0 && (
                                        <span className={`text-xs flex items-center gap-1 ${priceChange > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {priceChange > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                            {priceChangePercent}%
                                        </span>
                                    )}
                                </div>
                                <div className="text-xs text-gray-400 mt-1">
                                    보유: {userQuantity}개
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleSell(price.resource_type, 1)}
                                    disabled={userQuantity < 1 || selling === price.resource_type}
                                    className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded text-sm font-semibold transition-colors"
                                >
                                    {selling === price.resource_type ? '판매 중...' : '1개 판매'}
                                </button>
                                {userQuantity >= 10 && (
                                    <button
                                        onClick={() => handleSell(price.resource_type, 10)}
                                        disabled={selling === price.resource_type}
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded text-sm font-semibold transition-colors"
                                    >
                                        10개 판매
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
