import React from 'react';

function InnerMap({ innerMapData, onBack, onTileClick }) {
    if (!innerMapData) return <div>Loading Local Data...</div>;

    const { parentTile, tiles } = innerMapData;

    // Calculate tile size percentage
    // e.g. 5x5 grid = 20% width per tile

    return (
        <div className="map-container inner-view">
            <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <button onClick={onBack} className="btn-small">⬅ Return to Orbit</button>
                <h3>Local Sector Surface [{parentTile.x}, {parentTile.y}]</h3>
            </div>

            <div className="map-grid">
                {tiles.map((row, y) => (
                    <div key={y} className="map-row">
                        {row.map((tile, x) => (
                            <div
                                key={`${x}-${y}`}
                                className={`map-tile inner-tile type-${tile.type}`}
                                title={`Local [${x},${y}] ${tile.type}`}
                                onClick={() => onTileClick(x, y, tile)}
                            >
                                {tile.type === 'city_block' && '🏢'}
                                {tile.type === 'city_hall' && '🏛️'}
                                {tile.type === 'rock_obstacle' && '🪨'}
                                {tile.type === 'mineral_deposit' && '💎'}
                                {tile.type === 'tree' && '🌲'}
                                {tile.building && '🏭'}
                            </div>
                        ))}
                    </div>
                ))}
            </div>

            <div className="map-controls">
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    Select a tile to construct facilities or assigning units.
                </p>
            </div>
        </div>
    );
}

export default InnerMap;
