"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker } from "react-leaflet";
import L from "leaflet";
import MovementRange from "./MovementRange";
import TerritoryOverlay, { Territory } from "./TerritoryOverlay";
import MapClickHandler from "./MapClickHandler";
import PlayerMarker from "./PlayerMarker";
import BuildingMarkers from "./BuildingMarkers";
import SelectedPointMarker from "./SelectedPointMarker";
import PathOverlay from "./PathOverlay";

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
    onWaypointRemove
}: TerrainMapContentProps) {

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
        </MapContainer>
    );
}
