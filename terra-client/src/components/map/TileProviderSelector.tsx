"use client";

import { useState } from 'react';
import { Map, ChevronDown, ChevronUp } from 'lucide-react';

/**
 * @file TileProviderSelector.tsx
 * @description 지도 타일(배경) 제공자를 변경하는 드롭다운 셀렉터
 * @role 사용자 취향이나 목적(어두운 테마, 위성, 지형도 등)에 맞는 지도 스타일 선택 기능 제공
 * @dependencies react, lucide-react
 * @status Active
 * 
 * @analysis
 * - 다양한 무료 타일 제공자(CARTO, OSM, ESRI, OpenTopoMap)를 목록화하여 제공.
 * - 각 제공자별 미리보기 설명(description)이 한글로 작성되어 있음.
 */
export interface TileProvider {
    id: string;
    name: string;
    url: string;
    attribution: string;
    maxZoom?: number;
    description?: string; // 한글 설명
}

export const TILE_PROVIDERS: TileProvider[] = [
    {
        id: 'carto_dark',
        name: 'CARTO Dark',
        url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 19,
        description: '어두운 테마, 데이터 시각화에 최적화됨',
    },
    {
        id: 'carto_light',
        name: 'CARTO Light',
        url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 19,
        description: '밝은 테마, 가시성이 좋음',
    },
    {
        id: 'osm_standard',
        name: 'OpenStreetMap',
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
        description: '표준 OSM 지도',
    },
    {
        id: 'carto_voyager',
        name: 'CARTO Voyager',
        url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 19,
        description: '부드러운 색감의 여행자용 지도',
    },
    {
        id: 'esri_world_imagery',
        name: 'ESRI Satellite',
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
        maxZoom: 19,
        description: '위성 사진',
    },
    {
        id: 'opentopomap',
        name: 'OpenTopoMap',
        url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
        attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)',
        maxZoom: 17,
        description: '지형의 고저차를 보여주는 등고선 지도',
    },
];

interface TileProviderSelectorProps {
    currentProvider: string;
    onProviderChange: (provider: TileProvider) => void;
}

export default function TileProviderSelector({ currentProvider, onProviderChange }: TileProviderSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);

    const current = TILE_PROVIDERS.find(p => p.id === currentProvider) || TILE_PROVIDERS[0];

    return (
        <div className="absolute top-4 left-4 z-[1000]">
            <div className="bg-black/80 border border-cyan-500/50 rounded backdrop-blur-sm overflow-hidden">
                {/* Current selection header */}
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="w-full px-3 py-2 flex items-center justify-between gap-3 hover:bg-cyan-500/10 transition-colors"
                >
                    <div className="flex items-center gap-2">
                        <Map className="w-4 h-4 text-cyan-400" />
                        <div className="text-left">
                            <div className="text-xs text-gray-400 font-mono">지도 스타일 (MAP)</div>
                            <div className="text-sm font-semibold text-white">{current.name}</div>
                        </div>
                    </div>
                    {isOpen ? (
                        <ChevronUp className="w-4 h-4 text-cyan-400" />
                    ) : (
                        <ChevronDown className="w-4 h-4 text-cyan-400" />
                    )}
                </button>

                {/* Provider list */}
                {isOpen && (
                    <div className="border-t border-cyan-500/30 max-h-96 overflow-y-auto">
                        {TILE_PROVIDERS.map((provider) => (
                            <button
                                key={provider.id}
                                onClick={() => {
                                    onProviderChange(provider);
                                    setIsOpen(false);
                                }}
                                className={`
                  w-full px-3 py-2 text-left transition-colors border-b border-gray-800/50 last:border-b-0
                  ${provider.id === currentProvider
                                        ? 'bg-cyan-500/20 text-cyan-400'
                                        : 'text-gray-300 hover:bg-gray-800/50'
                                    }
                `}
                            >
                                <div className="font-semibold text-sm">{provider.name}</div>
                                {provider.description && (
                                    <div className="text-xs text-gray-500 mt-0.5">{provider.description}</div>
                                )}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Quick info */}
            {!isOpen && current.description && (
                <div className="mt-2 text-xs text-gray-500 font-mono max-w-[200px]">
                    {current.description}
                </div>
            )}
        </div>
    );
}
