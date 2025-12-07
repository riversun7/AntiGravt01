import React, { useState, useEffect } from 'react';
import { TILE_TYPES, getMovementCost } from '../data/worldData';

function WorldMap({ map, playerPos, onMove, onInteract }) {
    if (!map) return <div className="loading-scan">Initializing Satellite Link...</div>;

    const [hoverPos, setHoverPos] = useState(null);

    return (
        <div className="map-container">
            <div className="map-grid">
                {map.map((row, y) => (
                    <div key={y} className="map-row">
                        {row.map((tile, x) => {
                            const isPlayerHere = playerPos.x === x && playerPos.y === y;
                            const isHovered = hoverPos && hoverPos.x === x && hoverPos.y === y;

                            // Simple pathfinding visualization (just direct neighbor check for now)
                            const isNeighbor = Math.abs(playerPos.x - x) <= 1 && Math.abs(playerPos.y - y) <= 1;

                            return (
                                <div
                                    key={`${x}-${y}`}
                                    className={`map-tile type-${tile.type} ${isPlayerHere ? 'active-player' : ''} ${isHovered ? 'hovered' : ''}`}
                                    onClick={() => onMove(x, y)}
                                    onMouseEnter={() => setHoverPos({ x, y })}
                                    onMouseLeave={() => setHoverPos(null)}
                                >
                                    {/* Icons */}
                                    {tile.type === TILE_TYPES.CITY && <span className="icon">🏙️</span>}
                                    {tile.type === TILE_TYPES.RESOURCE_MINERAL && <span className="icon">💎</span>}
                                    {tile.type === TILE_TYPES.RESOURCE_ENERGY && <span className="icon">⚡</span>}
                                    {tile.type === TILE_TYPES.FOREST && <span className="icon">🌲</span>}
                                    {tile.type === TILE_TYPES.MOUNTAIN && <span className="icon">⛰️</span>}
                                    {tile.type === TILE_TYPES.OCEAN && <span className="icon">🌊</span>}

                                    {/* Facilities */}
                                    {tile.type === TILE_TYPES.FACILITY_MINE && <span className="icon">⛏️</span>}
                                    {tile.type === TILE_TYPES.FACILITY_PLANT && <span className="icon">🏭</span>}
                                    {tile.type === TILE_TYPES.FACILITY_WAREHOUSE && <span className="icon">📦</span>}

                                    {/* Player */}
                                    {isPlayerHere && <div className="player-avatar">🤖</div>}

                                    {/* Drones Display (if any) */}
                                    {tile.drones && tile.drones > 0 && <span className="drone-indicator">🚁</span>}
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>

            <div className="map-controls">
                {hoverPos ? (
                    <div className="tile-info-panel">
                        <strong>Sector [{hoverPos.x}, {hoverPos.y}]</strong>
                        <div>Terrain: {map[hoverPos.y][hoverPos.x].type.toUpperCase()}</div>
                        <div>Move Cost: {getMovementCost(map[hoverPos.y][hoverPos.x].type)} Energy</div>
                        {map[hoverPos.y][hoverPos.x].data && (
                            <div className="city-info">
                                <span className="city-name">{map[hoverPos.y][hoverPos.x].data.name}</span>
                                <span className="city-desc">{map[hoverPos.y][hoverPos.x].data.desc}</span>
                            </div>
                        )}
                        {/* Auto-Miner Status */}
                        {map[hoverPos.y][hoverPos.x].drones > 0 && (
                            <div className="drone-status">Active Drones: {map[hoverPos.y][hoverPos.x].drones}</div>
                        )}
                    </div>
                ) : (
                    <div className="tile-info-panel">
                        Hover over a sector for scans.
                    </div>
                )}

                <div className="action-buttons">
                    <button className="btn-small" onClick={() => onInteract('gather')}>Manual Gather</button>
                    <div className="divider"></div>
                    <button className="btn-small build-btn" onClick={() => onInteract('deploy_drone')}>
                        Deploy Drone (100₡)
                    </button>
                    <button className="btn-small build-btn" onClick={() => onInteract('build_warehouse')}>
                        Build Depot (200₡)
                    </button>
                </div>
            </div>
        </div>
    );
}

export default WorldMap;
