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

interface TerrainMapContentProps {
    mapCenter: [number, number];
    currentZoom: number;
    tileProvider: {
        id: string;
        name: string;
        url: string;
        attribution: string;
        maxZoom?: number;
    };
    maxMovementRange: number;
    geolocation: GeolocationState;
    userId: string | null;
    playerPosition: [number, number];
    setPlayerPosition: (pos: [number, number]) => void;
    showToast: (msg: string, type: 'info' | 'error' | 'success') => void;
    handleTileClick: (lat: number, lng: number, point?: { x: number; y: number }) => void;
    handleTerritoryClick?: (t: Territory, e: any) => void;
    setSelectedNpc?: (npc: any) => void;
    isConstructing: boolean;
    constructionTimeLeft: number;
    isAdmin: boolean;
    calculateDistance: (lat1: number, lon1: number, lat2: number, lon2: number) => number;
    buildings: Building[];
    setSelectedBuilding: (b: Building | null) => void;
    selectedTile: any;
    setSelectedTile: (t: unknown) => void; // Keeping unknown for selectedTile as it has complex structure
    setMap: (map: L.Map | null) => void;
    territories: Territory[];
    path?: Array<{ lat: number; lng: number }>;
    waypoints?: Array<{ lat: number; lng: number }>;
    onWaypointRemove?: (index: number) => void;
    npcRefreshKey?: number;
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
    npcRefreshKey = 0
}: TerrainMapContentProps) { // Updated props destructuring

    // Fix Leaflet Icons
    useEffect(() => {
        // Only run on client
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
        </MapContainer>
    );
}

function ForeignBuildingMarkers({ territories, userId, playerPosition, calculateDistance, showToast, onBuildingClick }: {
    territories: any[],
    userId: string | null,
    playerPosition: [number, number],
    calculateDistance: any,
    showToast: any,
    onBuildingClick: (b: any) => void
}) {
    const [adminViewRange, setAdminViewRange] = useState(99999.0); // Default: Unlimited

    // Fetch admin config for dynamic view range
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

        // Admin gets dynamic view range from config
        const viewRange = String(userId) === '1' ? adminViewRange : 10.0;

        return territories
            .filter(t => String(t.user_id) !== String(userId))
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
