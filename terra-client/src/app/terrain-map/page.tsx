"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import SystemMenu from "@/components/SystemMenu";
import dynamic from 'next/dynamic';

// Leaflet은 클라이언트 사이드에서만 작동하므로 동적 import 사용
const MapContainer = dynamic(
    () => import('react-leaflet').then(mod => mod.MapContainer),
    { ssr: false }
);
const TileLayer = dynamic(
    () => import('react-leaflet').then(mod => mod.TileLayer),
    { ssr: false }
);
const Marker = dynamic(
    () => import('react-leaflet').then(mod => mod.Marker),
    { ssr: false }
);
const Popup = dynamic(
    () => import('react-leaflet').then(mod => mod.Popup),
    { ssr: false }
);


function MapResizer() {
    useEffect(() => {
        // Leaflet 맵 초기화를 위한 코드
        import('leaflet').then(L => {
            delete (L.Icon.Default.prototype as any)._getIconUrl;
            L.Icon.Default.mergeOptions({
                iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
                iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
                shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
            });
        });
    }, []);
    return null;
}

export default function TerrainMapPage() {
    const router = useRouter();
    const [position, setPosition] = useState<[number, number]>([51.505, -0.09]); // Default: London
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
        // Leaflet CSS 동적 로드
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
    }, []);

    return (
        <div className="min-h-screen bg-background text-white p-4 overflow-hidden">
            <header className="flex items-center justify-between mb-4 pb-2 border-b border-surface-border relative z-[2000]">
                <div className="flex items-center gap-4">
                    <SystemMenu activePage="terrain" />
                    <div>
                        <h1 className="text-xl font-bold flex items-center gap-2 text-cyan-400">
                            🏔️ TERRAIN MAP (LEAFLET)
                        </h1>
                        <p className="text-xs text-gray-500 font-mono">OPENSTREETMAP // LEAFLET RENDERER</p>
                    </div>
                </div>
            </header>

            <div className="map-container h-[calc(100vh-120px)] overflow-hidden relative rounded-lg border border-surface-border">
                {isClient && (
                    <MapContainer
                        center={position}
                        zoom={13}
                        style={{ height: '100%', width: '100%', background: '#242f3e' }}
                    >
                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                        />

                        <Marker position={position}>
                            <Popup>
                                Terrain Scan: Alpha Sector <br />
                                Status: Nominal
                            </Popup>
                        </Marker>

                        <MapResizer />
                    </MapContainer>
                )}

                {!isClient && (
                    <div className="flex items-center justify-center h-full text-cyan-400">
                        Loading Terrain Map...
                    </div>
                )}

                <div className="absolute bottom-4 left-4 z-[1000] text-gray-500 text-xs font-mono pointer-events-none">
                    TERRAIN COMPOSITE // LEAFLET_RENDERER
                </div>
            </div>
        </div>
    );
}
