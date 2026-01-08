"use client";

import { useEffect, useState, useCallback } from "react";
import SystemMenu from "@/components/SystemMenu";
import dynamic from 'next/dynamic';
import { useGeolocation } from '@/hooks/useGeolocation';
import { TILE_PROVIDERS, type TileProvider } from '@/components/map/TileProviderSelector';
import { useRouter } from 'next/navigation';
import FloatingGamePanel from '@/components/map/FloatingGamePanel';
import { API_BASE_URL } from "@/lib/config";

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
const TileInfoModal = dynamic(
    () => import('@/components/map/TileInfoModal'),
    { ssr: false }
);
const TerritoryOverlay = dynamic(
    () => import('@/components/map/TerritoryOverlay'),
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

    // Tile interaction states
    const [selectedTile, setSelectedTile] = useState<any>(null);
    const [showTileModal, setShowTileModal] = useState(false);
    const [tileBuildings, setTileBuildings] = useState<any[]>([]);
    const [ownedTiles, setOwnedTiles] = useState<any[]>([]);
    const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });

    const [territories, setTerritories] = useState<any[]>([]);

    const handleTileClick = async (lat: number, lng: number, point?: { x: number; y: number }) => {
        // Convert lat/lng to tile coordinates (160x80 grid) for legacy reference/info
        const x = Math.floor((lng + 180) / 360 * 160);
        const y = Math.floor((90 - lat) / 180 * 80);
        const tileId = `${x}_${y}`;

        if (point) {
            setPopupPosition(point);
        }

        console.log(`[Tile Click] Lat: ${lat}, Lng: ${lng} -> Tile: ${tileId} (${x}, ${y})`);

        // Check if point is inside any territory
        // Simple radius check (client-side approximation)
        let ownerId = null;
        let ownerTerritory = null;

        for (const t of territories) {
            const dist = calculateDistance(lat, lng, t.x, t.y); // t.x is Lat? Wait, valid data check needed.
            // Server returns t.x, t.y. In DB schema x usually mapped to Lat?
            // Actually in server.js: x=lat, y=lng in some places, but check construct:
            // INSERT INTO user_buildings (..., x, y, ...) VALUES (..., x, y, ...)
            // body: { x: lat, y: lng } -> so t.x is Lat, t.y is Lng.
            if (dist <= (t.territory_radius || 5.0)) {
                ownerId = t.user_id;
                ownerTerritory = t;
                // Midpoint check if multiple? For now just take the first or closest.
                // TODO: Strict Voronoi check.
                break;
            }
        }

        try {
            // We still fetch tile info for terrain type, usage, etc.
            const response = await fetch(`${API_BASE_URL}/api/tiles/${tileId}`);
            let tileData = null;
            let currentBuildings = [];

            if (response.ok) {
                const data = await response.json();
                tileData = data.tile;
                currentBuildings = data.buildings || [];
            } else {
                tileData = {
                    id: tileId, x, y, type: 'OCEAN', name: `Sector ${x}-${y}`, owner_id: null, faction: null
                };
            }

            // Override owner_id with our radius calculation
            // This ensures visuals match logic
            const effectiveOwner = ownerId || tileData.owner_id; // Prefer radius owner, fallback to tile (if any)

            setSelectedTile({
                ...tileData,
                id: tileId, // Keep grid ID for reference
                clickLat: lat,
                clickLng: lng,
                owner_id: effectiveOwner,
                isTerritoryCenter: false // Will be determined by selected building?
            });
            setTileBuildings(currentBuildings);
            setShowTileModal(true);

        } catch (error) {
            console.error('Failed to fetch tile info:', error);
        }
    };

    const handleConstructTerritory = async () => {
        if (!selectedTile) return;
        // Use coords from click
        const lat = selectedTile.clickLat || selectedTile.x; // Fallback? ClickLat should be there
        const lng = selectedTile.clickLng || selectedTile.y;

        // Check if lat/lng are actual coords or grid?
        // In handleTileClick, we set clickLat/clickLng.
        // If undefined, we can't build precisely.

        await handleConstructBuilding('COMMAND_CENTER');
    };

    // Deprecated
    const handleClaimTile = async () => {
        alert("타일 소유권 주장은 더 이상 사용되지 않습니다. '사령부(Command Center)'를 건설하여 영토를 확보하세요.");
    };

    const handleConstructBuilding = async (buildingType: string) => {
        if (!selectedTile) return;

        const userId = localStorage.getItem('terra_user_id');
        // Use precise click coordinates if available, otherwise tile center (approx)
        const lat = selectedTile.clickLat;
        const lng = selectedTile.clickLng;

        try {
            const response = await fetch(`${API_BASE_URL}/api/buildings/construct`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    tileId: selectedTile.id,
                    type: buildingType, // Changed from buildingType to type to match server
                    x: lat, // Lat
                    y: lng  // Lng
                }),
            });

            const data = await response.json();
            if (response.ok) {
                alert(`${buildingType} 건설 완료!`);
                // Update local state
                setTileBuildings([...tileBuildings, data.building]);
                loadGameState();
            } else {
                alert(`건설 실패: ${data.error}`);
            }
        } catch (error) {
            console.error('Construction failed:', error);
            alert('오류가 발생했습니다.');
        }
    };

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
            const response = await fetch(`${API_BASE_URL}/api/game/state?userId=${userId}`);

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
            const minionsResponse = await fetch(`${API_BASE_URL}/api/characters/minions?userId=${userId}`);
            if (minionsResponse.ok) {
                const minionsData = await minionsResponse.json();
                setMinions(minionsData);
                console.log(`[GameState] Loaded ${minionsData.length} minions`);
            }

            // Load owned tiles for overlay (Legacy)
            const tilesResponse = await fetch(`${API_BASE_URL}/api/tiles/user/${userId}`);
            if (tilesResponse.ok) {
                const tilesData = await tilesResponse.json();
                setOwnedTiles(tilesData.tiles || []);
            }

            // Load all territories (Radius system)
            const territoriesResponse = await fetch(`${API_BASE_URL}/api/territories`);
            if (territoriesResponse.ok) {
                const tData = await territoriesResponse.json();
                setTerritories(tData.territories || []);
                console.log(`[GameState] Loaded ${tData.territories?.length || 0} territories`);
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
            const response = await fetch(`${API_BASE_URL}/api/game/move`, {
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
            COMMAND_CENTER: { buildTime: 60, adminBuildTime: 5, cost: { gold: 500, gem: 5 } },
            mine: { buildTime: 30, adminBuildTime: 3, cost: { gold: 100, gem: 0 } },
            warehouse: { buildTime: 20, adminBuildTime: 2, cost: { gold: 50, gem: 0 } },
            barracks: { buildTime: 25, adminBuildTime: 2, cost: { gold: 75, gem: 0 } },
            farm: { buildTime: 20, adminBuildTime: 2, cost: { gold: 75, gem: 0 } },
            factory: { buildTime: 40, adminBuildTime: 4, cost: { gold: 200, gem: 0 } },
        };

        const building = buildingDefs[buildingId] || buildingDefs[buildingId.toUpperCase()] || buildingDefs[buildingId.toLowerCase()];
        if (!building) {
            console.error('Unknown building type:', buildingId);
            return;
        }

        // Use admin build time if user is admin
        const actualBuildTime = isAdmin ? building.adminBuildTime : building.buildTime;

        try {
            const userId = localStorage.getItem('terra_user_id');
            // Use the new endpoint which handles territory checks
            const response = await fetch(`${API_BASE_URL}/api/buildings/construct`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    type: buildingId,
                    x: playerPosition[0],
                    y: playerPosition[1],
                }),
            });

            const data = await response.json();

            if (response.ok) {
                // Deduct resources locally for immediate feedback (server already did it)
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

                            // Reload entire game state from server
                            loadGameState();
                            return 0;
                        }
                        return prev - 1;
                    });
                }, 1000);
            } else {
                alert(`건설 실패: ${data.error}`);
            }
        } catch (error) {
            console.error('Failed to construct building:', error);
            alert('건설 중 오류가 발생했습니다.');
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
                `${API_BASE_URL}/api/game/building/${selectedBuilding.id}?userId=${userId}`,
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

                    {/* Visual Overlays - Moved to below MapClickHandler or handle via TerritoryOverlay */}
                    {/* <TileOverlay ownedTiles={ownedTiles} /> Legacy removed */}

                    {/* Territory Overlay (Radius System) */}
                    <TerritoryOverlay territories={territories} currentUserId={userId} />

                    <MapResizer />
                    <MapClickHandler
                        isConstructing={isConstructing}
                        geolocation={geolocation}
                        playerPosition={playerPosition}
                        maxMovementRange={maxMovementRange}
                        onMove={handlePlayerMove}
                        calculateDistance={calculateDistance}
                        onError={(msg: string) => showToast(msg, 'error')}
                        onTileClick={handleTileClick}
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


            {/* Tile Info Modal */}
            {showTileModal && selectedTile && (
                <TileInfoModal
                    tile={selectedTile}
                    buildings={tileBuildings}
                    onClose={() => setShowTileModal(false)}
                    onClaim={handleClaimTile} // Deprecated but kept for type signature if needed
                    onBuild={handleConstructBuilding}
                    onMove={(x, y) => handlePlayerMove([selectedTile.clickLat || 0, selectedTile.clickLng || 0])}
                    userId={userId ? parseInt(userId) : null}
                    position={popupPosition}
                />
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
