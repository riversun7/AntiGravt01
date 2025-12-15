import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default Leaflet icon not finding images in webpack/vite environments
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Component to handle map resize
const MapResizer = () => {
    const map = useMap();
    useEffect(() => {
        setTimeout(() => {
            map.invalidateSize();
        }, 100);
    }, [map]);
    return null;
}

const TerrainMap = () => {
    const [position, setPosition] = useState([51.505, -0.09]); // Default: London

    return (
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            <MapContainer
                center={position}
                zoom={13}
                style={{ height: '100%', width: '100%', background: '#242f3e' }}
            >
                {/* Dark Theme Tiles (CartoDB Dark Matter) */}
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

            <div style={{ position: 'absolute', bottom: 20, left: 20, zIndex: 1000, pointerEvents: 'none', color: 'var(--text-secondary)', fontSize: '0.8rem', textShadow: '0 0 5px #000' }}>
                TERRAIN COMPOSITE // LEAFLET_RENDERER
            </div>
        </div>
    );
};

export default TerrainMap;
