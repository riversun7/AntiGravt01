"use client";

import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, CircleMarker } from "react-leaflet";
import L from "leaflet";
import MovementRange from "./MovementRange";
import TerritoryOverlay, { Territory } from "./TerritoryOverlay";
import MapClickHandler from "./MapClickHandler";
import PlayerMarker from "./PlayerMarker";
import BuildingMarkers from "./BuildingMarkers";
import SelectedPointMarker from "./SelectedPointMarker";
import PathOverlay from "./PathOverlay";
import NpcCyborgMarkers from "./NpcCyborgMarkers";
import OsmDebugOverlay from "./OsmDebugOverlay";

interface GeolocationState {
    loading: boolean;
    accuracy: number | null;
    error: string | null; // Changed from Error | null
    position: [number, number] | null;
    watching: boolean;
}

interface Building {
    id: number;
    type: string;
    lat: number;
    lng: number;
    level?: number;
}

// Territory interface imported from TerritoryOverlay

/**
 * @file TerrainMapContent.tsx
 * @description Leaflet 지도의 실제 콘텐츠를 렌더링하는 핵심 컴포넌트
 * @role 지도 레이어, 마커(플레이어, NPC, 건물), 오버레이(영토, 경로) 등을 조합하여 표시
 * @dependencies react-leaflet, leaflet, 그리고 다수의 하위 맵 컴포넌트들
 * @status Active
 */
interface TerrainMapContentProps {
    mapCenter: [number, number];       // 지도 초기 중심 좌표
    currentZoom: number;               // 현재 줌 레벨
    tileProvider: {                    // 타일 레이어 설정
        id: string;
        name: string;
        url: string;
        attribution: string;
        maxZoom?: number;
    };
    maxMovementRange: number;          // 이동 가능 반경 (km)
    geolocation: GeolocationState;     // GPS 상태
    userId: string | null;             // 현재 로그인한 사용자 ID
    playerPosition: [number, number];  // 플레이어 현재 위치
    setPlayerPosition: (pos: [number, number]) => void; // 위치 업데이트 함수
    showToast: (msg: string, type: 'info' | 'error' | 'success') => void; // 토스트 메시지 함수
    handleTileClick: (lat: number, lng: number, point?: { x: number; y: number }) => void; // 타일 클릭 핸들러
    handleTerritoryClick?: (t: Territory, e: any) => void; // 영토 클릭 핸들러
    selectedNpc?: any;                 // 선택된 NPC 정보
    setSelectedNpc?: (npc: any) => void; // NPC 선택 함수
    isConstructing: boolean;           // 건설 중 여부
    constructionTimeLeft: number;      // 건설 남은 시간
    isAdmin: boolean;                  // 관리자 여부
    calculateDistance: (lat1: number, lon1: number, lat2: number, lon2: number) => number; // 거리 계산 함수
    buildings: Building[];             // 렌더링할 건물 목록
    setSelectedBuilding: (b: Building | null) => void; // 건물 선택 함수
    selectedTile: any;                 // 선택된 타일 정보
    setSelectedTile: (t: unknown) => void; // 타일 선택 함수
    setMap: (map: L.Map | null) => void;   // Leaflet Map 인스턴스 설정
    territories: Territory[];          // 영토 목록
    path?: Array<{ lat: number; lng: number }>; // 이동 경로 (애니메이션용)
    waypoints?: Array<{ lat: number; lng: number }>; // 경유지 목록
    onWaypointRemove?: (index: number) => void; // 경유지 제거 핸들러
    npcRefreshKey?: number;            // NPC 새로고침 키 (강제 리렌더링용)
}

export default function TerrainMapContent({
    mapCenter,
    currentZoom,
    tileProvider,
    maxMovementRange,
    geolocation,
    userId,
    playerPosition,
    setPlayerPosition,
    showToast,
    handleTileClick,
    handleTerritoryClick,
    isConstructing,
    constructionTimeLeft,
    isAdmin,
    calculateDistance,
    buildings,
    setSelectedBuilding,
    selectedTile,
    setSelectedTile,
    setMap,
    territories,
    path = [],
    waypoints = [],
    onWaypointRemove,
    setSelectedNpc,
    npcRefreshKey = 0,
    selectedNpc
}: TerrainMapContentProps) { // Updated props destructuring

    // --- Leaflet 아이콘 경로 수정 ---
    // Next.js 환경에서 Leaflet 기본 마커 아이콘이 깨지는 문제를 해결하기 위한 코드
    useEffect(() => {
        // 클라이언트 사이드에서만 실행
        if (typeof window !== 'undefined') {
            // @ts-expect-error L.Icon.Default.prototype._getIconUrl is private
            delete L.Icon.Default.prototype._getIconUrl;
            L.Icon.Default.mergeOptions({
                iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
                iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
                shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
            });
        }
    }, []);

    return (
        <MapContainer
            center={mapCenter}
            zoom={currentZoom}
            style={{ height: '100%', width: '100%', background: '#242f3e' }}
            zoomControl={false}
            attributionControl={false}
            minZoom={2}
            maxZoom={tileProvider.maxZoom || 19}
            doubleClickZoom={false}

            ref={setMap}
        >
            <TileLayer
                attribution={tileProvider.attribution}
                url={tileProvider.url}
                maxZoom={tileProvider.maxZoom}
            />



            <MovementRange
                center={geolocation.position || playerPosition}
                radiusKm={maxMovementRange}
                color={isAdmin ? "#3b82f6" : "#22c55e"}
            />

            <TerritoryOverlay
                territories={territories}
                currentUserId={userId}
                onTerritoryClick={handleTerritoryClick}
            />

            <SelectedPointMarker
                position={
                    selectedTile && typeof selectedTile.clickLat === 'number'
                        ? [selectedTile.clickLat, selectedTile.clickLng]
                        : null
                }
            />

            <PathOverlay
                path={path}
                waypoints={waypoints}
                onWaypointClick={onWaypointRemove}
            />

            {/* NPC Movement Path */}
            {selectedNpc && selectedNpc.destination && selectedNpc.start_pos && (
                <PathOverlay
                    path={[
                        { lat: selectedNpc.start_pos.lat, lng: selectedNpc.start_pos.lng },
                        { lat: selectedNpc.destination.lat, lng: selectedNpc.destination.lng }
                    ]}
                    waypoints={[]}
                    onWaypointClick={() => { }}
                />
            )}

            <MapClickHandler
                onMove={setPlayerPosition}
                maxMovementRange={maxMovementRange}
                geolocation={geolocation}
                onError={(msg) => showToast(msg, 'error')}
                onTileClick={handleTileClick}
                isConstructing={isConstructing}
                playerPosition={playerPosition}
                calculateDistance={calculateDistance}
            />

            <PlayerMarker
                initialPosition={playerPosition}
                maxDistanceKm={maxMovementRange}
                onMove={setPlayerPosition}
                isConstructing={isConstructing}
                constructionTimeLeft={constructionTimeLeft}
                isAdmin={isAdmin}
            />

            <BuildingMarkers
                buildings={buildings}
                onBuildingClick={(b) => {
                    setSelectedBuilding(b);
                    setSelectedTile(null);
                }}
            />

            {/* NPC Cyborg Markers */}
            <NpcCyborgMarkers
                playerPosition={playerPosition}
                viewRangeKm={isAdmin ? 99999 : 10}
                calculateDistance={calculateDistance}
                onNpcClick={(npc) => {
                    console.log('[NPC CLICK]', npc.npc_type, npc.cyborg_name, npc);
                    setSelectedNpc?.(npc);
                    setSelectedBuilding(null);
                    setSelectedTile(null);
                }}
                refreshKey={npcRefreshKey}
            />

            {/* Foreign Territory Markers */}
            <ForeignBuildingMarkers
                territories={territories}
                userId={userId}
                playerPosition={playerPosition}
                calculateDistance={calculateDistance}
                showToast={showToast}
                onBuildingClick={(b) => {
                    setSelectedBuilding(b);
                    setSelectedTile(null);
                }}
            />

            <OsmVisualizerControl isAdmin={isAdmin} center={geolocation.position || playerPosition} />
        </MapContainer>
    );
}

// Sub-component for controlling the visualizer
function OsmVisualizerControl({ isAdmin, center }: { isAdmin: boolean, center: [number, number] }) {
    const [enabled, setEnabled] = useState(false);

    // If not admin, hide? Or allow user to verify too? User asked for it. 
    // Let's allow everyone for now or just if admin (User seems to be dev/admin)
    // User ID 1 is checking.

    return (
        <>
            <OsmDebugOverlay enabled={enabled} center={center} />
            <div className="leaflet-bottom leaflet-left" style={{ bottom: '80px', left: '10px', pointerEvents: 'auto' }}>
                <button
                    onClick={() => setEnabled(!enabled)}
                    className={`px-3 py-1 text-xs font-bold rounded border shadow-md ${enabled ? 'bg-blue-600 text-white border-blue-400' : 'bg-slate-800 text-gray-300 border-gray-600'}`}
                >
                    {enabled ? 'Hide Terrain Debug' : 'Show Terrain Debug'}
                </button>
            </div>
        </>
    );
}

/**
 * 타 유저/NPC의 건물을 표시하는 컴포넌트
 * 관리자의 경우 설정된 시야 범위(View Range)를 따르고, 일반 유저는 기본 시야(10km) 적용
 */
function ForeignBuildingMarkers({ territories, userId, playerPosition, calculateDistance, showToast, onBuildingClick }: {
    territories: any[],
    userId: string | null,
    playerPosition: [number, number],
    calculateDistance: any,
    showToast: any,
    onBuildingClick: (b: any) => void
}) {
    const [adminViewRange, setAdminViewRange] = useState(99999.0); // 기본값: 무제한

    // 관리자(ID=1)일 경우 서버 설정에서 동적 시야 범위 가져오기
    useEffect(() => {
        if (String(userId) === '1') { // Admin user
            fetch(`${typeof window !== 'undefined' ? window.location.origin : ''}/api/admin/config`)
                .then(res => res.json())
                .then(data => {
                    if (data.viewRange !== undefined) {
                        setAdminViewRange(data.viewRange);
                    }
                })
                .catch(console.error);
        }
    }, [userId]);

    const foreignBuildings = useMemo(() => {
        if (!territories || territories.length === 0) return [];

        // 관리자는 설정값, 일반 유저는 10km 시야 제한
        const viewRange = String(userId) === '1' ? adminViewRange : 10.0;

        return territories
            .filter(t => String(t.user_id) !== String(userId)) // 본인 영토 제외
            .filter(t => {
                const dist = calculateDistance(t.x, t.y, playerPosition[0], playerPosition[1]);
                return dist <= viewRange;
            })
            .map(t => ({
                id: t.id,
                type: t['type'] || (t.is_territory_center ? 'COMMAND_CENTER' : 'UNKNOWN'),
                lat: t.x,
                lng: t.y,
                color: t.color,
                user_id: t.user_id,
                owner_name: t.owner_name,
                level: t.level
            }));
    }, [territories, userId, playerPosition, calculateDistance, adminViewRange]);

    if (foreignBuildings.length === 0) return null;

    return (
        <BuildingMarkers
            buildings={foreignBuildings}
            onBuildingClick={onBuildingClick}
        />
    );
}
