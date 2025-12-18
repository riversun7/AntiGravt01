import { getMovementCost, TILE_TYPES } from '../data/worldData';

function MapOverlay({ selectedTile, playerPos, onMove, onManage, onEnter, onClose }) {
    if (!selectedTile) return null;

    const dist = Math.abs(selectedTile.x - playerPos.x) + Math.abs(selectedTile.y - playerPos.y);
    const isAtLocation = dist === 0;
    const isAdjacent = dist === 1;
    const canMove = dist > 0;
    const moveCost = getMovementCost(selectedTile.type);

    return (
        <div className="map-overlay-card" style={{
            position: 'absolute',
            top: '20px',
            left: '20px',
            zIndex: 200,
            width: '300px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--accent-primary)',
            borderRadius: '8px',
            padding: '1rem',
            boxShadow: '0 4px 15px rgba(0,0,0,0.5)'
        }}>
            <button
                onClick={onClose}
                style={{
                    position: 'absolute',
                    top: '5px',
                    right: '10px',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: '1.2rem'
                }}
            >
                ×
            </button>

            <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--accent-primary)' }}>
                Sector [{selectedTile.x}, {selectedTile.y}]
            </h3>

            <div style={{ marginBottom: '1rem', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                Type: <strong style={{ color: (selectedTile.type === TILE_TYPES.CITY ? 'var(--warning)' : 'inherit') }}>
                    {selectedTile.type.toUpperCase()}
                </strong>
                {selectedTile.data?.name && (
                    <div style={{ marginTop: '0.3rem', fontSize: '1.1rem' }}>
                        {selectedTile.data.name}
                    </div>
                )}
            </div>

            <div className="overlay-actions" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>

                {canMove && (
                    <button
                        className="btn-secondary"
                        onClick={() => onMove(selectedTile.x, selectedTile.y)}
                        style={{ display: 'flex', justifyContent: 'space-between', flexDirection: 'column', gap: '0.2rem' }}
                    >
                        <span style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                            <span>Initiate Thrusters</span>
                            <span>-{Math.floor(dist * moveCost)} Energy</span>
                        </span>
                        <span style={{ fontSize: '0.75rem', opacity: 0.8, alignSelf: 'flex-start' }}>
                            Est. Time: {(dist * 0.3 * moveCost).toFixed(1)}s
                        </span>
                    </button>
                )}

                {(isAtLocation || isAdjacent) && selectedTile.type !== TILE_TYPES.OCEAN && (
                    <button
                        className="btn-primary"
                        onClick={onManage}
                    >
                        🏗️ Manage Sector
                    </button>
                )}

                {isAtLocation && (
                    <button
                        className="btn-primary"
                        style={{ background: 'var(--success)', borderColor: 'var(--success)' }}
                        onClick={onEnter}
                    >
                        ⏬ Enter Surface (Inner Map)
                    </button>
                )}
            </div>
        </div>
    );
}

export default MapOverlay;
