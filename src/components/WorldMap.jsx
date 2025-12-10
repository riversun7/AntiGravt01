import { useState } from 'react';
import { TILE_TYPES, VIEWPORT_SIZE } from '../data/worldData';

function WorldMap({ map, playerPos, selectedTile, onTileClick, onTileDoubleClick, onEnterSector }) {
    const [hoverPos, setHoverPos] = useState(null);

    // Initial Loading State handled in render
    if (!map) return <div className="loading-scan">Initializing Satellite Link...</div>;

    // Viewport Logic
    // Center the viewport on the player
    const halfView = Math.floor(VIEWPORT_SIZE / 2);
    let startX = playerPos.x - halfView;
    let startY = playerPos.y - halfView;

    // Bounds check
    // (In a wrapped world we would handle this differently, for now clamp)
    // Actually, displaying "void" or clamping is better than crashing
    // Let's not clamp rigidly to edge so player stays centered, but we must handle out-of-bounds index access

    const renderRows = [];
    for (let y = startY; y < startY + VIEWPORT_SIZE; y++) {
        const rowData = [];
        for (let x = startX; x < startX + VIEWPORT_SIZE; x++) {
            if (y >= 0 && y < map.length && x >= 0 && x < map[0].length) {
                rowData.push(map[y][x]);
            } else {
                rowData.push(null); // Out of bounds (Void)
            }
        }
        renderRows.push({ y, cells: rowData });
    }

    return (
        <div className="map-container">
            <div className="map-grid">
                {renderRows.map((row) => (
                    <div key={row.y} className="map-row">
                        {row.cells.map((tile, i) => {
                            if (!tile) return <div key={i} className="map-tile type-void"></div>;

                            const isPlayerHere = playerPos.x === tile.x && playerPos.y === tile.y;
                            const isSelected = selectedTile && selectedTile.x === tile.x && selectedTile.y === tile.y;
                            const isHovered = hoverPos && hoverPos === tile;

                            return (
                                <div
                                    key={`${tile.x}-${tile.y}`}
                                    className={`map-tile type-${tile.type} ${isPlayerHere ? 'active-player' : ''} ${isSelected ? 'selected' : ''} ${isHovered ? 'hovered' : ''}`}
                                    onClick={() => onTileClick(tile)}
                                    onDoubleClick={() => onTileDoubleClick(tile)}
                                    autoFocus
                                    onMouseEnter={() => setHoverPos(tile)}
                                    onMouseLeave={() => setHoverPos(null)}
                                >
                                    {/* Icons */}
                                    {tile.type === TILE_TYPES.CITY && <span className="icon">🏙️</span>}
                                    {/* {tile.type === TILE_TYPES.MOUNTAIN && <span className="icon">⛰️</span>} */}

                                    {isPlayerHere && <div className="player-avatar">🚀</div>}
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>

            <div className="map-controls">
                {hoverPos ? (
                    <div className="tile-info-panel">
                        <strong>Global Sector [{hoverPos.x}, {hoverPos.y}]</strong>
                        <div>Terrain: {hoverPos.type.toUpperCase()}</div>
                        {hoverPos.data && <div style={{ color: 'var(--accent-primary)' }}>{hoverPos.data.name}</div>}
                    </div>
                ) : (
                    <div className="tile-info-panel">
                        Current Loc: [{playerPos.x}, {playerPos.y}]
                    </div>
                )}

                <div className="action-buttons">
                    <button className="btn-primary" style={{ fontSize: '0.9rem', padding: '0.5rem 1rem' }} onClick={onEnterSector}>
                        ⏬ Enter Sector (Local Map)
                    </button>
                </div>
            </div>
        </div>
    );
}

export default WorldMap;
