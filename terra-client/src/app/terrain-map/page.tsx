"use client";

import { useEffect, useState, useCallback } from "react";
import SystemMenu from "@/components/SystemMenu";
import dynamic from 'next/dynamic';
import { useGeolocation } from '@/hooks/useGeolocation';
import { TILE_PROVIDERS, type TileProvider } from '@/components/map/TileProviderSelector';
import { useRouter } from 'next/navigation';
import FloatingGamePanel from '@/components/map/FloatingGamePanel';

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
const ZoomLevelDisplay = dynamic(
    () => import('@/components/map/ZoomLevelDisplay'),
    { ssr: false }
);
const LocationButton = dynamic(
    () => import('@/components/map/LocationButton'),
    { ssr: false }
);
const UserLocationMarker = dynamic(
    () => import('@/components/map/UserLocationMarker'),
    { ssr: false }
);
const PlayerMarker = dynamic(
    () => import('@/components/map/PlayerMarker'),
    { ssr: false }
);
const MovementRange = dynamic(
    () => import('@/components/map/MovementRange'),
    { ssr: false }
);
const BuildingMarkers = dynamic(
    () => import('@/components/map/BuildingMarkers'),
    { ssr: false }
);
const BuildingInteractionModal = dynamic(
    () => import('@/components/map/BuildingInteractionModal'),
    { ssr: false }
);
const AssignUnitModal = dynamic(
    () => import('@/components/map/AssignUnitModal'),
    { ssr: false }
);
const MapClickHandler = dynamic(
    () => import('@/components/map/MapClickHandler'),
    { ssr: false }
);
const ToastNotification = dynamic(
    () => import('@/components/ui/ToastNotification'),
    { ssr: false }
);

interface Building {
    id: number;
    type: string;
    lat: number;
    lng: number;
    level?: number; // Optional, defaults to 1
}

function MapResizer() {
    useEffect(() => {
        // Leaflet 맵 초기화를 위한 코드
        import('leaflet').then(L => {
            // @ts-expect-error L.Icon.Default.prototype._getIconUrl is a private API. Leaflet needs this for correct marker icon display.
            delete L.Icon.Default.prototype._getIconUrl;
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

    // Default position - will be replaced by GPS if available
    const [defaultPosition] = useState<[number, number]>([37.5665, 126.9780]); // Seoul
    const [currentZoom, setCurrentZoom] = useState(14);
    const [playerPosition, setPlayerPosition] = useState<[number, number]>(defaultPosition);
    const [buildings, setBuildings] = useState<Building[]>([]);
    const [minions, setMinions] = useState<any[]>([]);
    const [currentTileProvider, setCurrentTileProvider] = useState('openstreetmap');
    const [isConstructing, setIsConstructing] = useState(false);
    const [constructionTimeLeft, setConstructionTimeLeft] = useState(0);
    const [playerResources, setPlayerResources] = useState({ gold: 1000, gem: 10 });

    // Building interaction states
    const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);
    const [showBuildingModal, setShowBuildingModal] = useState(false);
    const [showAssignModal, setShowAssignModal] = useState(false);

    // Toast state
    const [toast, setToast] = useState({ show: false, message: '', type: 'info' as 'info' | 'error' | 'success' });

    const showToast = useCallback((message: string, type: 'info' | 'error' | 'success' = 'info') => {
        setToast({ show: true, message, type });
    }, []);

    // Admin check
    const userId = typeof window !== 'undefined' ? localStorage.getItem('terra_user_id') : null;
    const isAdmin = userId === '1';
    const maxMovementRange = isAdmin ? 100 : 10; // Admin: 100km, Normal: 10km

    // Tile provider state
    const [tileProvider, setTileProvider] = useState<TileProvider>(TILE_PROVIDERS[0]);

    // GPS location tracking
    const geolocation = useGeolocation({
        watch: true,
        enableHighAccuracy: true,
    });

    // Map ref
    const [map, setMap] = useState<L.Map | null>(null);

    // Leaflet CSS 동적 로드
    useEffect(() => {
        // Main Leaflet CSS
        const leafletCSS = document.createElement('link');
        leafletCSS.rel = 'stylesheet';
        leafletCSS.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(leafletCSS);

        // Custom map styles
        const customCSS = document.createElement('link');
        customCSS.rel = 'stylesheet';
        customCSS.href = '/leaflet/map-custom.css';
        document.head.appendChild(customCSS);

        return () => {
            if (document.head.contains(leafletCSS)) {
                document.head.removeChild(leafletCSS);
            }
            if (document.head.contains(customCSS)) {
                document.head.removeChild(customCSS);
            }
        };
    }, []);

    const loadGameState = useCallback(async () => {
        try {
            const userId = localStorage.getItem('terra_user_id');
            if (!userId) {
                console.warn('[GameState] No user ID found');
                router.push('/login');
                return;
            }

            console.log(`[GameState] Loading for user ${userId}...`);
            const response = await fetch(`http://localhost:3001/api/game/state?userId=${userId}`);

            if (response.ok) {
                const data = await response.json();
                console.log('[GameState] Loaded:', data);

                // Convert x, y coordinates to lat, lng if needed
                if (data.buildings && data.buildings.length > 0) {
                    const mappedBuildings = data.buildings.map((b: { id: number; type: string; x: number; y: number; level?: number }) => ({
                        id: b.id,
                        type: b.type,
                        lat: b.x, // Assuming x is lat for now
                        lng: b.y, // Assuming y is lng for now
                        level: b.level || 1, // Default to level 1
                    }));
                    setBuildings(mappedBuildings);
                    console.log(`[GameState] Loaded ${mappedBuildings.length} buildings`);
                } else {
                    console.log('[GameState] No buildings found');
                    setBuildings([]);
                }

                // Load player position if available
                if (data.playerPosition) {
                    const { x, y } = data.playerPosition;
                    if (x && y) {
                        setPlayerPosition([x, y]);
                        console.log(`[GameState] Player position restored: ${x}, ${y}`);
                    }
                } else {
                    console.log('[GameState] No saved position, using GPS or default');
                }
            } else {
                console.error('[GameState] Failed to load:', response.status);
            }

            // Load minions separately
            const minionsResponse = await fetch(`http://localhost:3001/api/characters/minions?userId=${userId}`);
            if (minionsResponse.ok) {
                const minionsData = await minionsResponse.json();
                setMinions(minionsData);
                console.log(`[GameState] Loaded ${minionsData.length} minions`);
            }
        } catch (error) {
            console.error('[GameState] Error loading game state:', error);
        }
    }, [router]);

    // Load game state on mount
    useEffect(() => {
        loadGameState();
    }, [loadGameState]);

    // Initialize player position from GPS only if no saved position
    useEffect(() => {
        if (geolocation.position && playerPosition[0] === defaultPosition[0] && playerPosition[1] === defaultPosition[1]) {
            // Only use GPS if we're still at default position (no saved position loaded)
            setPlayerPosition(geolocation.position);
            console.log('[GPS] Using GPS position:', geolocation.position);
        }
    }, [geolocation.position]);

    // Check if player is out of range from GPS (only when GPS changes)
    useEffect(() => {
        if (!geolocation.position) return;

        const userId = localStorage.getItem('terra_user_id');
        const isAdmin = userId === '1';
        const maxRange = isAdmin ? 100 : 10; // Admin: 100km, Normal: 10km

        const distanceFromGPS = calculateDistance(
            playerPosition[0],
            playerPosition[1],
            geolocation.position[0],
            geolocation.position[1]
        );

        if (distanceFromGPS > maxRange) {
            console.warn(`[GPS] Player is ${distanceFromGPS.toFixed(2)}km from GPS. Resetting to GPS position.`);
            setPlayerPosition(geolocation.position);
        }
    }, [geolocation.position, playerPosition, defaultPosition]); // Check constraints when position updates

    const handlePlayerMove = async (position: [number, number]) => {
        try {
            const userId = localStorage.getItem('terra_user_id');
            const response = await fetch('http://localhost:3001/api/game/move', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, x: position[0], y: position[1] }),
            });

            if (response.ok) {
                setPlayerPosition(position);
            }
        } catch (error) {
            console.error('Failed to save player position:', error);
        }
    };

    const handleBuildingConstruct = async (buildingId: string) => {
        if (isConstructing) return;

        // Check if user is admin
        const userId = localStorage.getItem('terra_user_id');
        const isAdmin = userId === '1'; // User ID 1 is admin

        const buildingDefs: Record<string, { buildTime: number; adminBuildTime: number; cost: { gold: number; gem: number } }> = {
            mine: { buildTime: 30, adminBuildTime: 3, cost: { gold: 100, gem: 0 } },
            warehouse: { buildTime: 20, adminBuildTime: 2, cost: { gold: 50, gem: 0 } },
            barracks: { buildTime: 25, adminBuildTime: 2, cost: { gold: 75, gem: 0 } },
        };

        const building = buildingDefs[buildingId];
        if (!building) return;

        // Use admin build time if user is admin
        const actualBuildTime = isAdmin ? building.adminBuildTime : building.buildTime;

        try {
            const userId = localStorage.getItem('terra_user_id');
            const response = await fetch('http://localhost:3001/api/game/build', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    type: buildingId,
                    x: playerPosition[0],
                    y: playerPosition[1],
                }),
            });

            if (response.ok) {
                const newBuilding = await response.json();

                // Deduct resources
                setPlayerResources(prev => ({
                    gold: prev.gold - building.cost.gold,
                    gem: prev.gem - building.cost.gem
                }));

                // Start construction timer
                setIsConstructing(true);
                setConstructionTimeLeft(actualBuildTime);

                const timer = setInterval(() => {
                    setConstructionTimeLeft(prev => {
                        if (prev <= 1) {
                            clearInterval(timer);
                            setIsConstructing(false);

                            // Reload entire game state from server instead of manually adding
                            loadGameState();

                            return 0;
                        }
                        return prev - 1;
                    });
                }, 1000);
            }
        } catch (error) {
            console.error('Failed to construct building:', error);
        }
    };

    const handleBuildingClick = (building: Building) => {
        setSelectedBuilding(building);
        setShowBuildingModal(true);
        if (map) {
            map.flyTo([building.lat, building.lng], 16);
        }
    };

    const handleAssignUnit = () => {
        setShowBuildingModal(false);
        setShowAssignModal(true);
    };

    const handleAssignComplete = () => {
        setShowAssignModal(false);
        setShowBuildingModal(true);
    };

    const handleCollectResources = () => {
        // Reload game state to update resources
        loadGameState();
    };

    const handleDestroyBuilding = async () => {
        if (!selectedBuilding) return;

        try {
            const userId = localStorage.getItem('terra_user_id');
            const response = await fetch(
                `http://localhost:3001/api/game/building/${selectedBuilding.id}?userId=${userId}`,
                { method: 'DELETE' }
            );

            if (response.ok) {
                alert('건물이 파괴되었습니다');
                setShowBuildingModal(false);
                setSelectedBuilding(null);
                // Reload game state to update building list
                loadGameState();
            } else {
                alert('건물 파괴에 실패했습니다');
            }
        } catch (error) {
            console.error('Failed to destroy building:', error);
            alert('건물 파괴 중 오류가 발생했습니다');
        }
    };

    // Use GPS position as center if available, otherwise use default
    const mapCenter = geolocation.position || defaultPosition;

    return (
        <div className="min-h-screen bg-background text-white p-4 overflow-hidden">
            <header className="flex items-center justify-between mb-4 pb-2 border-b border-surface-border relative z-[900]">
                <div className="flex items-center gap-4">
                    <SystemMenu activePage="terrain" />
                    <div>
                        <h1 className="text-xl font-bold flex items-center gap-2 text-cyan-400">
                            🏔️ TERRAIN MAP (GAME MODE)
                        </h1>
                        <p className="text-xs text-gray-500 font-mono">
                            GPS TRACKING // 10KM RANGE // BUILDING SYSTEM
                        </p>
                    </div>
                </div>

                {/* GPS Status indicator */}
                <div className="flex items-center gap-3">
                    {geolocation.loading && (
                        <div className="text-xs text-yellow-400 font-mono animate-pulse">
                            🛰️ Acquiring GPS...
                        </div>
                    )}
                    {geolocation.error && (
                        <div className="text-xs text-red-400 font-mono">
                            ⚠️ {geolocation.error}
                        </div>
                    )}
                    {geolocation.watching && !geolocation.error && (
                        <div className="text-xs text-green-400 font-mono">
                            🟢 GPS Active
                        </div>
                    )}
                    <div className="text-xs text-slate-400 font-mono">
                        💰 {playerResources.gold} | 💎 {playerResources.gem}
                    </div>
                    <div className="text-xs text-slate-400 font-mono">
                        Buildings: {buildings.length}
                    </div>
                    {isConstructing && (
                        <div className="text-xs text-orange-400 font-mono animate-pulse">
                            🏗️ Building... {constructionTimeLeft}s
                        </div>
                    )}
                </div>
            </header>

            <div className="map-container h-[calc(100vh-120px)] overflow-hidden relative rounded-lg border border-surface-border">
                <MapContainer
                    center={mapCenter}
                    zoom={currentZoom}
                    style={{ height: '100%', width: '100%', background: '#242f3e' }}
                    zoomControl={true}
                    minZoom={2}
                    maxZoom={tileProvider.maxZoom || 19}
                    ref={setMap}
                    doubleClickZoom={false}
                >
                    {/* Tile layer with selected provider */}
                    <TileLayer
                        key={tileProvider.id}
                        attribution={tileProvider.attribution}
                        url={tileProvider.url}
                        maxZoom={tileProvider.maxZoom}
                    />

                    {/* Movement range circle (10km) */}
                    <MovementRange
                        center={geolocation?.position || playerPosition}
                        radiusKm={maxMovementRange}
                    />

                    {/* Player character marker */}
                    <PlayerMarker
                        initialPosition={playerPosition}
                        maxDistanceKm={maxMovementRange}
                        onMove={handlePlayerMove}
                        isConstructing={isConstructing}
                        constructionTimeLeft={constructionTimeLeft}
                        isAdmin={isAdmin}
                    />

                    {/* Building markers */}
                    <BuildingMarkers
                        buildings={buildings}
                        onBuildingClick={handleBuildingClick}
                    />

                    {/* User location marker (GPS) */}
                    <UserLocationMarker
                        geolocation={geolocation}
                        showAccuracyCircle={true}
                    />

                    {/* Zoom level display */}
                    <ZoomLevelDisplay onZoomChange={setCurrentZoom} />

                    {/* Location button */}
                    <LocationButton
                        geolocation={geolocation}
                        autoCenter={false}
                    />
                    <MapResizer />
                    <MapClickHandler
                        isConstructing={isConstructing}
                        geolocation={geolocation}
                        playerPosition={playerPosition}
                        maxMovementRange={maxMovementRange}
                        onMove={handlePlayerMove}
                        calculateDistance={calculateDistance}
                        onError={(msg) => showToast(msg, 'error')}
                    />
                </MapContainer>

                {/* Unified Floating Game Panel */}
                <FloatingGamePanel
                    playerPosition={playerPosition}
                    playerResources={playerResources}
                    buildings={buildings}
                    isConstructing={isConstructing}
                    constructionTimeLeft={constructionTimeLeft}
                    minions={minions}
                    onBuild={handleBuildingConstruct}
                    onBuildingClick={handleBuildingClick}
                    currentTileProvider={tileProvider.id}
                    onTileProviderChange={setTileProvider}
                    tileProviders={TILE_PROVIDERS}
                />

                <div className="absolute bottom-4 left-4 z-[1000] text-gray-500 text-xs font-mono pointer-events-none">
                    TERRAIN // GAME_MODE // {tileProvider.name.toUpperCase()}
                </div>
            </div>

            {/* Building Interaction Modals */}
            {selectedBuilding && (
                <>
                    <BuildingInteractionModal
                        building={selectedBuilding}
                        isOpen={showBuildingModal}
                        onClose={() => setShowBuildingModal(false)}
                        onAssignUnit={handleAssignUnit}
                        onCollectResources={handleCollectResources}
                        onDestroyBuilding={handleDestroyBuilding}
                    />
                    <AssignUnitModal
                        buildingId={selectedBuilding.id}
                        buildingType={selectedBuilding.type}
                        isOpen={showAssignModal}
                        onClose={() => setShowAssignModal(false)}
                        onAssigned={handleAssignComplete}
                    />
                </>
            )}

            {/* Toast Notification */}
            <ToastNotification
                show={toast.show}
                message={toast.message}
                type={toast.type}
                onClose={() => setToast(prev => ({ ...prev, show: false }))}
            />
        </div>
    );
}

// Helper moved outside to avoid dependency cycle
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};
