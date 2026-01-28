/**
 * @file terrain-map/page.tsx
 * @description Leaflet 기반 실시간 지형 지도 게임 페이지
 * @role 메인 게임 플레이 화면 - 지도, 건물, 유닛, 영토 등 모든 게임 요소 통합
 * @dependencies react-leaflet, @turf/turf, GeolocationAPI, 다수의 맵 컴포넌트
 * @status Active (주요 게임 화면)
 * 
 * @analysis
 * **핵심 기능:**
 * - 실시간 GPS 위치 추적
 * - Leaflet 지도 렌더링 (여러 타일 제공자)
 * - 건물 건설 및 관리
 * - 유닛 이동 및 할당
 * - 영토 표시 및 충돌 감지
 * - NPC 표시
 * 
 * **상태 관리 (1169줄의 대형 컴포넌트):**
 * - 플레이어 위치, 건물, 유닛, 영토 등 다수 상태
 * - 5초마다 데이터 폴링
 * - 클릭/이동 이벤트 처리
 * 
 * **최적화:**
 * - dynamic import로 SSR 방지 (Leaflet은 브라우저 전용)
 * - useMemo/useCallback으로 불필요한 리렌더 방지
 * 
 * **향후 개선:**
 * - 상태 관리 라이브러리 도입 (Zustand/Jotai)
 * - 컴포넌트 분리 (현재 너무 많은 책임)
 */

"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import SystemMenu from "@/components/SystemMenu";
import dynamic from 'next/dynamic';
import { useGeolocation } from '@/hooks/useGeolocation';
import { TILE_PROVIDERS, type TileProvider } from '@/components/map/TileProviderSelector';
import { useRouter } from 'next/navigation';
import * as turf from '@turf/turf';

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
const DiplomacyPanel = dynamic(
    () => import('@/components/ui/DiplomacyPanel'),
    { ssr: false }
);
const NpcInfoPanel = dynamic(
    () => import('@/components/map/NpcInfoPanel'),
    { ssr: false }
);
const NpcControlModal = dynamic(
    () => import('@/components/map/NpcControlModal'),
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

/**
 * @file terrain-map/page.tsx
 * @description 게임의 메인 지도 화면 (Terrain Map) 페이지
 * @role 게임의 핵심 루프 처리 (이동, 건설, 채집, 정찰), 지도 렌더링, 게임 상태 동기화
 * @dependencies react, next/dynamic, leaflet, turf.js, API_BASE_URL
 * @status Active
 * @analysis
 * 1. 이 파일은 게임의 "Main Controller" 역할을 수행하며, 로직이 매우 방대해짐 (1000줄 이상).
 * 2. 추후 MovementLogic, BuildingLogic, GameStateLoader 등으로 로직 분리가 필요함.
 * 3. `useEffect`가 많아 상태 동기화 순서가 복잡함.
 */
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

    // NPC Panel States
    const [npcRefreshKey, setNpcRefreshKey] = useState(0);
    const [showNpcAdminModal, setShowNpcAdminModal] = useState(false);

    // --- 타일 클릭 핸들러 ---
    // 지도상의 빈 땅이나 건물을 클릭했을 때 호출됨
    const handleTileClick = async (lat: number, lng: number, point?: { x: number; y: number }) => {
        // 경로 계획 모드일 경우: 웨이포인트 추가
        if (isPathPlanning) {
            // 현재 경로 끝에 새로운 지점을 추가 (Start -> Point 1 -> Point 2 ... -> New Point)
            const newWaypoints = [...waypoints, { lat, lng }];
            setWaypoints(newWaypoints);
            calculatePath(newWaypoints);
            return;
        }

        setSelectedTerritory(null); // 영토 선택 해제

        if (point) {
            setPopupPosition(point); // 팝업 위치 설정
        }

        // 겹치는 영토 찾기 (원형 및 Hull 기반 모두 포함)
        const overlappingTerritories: any[] = [];

        // 유저별 영토 그룹화 (TerritoryOverlay와 동일 로직)
        const userTerritoryGroups = new Map<string, any[]>();
        territories.forEach(t => {
            const key = String(t.user_id);
            if (!userTerritoryGroups.has(key)) userTerritoryGroups.set(key, []);
            userTerritoryGroups.get(key)!.push(t);
        });

        // 각 유저의 영토 검사
        userTerritoryGroups.forEach((userTerritories, userId) => {
            const first = userTerritories[0];
            const territoryCenters = userTerritories.filter((t: any) => t.is_territory_center === 1);
            const beacons = territoryCenters.filter((t: any) =>
                t.type === 'AREA_BEACON' || t.building_type_code === 'AREA_BEACON'
            );

            // 1. 비콘 3개 이상일 경우 Hull(다각형) 내부 검사 (turf.js 사용)
            if (beacons.length >= 3) {
                try {
                    const beaconPoints = beacons
                        .map((b: any) => {
                            const bLat = Number(b.x);
                            const bLng = Number(b.y);
                            return (!isNaN(bLat) && !isNaN(bLng)) ? turf.point([bLng, bLat]) : null;
                        })
                        .filter((p: any) => p !== null) as any[];

                    if (beaconPoints.length >= 3) {
                        const fc = turf.featureCollection(beaconPoints) as any;
                        const hull = turf.concave(fc, { maxEdge: 30, units: 'kilometers' }) ||
                            turf.convex(fc);

                        if (hull) {
                            const clickPoint = turf.point([lng, lat]);
                            const isInside = turf.booleanPointInPolygon(clickPoint, hull);

                            if (isInside) {
                                overlappingTerritories.push({
                                    user_id: userId,
                                    owner_name: first.owner_name,
                                    id: `hull_${userId}`,
                                    type: 'BEACON_HULL',
                                    radius: 'Connected'
                                });
                            }
                        }
                    }
                } catch (e) {
                    console.error('Hull check failed', e);
                }
            }

            // 2. 개별 영토(원형) 검사
            for (const t of userTerritories) {
                const dist = calculateDistance(lat, lng, t.x, t.y);
                if (dist <= (t.territory_radius || 5.0)) {
                    overlappingTerritories.push({
                        user_id: t.user_id,
                        owner_name: t.owner_name,
                        id: t.id,
                        type: t.type || t.building_type_code,
                        radius: t.territory_radius
                    });
                }
            }
        });

        // 클릭한 위치에 대한 가상 타일 객체 생성 (그리드 API 호출 제거됨)
        setSelectedTile({
            id: `loc_${lat.toFixed(4)}_${lng.toFixed(4)}`,
            x: 0,
            y: 0,
            type: 'TERRAIN', // 기본값 지형
            name: null,
            owner_id: overlappingTerritories.length > 0 ? overlappingTerritories[0].user_id : null,
            overlappingTerritories: overlappingTerritories,
            clickLat: lat,
            clickLng: lng,
            isTerritoryCenter: false,
        });

        // 클릭 위치 주변 건물 간단 필터링 (예: 100m 이내)
        const nearbyBuildings = buildings.filter(b => calculateDistance(lat, lng, b.lat, b.lng) < 0.1);
        setTileBuildings(nearbyBuildings);

        // 건물 선택 해제 (타일 정보에 집중)
        setSelectedBuilding(null);
    };

    const handleTerritoryClick = (t: any, e: any) => {
        // console.log("Territory Clicked", t);

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
    const [username, setUsername] = useState<string>('Commander');

    // Building interaction states
    const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);
    const [selectedNpc, setSelectedNpc] = useState<any>(null); // NPC Cyborg selection
    const [showAssignModal, setShowAssignModal] = useState(false);

    // Toast state
    const [toast, setToast] = useState({ show: false, message: '', type: 'info' as 'info' | 'error' | 'success' });
    const [showDiplomacy, setShowDiplomacy] = useState(false);

    // Path Planning State
    const [isPathPlanning, setIsPathPlanning] = useState(false);
    const [plannedPath, setPlannedPath] = useState<Array<{ lat: number; lng: number }>>([]);
    const [waypoints, setWaypoints] = useState<Array<{ lat: number; lng: number }>>([]);
    const [pathDistance, setPathDistance] = useState(0);

    // Server Building Types
    const [serverBuildingTypes, setServerBuildingTypes] = useState<any[]>([]);

    useEffect(() => {
        fetch(`${API_BASE_URL}/api/buildings/types`)
            .then(res => res.json())
            .then(data => setServerBuildingTypes(data.types || []))
            .catch(console.error);
    }, []);

    // Movement Animation State
    const [isMoving, setIsMoving] = useState(false);
    const [moveStartTime, setMoveStartTime] = useState<number | null>(null);
    const [moveArrivalTime, setMoveArrivalTime] = useState<number | null>(null);
    const [moveStartPos, setMoveStartPos] = useState<[number, number] | null>(null);
    const [activePath, setActivePath] = useState<Array<{ lat: number; lng: number }>>([]); // Path being traversed

    const showToast = useCallback((message: string, type: 'info' | 'error' | 'success' = 'info') => {
        setToast({ show: true, message, type });
    }, []);

    // Admin check
    const [userId, setUserId] = useState<string | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        const storedId = localStorage.getItem('terra_user_id');
        setUserId(storedId);
        setIsAdmin(storedId === '1');
    }, []);

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

    // Load Player Resources (Gold/Gem) from DB
    const loadPlayerResources = useCallback(async () => {
        try {
            const userId = localStorage.getItem('terra_user_id');
            if (!userId) return;

            const response = await fetch(`${API_BASE_URL}/api/user/${userId}`);
            if (response.ok) {
                const userData = await response.json();
                if (userData.resources) {
                    setPlayerResources({ gold: userData.resources.gold || 0, gem: userData.resources.gem || 0 });
                    if (userData.username) setUsername(userData.username);
                    console.log('[Resources] Loaded:', userData.resources);
                }
            }
        } catch (error) {
            console.error('[Resources] Error loading resources:', error);
        }
    }, []);

    // --- 게임 상태 로딩 (Game State Loading) ---
    // 유저 정보, 건물 목록, 소유 타일, 영토 정보 등을 서버에서 가져와 초기화
    const loadGameState = useCallback(async () => {
        try {
            const userId = localStorage.getItem('terra_user_id');
            if (!userId) {
                console.warn('[GameState] No user ID found');
                router.push('/login');
                return;
            }

            console.log(`[GameState] Loading for user ${userId}...`);
            let fetchedPos: { x: number, y: number } | null = null;

            // 1. 게임 기본 상태 (건물, 위치) 로드
            const response = await fetch(`${API_BASE_URL}/api/game/state?userId=${userId}`);

            if (response.ok) {
                const data = await response.json();
                console.log('[GameState] Loaded:', data);

                // 건물 매핑
                if (data.buildings && data.buildings.length > 0) {
                    const mappedBuildings = data.buildings.map((b: { id: number; type: string; x: number; y: number; level?: number }) => ({
                        id: b.id,
                        type: b.type,
                        lat: b.x, // Assuming x is lat for now (DB Schema Check Required)
                        lng: b.y, // Assuming y is lng for now
                        level: b.level || 1,
                    }));
                    setBuildings(mappedBuildings);
                    console.log(`[GameState] Loaded ${mappedBuildings.length} buildings`);
                } else {
                    setBuildings([]);
                }

                // 플레이어 위치 로드
                if (data.playerPosition) {
                    const { x, y } = data.playerPosition;
                    if (x && y) {
                        setPlayerPosition([x, y]);
                        fetchedPos = { x, y };
                    }
                }
            } else {
                console.error('[GameState] Failed to load:', response.status);
            }

            // 2. 자원 정보 로드
            await loadPlayerResources();

            // 3. 미니언(유닛) 정보 로드
            const minionsResponse = await fetch(`${API_BASE_URL}/api/characters/minions?userId=${userId}`);
            if (minionsResponse.ok) {
                const minionsData = await minionsResponse.json();
                setMinions(minionsData);
            }

            // 4. 소유 타일 로드 (Legacy, 오버레이용)
            const tilesResponse = await fetch(`${API_BASE_URL}/api/tiles/user/${userId}`);
            if (tilesResponse.ok) {
                const tilesData = await tilesResponse.json();
                setOwnedTiles(tilesData.tiles || []);
            }

            // 5. 주변 영토 정보 로드 (Spatial Query)
            const territoryUrl = `${API_BASE_URL}/api/territories`;
            // Use fetched position if available (fetchedPos), else current state
            const targetPos = fetchedPos || { x: playerPosition[0], y: playerPosition[1] };

            if (targetPos && targetPos.x) {
                // Fetch ALL territories for global visibility
                // territoryUrl += `?lat=${targetPos.x}&lng=${targetPos.y}&radius=100`; 
                // Don't filter by radius for now
            }

            const territoriesResponse = await fetch(territoryUrl);
            if (territoriesResponse.ok) {
                const tData = await territoriesResponse.json();
                setTerritories(tData.territories || []);
            }
        } catch (error) {
            console.error('[GameState] Error loading game state:', error);
        }
    }, [router, loadPlayerResources]);

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

    // --- Movement Logic ---
    // --- 플레이어 이동 로직 ---
    const handlePlayerMove = async (position: [number, number]) => {
        // GameControlPanel 또는 MapClickHandler에서 호출됨
        // 여기서는 직접 API를 호출하여 경로를 계산하고 이동을 시작함

        try {
            const userId = localStorage.getItem('terra_user_id');
            const targetLat = position[0];
            const targetLng = position[1];

            const response = await fetch(`${API_BASE_URL}/api/game/move`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, targetLat, targetLng }),
            });

            const data = await response.json();

            if (response.ok && data.success) {
                // 시작/도착 시간 결정
                const now = Date.now();
                const arrival = new Date(data.arrivalTime).getTime();

                console.log(`[Move] Path received:`, data.path); // 디버그 로그

                // 클라이언트 애니메이션 상태 업데이트
                setIsMoving(true);
                setMoveStartTime(now);
                setMoveArrivalTime(arrival);
                setMoveStartPos(playerPosition);
                setActivePath(data.path); // 서버로부터 받은 경로

                // 이전 경로 계획 상태 초기화
                setWaypoints([]);
                setPlannedPath([]);
                setPathDistance(0);

                showToast(`이동 시작! (예상 시간: ${data.durationSeconds.toFixed(1)}초)`, 'success');
            } else {
                showToast(`이동 실패: ${data.error}`, 'error');
            }
        } catch (error) {
            console.error('Failed to move:', error);
            showToast('이동 요청 중 오류가 발생했습니다.', 'error');
        }
    };

    // --- Movement Synchronization (Polling) ---
    // --- 위치 동기화 (폴링) ---
    // 이동 중이거나 주기적으로 서버와 위치를 동기화하여 오차 보정
    useEffect(() => {
        if (!isMoving) return;

        const userId = localStorage.getItem('terra_user_id');
        if (!userId) return;

        // 컴포넌트 언마운트 시 상태 업데이트 방지
        let isActive = true;

        const syncInterval = setInterval(async () => {
            if (!isActive) return;

            try {
                const res = await fetch(`${API_BASE_URL}/api/game/position/${userId}`);
                if (res.ok) {
                    const data = await res.json();

                    // 여전히 active 상태인지 확인
                    if (!isActive) return;

                    if (data.isMoving === false) {
                        // 서버에서 이동이 완료된 경우 클라이언트 상태 강제 종료
                        // (원래는 도착 시간 기반으로 자동 종료되지만, 네트워크 지연 등 대비)
                        setIsMoving(false);
                        setPlayerPosition(data.position);
                        setActivePath([]);
                        setMoveStartTime(null);
                        setMoveArrivalTime(null);
                        showToast('목적지에 도착했습니다.', 'success');
                    }
                }
            } catch (e) {
                console.error("Sync error", e);
            }
        }, 2000); // 2초마다 동기화

        return () => {
            isActive = false;
            clearInterval(syncInterval);
        };
    }, [isMoving]);

    // --- 건물 건설 핸들러 ---
    const handleBuildingConstruct = async (buildingId: string) => {
        if (isConstructing) return;

        // 관리자 권한 확인 (관리자는 건설 시간 단축)
        const userId = localStorage.getItem('terra_user_id');
        const isAdmin = userId === '1'; // User ID 1 is admin

        // 레거시 건물 정의 (서버 타입을 못 찾을 경우 대비)
        const buildingDefs: Record<string, { name: string; buildTime: number; adminBuildTime: number; cost: { gold: number; gem: number } }> = {
            COMMAND_CENTER: { name: '사령부', buildTime: 60, adminBuildTime: 5, cost: { gold: 500, gem: 5 } },
            mine: { name: '자원 채굴장', buildTime: 30, adminBuildTime: 3, cost: { gold: 100, gem: 0 } },
            warehouse: { name: '창고', buildTime: 20, adminBuildTime: 2, cost: { gold: 50, gem: 0 } },
            barracks: { name: '숙소', buildTime: 25, adminBuildTime: 2, cost: { gold: 75, gem: 0 } },
            farm: { name: '농장', buildTime: 20, adminBuildTime: 2, cost: { gold: 75, gem: 0 } },
            FACTORY: { name: '공장', buildTime: 120, adminBuildTime: 5, cost: { gold: 500, gem: 5 } },
        };

        // 서버에서 받아온 건물 타입 목록에서 찾기
        let building: any = serverBuildingTypes.find(b => b.code === buildingId || b.code === buildingId.toUpperCase());

        if (building) {
            // 서버 데이터를 클라이언트 형식으로 변환
            building = {
                name: building.name,
                buildTime: building.tier * 30,
                adminBuildTime: 3,
                cost: building.construction_cost
            };
        } else {
            // Fallback
            building = buildingDefs[buildingId] || buildingDefs[buildingId.toUpperCase()] || buildingDefs[buildingId.toLowerCase()];
        }

        if (!building) {
            console.error('Unknown building type:', buildingId);
            showToast(`건물 정보를 찾을 수 없습니다: ${buildingId}`, 'error');
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
                    gold: prev.gold - (building.cost.gold || 0),
                    gem: prev.gem - (building.cost.gem || 0)
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

    // --- 건물 파괴(철거) 로직 ---
    const [demolitionStates, setDemolitionStates] = useState<Record<number, number>>({});

    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            setCurrentTick(now); // UI 동기화를 위한 틱 업데이트
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

    // Diplomacy Data
    const [factions, setFactions] = useState<any[]>([]);

    useEffect(() => {
        fetchFactions();
    }, []);

    const fetchFactions = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/factions`);
            if (res.ok) {
                const data = await res.json();
                setFactions(data.factions || []);
            }
        } catch (e) {
            console.error("Failed to fetch factions for movement check:", e);
        }
    };

    // --- 경로 계산 (Path Calculation) ---
    const calculatePath = async (currentWaypoints: Array<{ lat: number; lng: number }>) => {
        if (currentWaypoints.length === 0) return;

        const startPos = playerPosition;
        const endPos = currentWaypoints[currentWaypoints.length - 1];

        // 경유지 (Start와 End 제외)
        const intermediaries = currentWaypoints.slice(0, currentWaypoints.length - 1);

        try {
            const response = await fetch(`${API_BASE_URL}/api/game/path`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    startLat: startPos[0],
                    startLng: startPos[1],
                    endLat: endPos.lat,
                    endLng: endPos.lng,
                    waypoints: intermediaries
                })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    setPlannedPath(data.path);
                    setPathDistance(data.distance);
                } else {
                    showToast(data.error || '경로를 찾을 수 없습니다.', 'error');
                }
            }
        } catch (e) {
            console.error('Path calc error:', e);
        }
    };

    const handleMoveToTile = (lat: number, lng: number) => {
        // Start Path Planning Mode
        setIsPathPlanning(true);
        setSelectedTile(null); // Hide popup
        const initialWaypoints = [{ lat, lng }];
        setWaypoints(initialWaypoints);
        calculatePath(initialWaypoints);
        showToast("경로 계획 모드: 지도를 클릭하여 경유지를 추가하세요.", 'info');
    };

    const confirmMove = async () => {
        if (waypoints.length === 0) return;
        const endPos = waypoints[waypoints.length - 1];

        // Validate max range
        if (!isAdmin && pathDistance > maxMovementRange) {
            showToast(`이동 불가: 작전 반경(${maxMovementRange}km) 초과.`, 'error');
            return;
        }

        try {
            const userId = localStorage.getItem('terra_user_id');
            const response = await fetch(`${API_BASE_URL}/api/game/move`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    x: endPos.lat,
                    y: endPos.lng,
                    path: plannedPath
                }),
            });

            if (response.ok) {
                const data = await response.json();

                // Start Animation on Client
                const now = Date.now();
                const arrival = new Date(data.arrivalTime).getTime();

                setIsPathPlanning(false); // Hide planning UI
                setIsMoving(true);
                setMoveStartTime(now);
                setMoveArrivalTime(arrival);
                setMoveStartPos(playerPosition);
                setActivePath([...plannedPath]); // Copy path for animation

                showToast(`이동 시작! (소요시간: ${data.durationSeconds.toFixed(1)}초)`, 'success');

                // Note: We do NOT clear waypoints/path here immediately so they can be used for animation
                // But we hide the planning UI.
            } else {
                const err = await response.json();
                showToast(`이동 실패: ${err.error}`, 'error');
            }
        } catch (error) {
            console.error('Failed to move:', error);
            showToast('이동 중 오류 발생', 'error');
        }
    };

    // --- 이동 애니메이션 루프 (requestAnimationFrame) ---
    // 60fps 부드러운 이동 처리를 위해 매 프레임마다 위치 보간
    useEffect(() => {
        if (!isMoving || !moveStartTime || !moveArrivalTime || !activePath.length) return;

        let animationFrameId: number;

        const animate = () => {
            const now = Date.now();
            if (now >= moveArrivalTime) {
                // 도착 처리
                setIsMoving(false);
                setMoveStartTime(null);
                setMoveArrivalTime(null);
                setActivePath([]);
                setWaypoints([]);
                setPlannedPath([]);
                setPathDistance(0);

                const end = activePath[activePath.length - 1];
                setPlayerPosition([end.lat, end.lng]);
                showToast("목적지 도착!", 'success');

                // 강제 동기화: DB 위치 업데이트 보장을 위해 서버에 도착 알림(fetch)
                const userId = localStorage.getItem('terra_user_id');
                if (userId) {
                    fetch(`${API_BASE_URL}/api/game/position/${userId}`).catch(console.error);
                }

                return;
            }

            // 위치 보간 (Interpolation)
            const totalDuration = moveArrivalTime - moveStartTime;
            const elapsed = now - moveStartTime;
            const progress = Math.min(elapsed / totalDuration, 1.0);

            // 애니메이션용 경로 생성
            let pathForAnim = activePath;

            // 부드러운 시작 처리: 시작점과 첫 번째 경로점이 매우 가까우면 끊김 방지를 위해 첫 점 생략
            if (moveStartPos && activePath.length > 0) {
                const firstPoint = activePath[0];
                const dist = calculateDistance(moveStartPos[0], moveStartPos[1], firstPoint.lat, firstPoint.lng);

                if (dist < 0.1) { // 100m 미만이면 첫 점 생략
                    pathForAnim = activePath.slice(1);
                }
            }

            const fullPath = moveStartPos ? [{ lat: moveStartPos[0], lng: moveStartPos[1] }, ...pathForAnim] : pathForAnim;

            if (fullPath.length >= 2) {
                const totalSegments = fullPath.length - 1;

                // 현재 진행률에 해당하는 세그먼트 인덱스 계산
                const currentSegIndex = Math.min(Math.floor(progress * totalSegments), totalSegments - 1);
                const segProgress = (progress * totalSegments) - currentSegIndex;

                const p1 = fullPath[currentSegIndex];
                const p2 = fullPath[currentSegIndex + 1];

                // 선형 보간 (Linear Interpolation)
                const lat = p1.lat + (p2.lat - p1.lat) * segProgress;
                const lng = p1.lng + (p2.lng - p1.lng) * segProgress;

                // 위치 변화가 유의미할 때만 상태 업데이트 (>1m)
                setPlayerPosition(prev => {
                    const latDiff = Math.abs(prev[0] - lat);
                    const lngDiff = Math.abs(prev[1] - lng);
                    if (latDiff > 0.00001 || lngDiff > 0.00001) { // 약 1m
                        return [lat, lng];
                    }
                    return prev;
                });
            }

            animationFrameId = requestAnimationFrame(animate);
        };

        animationFrameId = requestAnimationFrame(animate);

        return () => cancelAnimationFrame(animationFrameId);
    }, [isMoving, activePath, moveStartTime, moveArrivalTime, moveStartPos]);


    const cancelPlanning = () => {
        setIsPathPlanning(false);
        setWaypoints([]);
        setPlannedPath([]);
        setPathDistance(0);
    };

    const removeWaypoint = (index: number) => {
        const newWaypoints = [...waypoints];
        newWaypoints.splice(index, 1);
        setWaypoints(newWaypoints);
        if (newWaypoints.length > 0) {
            calculatePath(newWaypoints);
        } else {
            setPlannedPath([]);
            setPathDistance(0);
        }
    };

    const checkMovementPermission = async (lat: number, lng: number): Promise<boolean> => {
        // Quick fetch of territories to validate (Caching would be better)
        try {
            const res = await fetch(`${API_BASE_URL}/api/territories`);
            const data = await res.json();
            const allTerritories = data.territories || [];

            // Find if inside any territory
            const inside = allTerritories.find((t: any) => {
                const distKm = calculateDistance(lat, lng, t.x, t.y);
                return distKm <= t.territory_radius;
            });

            if (inside && inside.user_id != localStorage.getItem('terra_user_id')) {
                // Check relations
                // Find owner in factions list (Match by Faction Name or ID)
                // API /factions returns 'username' as Name. 
                // API /territories returns 'faction_name'.
                const owner = factions.find(f => f.username === inside.faction_name);
                // If owner not found (maybe player execution), skip check or default
                const myId = localStorage.getItem('terra_user_id') || "";
                const relation = owner?.diplomatic_stance?.[myId] || 0;

                if (relation < -20) {
                    showToast(`⛔ Cannot enter Hostile Territory (Relation: ${relation})`, 'error');
                    return false;
                }
            }
            return true;
        } catch (e) {
            console.error(e);
            return true; // Fail safe: Allow movement if check fails
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
                        <button
                            onClick={() => setShowDiplomacy(true)}
                            className="bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-600 px-3 py-1 rounded text-xs font-bold flex items-center gap-2"
                        >
                            🤝 DIPLOMACY
                        </button>
                    </div>

                    {/* GPS Status indicator */}
                    <div className="flex items-center gap-2 md:gap-3 flex-wrap justify-end">
                        {geolocation.loading && <div className="text-[10px] font-bold bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-2 py-1 rounded-full animate-pulse flex items-center gap-1">🛰️ SEEKING...</div>}
                        {geolocation.watching && !geolocation.error && <div className="text-[10px] font-bold bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-1 rounded-full flex items-center gap-1">🟢 GPS ACTIVE</div>}
                        {geolocation.error && <div title={geolocation.error} className="text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-1 rounded-full flex items-center gap-1">🔴 {geolocation.error}</div>}
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
                        path={isMoving ? activePath : plannedPath} // Show active path while moving
                        waypoints={isMoving ? [] : waypoints} // Hide waypoints while moving
                        onWaypointRemove={removeWaypoint}
                        selectedNpc={selectedNpc}
                        setSelectedNpc={setSelectedNpc}
                        npcRefreshKey={npcRefreshKey}
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

                    {/* Path Planning Controls */}
                    {isPathPlanning && (
                        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-[2000] bg-slate-900/90 border border-cyan-500/50 p-4 rounded-lg shadow-2xl flex flex-col gap-2 items-center min-w-[300px]">
                            <h3 className="text-cyan-400 font-bold text-lg mb-1">🗺️ 경로 계획 모드</h3>
                            <div className="text-sm text-gray-300 w-full flex justify-between">
                                <span>총 거리:</span>
                                <span className={pathDistance > maxMovementRange ? "text-red-400 font-bold" : "text-green-400 font-bold"}>{pathDistance.toFixed(2)} km</span>
                            </div>
                            <div className="text-xs text-gray-500 mb-2">지도를 클릭하여 경유지를 추가하세요</div>

                            <div className="flex gap-2 w-full">
                                <button
                                    onClick={cancelPlanning}
                                    className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded font-bold transition-colors"
                                >
                                    취소
                                </button>
                                <button
                                    onClick={confirmMove}
                                    disabled={pathDistance === 0 || waypoints.length === 0}
                                    className={`flex-1 py-2 rounded font-bold transition-colors ${pathDistance > maxMovementRange && !isAdmin
                                        ? 'bg-red-900/50 text-gray-500 cursor-not-allowed border border-red-800'
                                        : 'bg-cyan-600 hover:bg-cyan-500 text-white border border-cyan-500'
                                        }`}
                                >
                                    {pathDistance > maxMovementRange && !isAdmin ? '거리 초과' : '이동 시작'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Side Panel (Fixed right on Desktop, Fixed Bottom on Mobile) */}
            <div className="fixed bottom-0 left-0 w-full h-[45vh] md:static md:w-[400px] md:h-full shrink-0 z-[1000] border-t md:border-t-0 md:border-l border-slate-700 shadow-xl bg-slate-900">
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

                    isAdmin={isAdmin}
                    username={username}

                    selectedBuilding={selectedBuilding}
                    onCloseBuildingInfo={() => setSelectedBuilding(null)}
                    demolitionStates={demolitionStates}
                    onBuildingAction={async (action, buildingId) => {
                        if (action === 'assign') {
                            setShowAssignModal(true);
                        } else if (action === 'collect') {
                            // Call collection API endpoint
                            try {
                                const response = await fetch(`${API_BASE_URL}/api/buildings/${buildingId}/collect`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' }
                                });
                                if (response.ok) {
                                    const data = await response.json();
                                    showToast(`💰 ${data.gold || 0} 골드 수집!`, 'success');
                                    await loadPlayerResources(); // Refresh displayed resources
                                } else {
                                    showToast('수집 실패', 'error');
                                }
                            } catch (e) {
                                console.error(e);
                                showToast('수집 오류', 'error');
                            }
                        } else if (action === 'destroy') {
                            handleRequestDemolition(buildingId);
                        } else if (action === 'cancel_destroy') {
                            handleCancelDemolition(buildingId);
                        } else if (action === 'enter_base') {
                            router.push(`/base/${buildingId}`);
                        }
                    }}

                    currentTileProvider={tileProvider.id}
                    onTileProviderChange={setTileProvider}
                    tileProviders={TILE_PROVIDERS}

                    geolocation={geolocation}
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

            <DiplomacyPanel
                isOpen={showDiplomacy}
                onClose={() => setShowDiplomacy(false)}
                currentUserId={userId}
            />

            {/* NPC Information Panel (Read-Only) */}
            <NpcInfoPanel
                npc={selectedNpc}
                onClose={() => setSelectedNpc(null)}
                onOpenAdminControl={() => setShowNpcAdminModal(true)}
            />

            {/* NPC Admin Control Modal (Overlay) */}
            {showNpcAdminModal && selectedNpc && (
                <NpcControlModal
                    npc={selectedNpc}
                    onClose={() => setShowNpcAdminModal(false)}
                    onUpdate={() => setNpcRefreshKey(k => k + 1)}
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
