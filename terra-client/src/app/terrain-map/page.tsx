"use client";

import { useEffect, useState, useCallback } from "react";
import SystemMenu from "@/components/SystemMenu";
import dynamic from 'next/dynamic';
import { useGeolocation } from '@/hooks/useGeolocation';
import { TILE_PROVIDERS, type TileProvider } from '@/components/map/TileProviderSelector';
import { useRouter } from 'next/navigation';

import { API_BASE_URL } from "@/lib/config";

// Leaflet은 클라이언트 사이드에서만 작동하므로 동적 import 사용
const TerrainMapContent = dynamic(
    () => import('@/components/map/TerrainMapContent'),
    { ssr: false }
);

const GameControlPanel = dynamic(
    () => import('@/components/map/GameControlPanel'),
    { ssr: false }
);
const AssignUnitModal = dynamic(
    () => import('@/components/map/AssignUnitModal'),
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

// Other helper function imports retained if needed but components like TerritoryOverlay are now inside TerrainMapContent

interface Building {
    id: number;
    type: string;
    lat: number;
    lng: number;
    level?: number;
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
    // Tile interaction states
    const [selectedTile, setSelectedTile] = useState<any>(null);
    const [selectedTerritory, setSelectedTerritory] = useState<any>(null); // Territory Info State
    const [tileBuildings, setTileBuildings] = useState<any[]>([]);
    const [ownedTiles, setOwnedTiles] = useState<any[]>([]);
    const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });

    const [territories, setTerritories] = useState<any[]>([]);

    const handleTileClick = async (lat: number, lng: number, point?: { x: number; y: number }) => {
        setSelectedTerritory(null); // Clear territory selection
        const x = Math.floor((lng + 180) / 360 * 160);
        const y = Math.floor((90 - lat) / 180 * 80);
        const tileId = `${x}_${y}`;

        if (point) {
            setPopupPosition(point);
        }

        console.log(`[Tile Click] Lat: ${lat}, Lng: ${lng} -> Tile: ${tileId} (${x}, ${y})`);

        let ownerId = null;
        for (const t of territories) {
            const dist = calculateDistance(lat, lng, t.x, t.y);
            if (dist <= (t.territory_radius || 5.0)) {
                ownerId = t.user_id;
                break;
            }
        }

        try {
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

            const effectiveOwner = ownerId || tileData.owner_id;

            setSelectedTile({
                ...tileData,
                id: tileId,
                clickLat: lat,
                clickLng: lng,
                owner_id: effectiveOwner,
                isTerritoryCenter: false,
                displayX: x, // Add grid coords for display
                displayY: y
            });
            setTileBuildings(currentBuildings);

            // Clear building selection to focus on tile
            setSelectedBuilding(null);

        } catch (error) {
            console.error('Failed to fetch tile info:', error);
        }
    };

    const handleTerritoryClick = (t: any, e: any) => {
        console.log("Territory Clicked", t);

        // Prepare info for modal
        setSelectedTerritory({
            id: t.id,
            owner_name: t.owner_name,
            level: t.level || 1,
            radius: t.territory_radius,
            is_absolute: t.npc_type === 'ABSOLUTE'
        });

        // Set position from click
        if (e && e.containerPoint) {
            setPopupPosition(e.containerPoint);
        }

        setSelectedTile(null); // Clear tile selection
    };

    // Default position - will be replaced by GPS if available
    const [defaultPosition] = useState<[number, number]>([37.5665, 126.9780]); // Seoul
    const [currentZoom, setCurrentZoom] = useState(14);
    const [playerPosition, setPlayerPosition] = useState<[number, number]>(defaultPosition);
    const [buildings, setBuildings] = useState<Building[]>([]);
    const [minions, setMinions] = useState<any[]>([]);
    const [currentTileProvider, setCurrentTileProvider] = useState('openstreetmap');
    const [isConstructing, setIsConstructing] = useState(false);
    const [constructingBuildingName, setConstructingBuildingName] = useState<string | null>(null);
    const [constructionTimeLeft, setConstructionTimeLeft] = useState(0);
    const [playerResources, setPlayerResources] = useState({ gold: 1000, gem: 10 });
    const [currentTick, setCurrentTick] = useState(Date.now()); // For pure rendering of timers

    // Building interaction states
    const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);
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
                    setBuildings([]);
                }

                // Load player position if available
                if (data.playerPosition) {
                    const { x, y } = data.playerPosition;
                    if (x && y) {
                        setPlayerPosition([x, y]);
                    }
                }
            } else {
                console.error('[GameState] Failed to load:', response.status);
            }

            // Load minions separately
            const minionsResponse = await fetch(`${API_BASE_URL}/api/characters/minions?userId=${userId}`);
            if (minionsResponse.ok) {
                const minionsData = await minionsResponse.json();
                setMinions(minionsData);
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
            setPlayerPosition(geolocation.position);
            console.log('[GPS] Using GPS position:', geolocation.position);
        }
    }, [geolocation.position, playerPosition, defaultPosition]);

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

        const buildingDefs: Record<string, { name: string; buildTime: number; adminBuildTime: number; cost: { gold: number; gem: number } }> = {
            COMMAND_CENTER: { name: '사령부', buildTime: 60, adminBuildTime: 5, cost: { gold: 500, gem: 5 } },
            mine: { name: '자원 채굴장', buildTime: 30, adminBuildTime: 3, cost: { gold: 100, gem: 0 } },
            warehouse: { name: '창고', buildTime: 20, adminBuildTime: 2, cost: { gold: 50, gem: 0 } },
            barracks: { name: '숙소', buildTime: 25, adminBuildTime: 2, cost: { gold: 75, gem: 0 } },
            farm: { name: '농장', buildTime: 20, adminBuildTime: 2, cost: { gold: 75, gem: 0 } },
            FACTORY: { name: '공장', buildTime: 120, adminBuildTime: 5, cost: { gold: 500, gem: 5 } },
        };

        const building = buildingDefs[buildingId] || buildingDefs[buildingId.toUpperCase()] || buildingDefs[buildingId.toLowerCase()];
        if (!building) {
            console.error('Unknown building type:', buildingId);
            return;
        }

        const actualBuildTime = isAdmin ? building.adminBuildTime : building.buildTime;

        try {
            const userId = localStorage.getItem('terra_user_id');
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
                setPlayerResources(prev => ({
                    gold: prev.gold - building.cost.gold,
                    gem: prev.gem - building.cost.gem
                }));

                setIsConstructing(true);
                setConstructingBuildingName(building.name || buildingId);
                setConstructionTimeLeft(actualBuildTime);

                const timer = setInterval(() => {
                    setConstructionTimeLeft(prev => {
                        if (prev <= 1) {
                            clearInterval(timer);
                            setIsConstructing(false);
                            setConstructingBuildingName(null);
                            loadGameState();
                            return 0;
                        }
                        return prev - 1;
                    });
                }, 1000);
            } else {
                showToast(`건설 실패: ${data.error}`, 'error');
            }
        } catch (error) {
            console.error('Failed to construct building:', error);
            showToast('건설 중 오류가 발생했습니다.', 'error');
        }
    };

    // --- Demolition Logic ---
    const [demolitionStates, setDemolitionStates] = useState<Record<number, number>>({});

    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            setCurrentTick(now); // Update tick for UI sync
            setDemolitionStates(prev => {
                const next = { ...prev };
                let changed = false;

                Object.keys(next).forEach(key => {
                    const id = Number(key);
                    if (now >= next[id]) {
                        delete next[id];
                        executeDestruction(id);
                        changed = true;
                    }
                });
                return changed ? next : prev;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const executeDestruction = async (buildingId: number) => {
        try {
            const userId = localStorage.getItem('terra_user_id');
            const response = await fetch(
                `${API_BASE_URL}/api/game/building/${buildingId}?userId=${userId}`,
                { method: 'DELETE' }
            );

            if (response.ok) {
                showToast(`건물이 철거되었습니다.`, 'success');
                if (selectedBuilding?.id === buildingId) {
                    setSelectedBuilding(null);
                }
                loadGameState();
            } else {
                showToast('건물 철거 실패', 'error');
            }
        } catch (error) {
            console.error('Failed to destroy building:', error);
        }
    };

    const handleRequestDemolition = (buildingId: number) => {
        const finishTime = Date.now() + 60000; // 1 minute
        setDemolitionStates(prev => ({ ...prev, [buildingId]: finishTime }));
        showToast('철거를 시작합니다. (60초 소요)', 'info');
    };

    const handleCancelDemolition = (buildingId: number) => {
        setDemolitionStates(prev => {
            const next = { ...prev };
            delete next[buildingId];
            return next;
        });
        showToast('철거가 취소되었습니다.', 'info');
    };

    const handleMoveToTile = (lat: number, lng: number) => {
        const currentPos = geolocation.position || playerPosition;
        const dist = calculateDistance(currentPos[0], currentPos[1], lat, lng);
        if (dist <= maxMovementRange) {
            setPlayerPosition([lat, lng]);
        } else {
            showToast(`Cannot move: Out of range (${maxMovementRange}km)`, 'error');
        }
    };

    const mapCenter = geolocation.position || defaultPosition;

    return (
        <div className="h-screen bg-background text-white overflow-hidden flex flex-col md:flex-row">
            {/* Main Content Area (Header + Map) */}
            <div className="flex-1 flex flex-col relative z-[0] min-h-0 md:pb-0 pb-[45vh]">
                <header className="flex flex-wrap items-center justify-between p-3 border-b border-white/5 bg-slate-900/80 backdrop-blur-md gap-2 shrink-0 relative z-[50]">
                    <div className="flex items-center gap-4">
                        <SystemMenu activePage="terrain" />
                        <div>
                            <h1 className="text-lg md:text-xl font-bold flex items-center gap-2 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 whitespace-nowrap drop-shadow-sm">
                                🏔️ TERRAIN MAP
                            </h1>
                        </div>
                    </div>

                    {/* GPS Status indicator */}
                    <div className="flex items-center gap-2 md:gap-3 flex-wrap justify-end">
                        {geolocation.loading && <div className="text-[10px] font-bold bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-2 py-1 rounded-full animate-pulse flex items-center gap-1">🛰️ SEEKING...</div>}
                        {geolocation.watching && !geolocation.error && <div className="text-[10px] font-bold bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-1 rounded-full flex items-center gap-1">🟢 GPS ACTIVE</div>}
                        {geolocation.error && <div className="text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-1 rounded-full flex items-center gap-1">🔴 NO SIGNAL</div>}
                        {isConstructing && <div className="text-[10px] font-bold bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2 py-1 rounded-full animate-pulse flex items-center gap-1">🏗️ BUILDING... {constructionTimeLeft}s</div>}
                    </div>
                </header>

                <div className="flex-1 relative overflow-hidden bg-slate-900 z-[0]">
                    <TerrainMapContent
                        mapCenter={mapCenter}
                        currentZoom={currentZoom}
                        tileProvider={tileProvider}
                        maxMovementRange={maxMovementRange}
                        geolocation={geolocation}
                        userId={userId}
                        playerPosition={playerPosition}
                        setPlayerPosition={handlePlayerMove}
                        showToast={showToast}
                        handleTileClick={handleTileClick}
                        handleTerritoryClick={handleTerritoryClick}
                        isConstructing={isConstructing}
                        constructionTimeLeft={constructionTimeLeft}
                        isAdmin={isAdmin}
                        calculateDistance={calculateDistance}
                        buildings={buildings}
                        setSelectedBuilding={setSelectedBuilding}
                        selectedTile={selectedTile}
                        setSelectedTile={setSelectedTile}
                        setMap={setMap}
                        territories={territories}
                    />

                    {/* Fixed floating toast */}
                    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[2000] pointer-events-none w-auto flex justify-center">
                        <ToastNotification
                            message={toast.message}
                            type={toast.type}
                            show={toast.show}
                            onClose={() => setToast({ ...toast, show: false })}
                        />
                    </div>
                </div>
            </div>

            {/* Side Panel (Fixed right on Desktop, Fixed Bottom on Mobile) */}
            <div className="fixed bottom-0 left-0 w-full h-[45vh] md:static md:w-[400px] md:h-full shrink-0 z-[5000] border-t md:border-t-0 md:border-l border-slate-700 shadow-xl bg-slate-900">
                <GameControlPanel
                    playerPosition={playerPosition}
                    playerResources={playerResources}
                    buildings={buildings}
                    isConstructing={isConstructing}
                    constructingBuildingName={constructingBuildingName}
                    constructionTimeLeft={constructionTimeLeft}
                    minions={minions}
                    currentTick={currentTick}
                    onBuild={handleBuildingConstruct}
                    onBuildingClick={(b) => {
                        setSelectedBuilding(b);
                        setSelectedTile(null);
                    }}
                    selectedTile={selectedTile}
                    onCloseTileInfo={() => setSelectedTile(null)}
                    onMoveToTile={(lat, lng) => handleMoveToTile(lat, lng)}

                    selectedBuilding={selectedBuilding}
                    onCloseBuildingInfo={() => setSelectedBuilding(null)}
                    demolitionStates={demolitionStates}
                    onBuildingAction={(action, buildingId) => {
                        if (action === 'assign') {
                            setShowAssignModal(true);
                        } else if (action === 'collect') {
                            showToast('자원 수집 완료! (구현 예정)', 'success');
                        } else if (action === 'destroy') {
                            handleRequestDemolition(buildingId);
                        } else if (action === 'cancel_destroy') {
                            handleCancelDemolition(buildingId);
                        }
                    }}

                    currentTileProvider={tileProvider.id}
                    onTileProviderChange={setTileProvider}
                    tileProviders={TILE_PROVIDERS}
                />
            </div>

            {/* Modals outside map container context */}
            {showAssignModal && selectedBuilding && (
                <AssignUnitModal
                    buildingId={selectedBuilding.id}
                    buildingType={selectedBuilding.type}
                    isOpen={showAssignModal}
                    onClose={() => setShowAssignModal(false)}
                    onAssigned={() => {
                        console.log(`Assigned unit to building ${selectedBuilding.id}`);
                        setShowAssignModal(false);
                        showToast(`유닛 배치 완료`, 'success');
                    }}
                />
            )}
        </div>
    );
}

// Helper moved outside to avoid dependency cycle
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};
