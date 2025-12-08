import React from 'react';
import { BUILDING_TYPES } from '../data/constants';

function ConstructionMenu({ tile, onBuild, onCancel, player }) {
    console.log("ConstructionMenu rendering with:", { tile, player });
    console.log("BUILDING_TYPES:", typeof BUILDING_TYPES, BUILDING_TYPES);
    if (!tile) return null;

    if (!BUILDING_TYPES) {
        console.error("CRITICAL: BUILDING_TYPES is missing!");
        return <div>Error: Missing Data</div>;
    }

    const buildings = Object.values(BUILDING_TYPES);

    return (
        <div className="construction-menu" style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '400px',
            backgroundColor: 'var(--bg-secondary)',
            border: '2px solid var(--accent-primary)',
            borderRadius: '8px',
            padding: '1.5rem',
            zIndex: 1000,
            boxShadow: '0 0 20px rgba(0,0,0,0.8)'
        }}>
            <h3 style={{ marginTop: 0, borderBottom: '1px solid var(--text-secondary)', paddingBottom: '0.5rem' }}>
                Construction Protocol
            </h3>
            <p>Select a facility to construct at Local [{tile.x}, {tile.y}].</p>
            <p>DEBUG: Found {buildings.length} buildings.</p>

            <div className="building-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '300px', overflowY: 'auto' }}>
                {buildings.map(b => {
                    const canAfford = player.money >= b.cost.money && player.materials >= b.cost.materials;
                    return (
                        <div key={b.id} className="card" style={{
                            padding: '1rem',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            opacity: canAfford ? 1 : 0.5
                        }}>
                            <div>
                                <div style={{ fontWeight: 'bold' }}>{b.name}</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                    Cost: <span style={{ color: 'var(--warning)' }}>${b.cost.money}</span> |
                                    <span style={{ color: 'var(--text-primary)' }}> 📦{b.cost.materials}</span>
                                </div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--success)' }}>
                                    Output: {Object.entries(b.output).map(([k, v]) => `${k.toUpperCase()} +${v}`).join(', ')}
                                </div>
                            </div>
                            <button
                                className="btn-primary"
                                disabled={!canAfford}
                                onClick={() => onBuild(b)}
                                style={{ fontSize: '0.8rem', padding: '0.3rem 0.8rem' }}
                            >
                                Build
                            </button>
                        </div>
                    );
                })}
            </div>

            <button
                onClick={onCancel}
                style={{
                    marginTop: '1rem',
                    background: 'transparent',
                    border: '1px solid var(--text-secondary)',
                    color: 'var(--text-secondary)',
                    width: '100%',
                    padding: '0.5rem',
                    cursor: 'pointer'
                }}
            >
                Cancel
            </button>
        </div>
    );
}

export default ConstructionMenu;
