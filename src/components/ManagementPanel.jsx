import React from 'react';
import { TILE_TYPES } from '../data/worldData';

function ManagementPanel({ tile, onBack }) {
    if (!tile) return <div className="sector-detail">No sector selected.</div>;

    // Mock Building Data
    const facilities = [
        { id: 1, name: 'Solar Array', status: 'Active', output: '+10 Energy/turn' },
        { id: 2, name: 'Mineral Extractor', status: 'Idle', output: '+5 Materials/turn' },
        { id: 3, name: 'Habitation Module', status: 'Optimal', output: 'Population: 50' }
    ];

    const isCity = tile.type === TILE_TYPES.CITY;

    return (
        <div className="management-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div className="panel-header" style={{
                borderBottom: '1px solid var(--border-color)',
                paddingBottom: '1rem',
                marginBottom: '1rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <div>
                    <h2 style={{ margin: 0 }}>
                        {tile.data?.name || `Sector [${tile.x}, ${tile.y}]`} - Management
                    </h2>
                    <span className="badge" style={{
                        background: 'var(--bg-primary)',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.8rem',
                        marginTop: '0.5rem',
                        display: 'inline-block',
                        border: '1px solid var(--accent-primary)'
                    }}>
                        {tile.type.toUpperCase()}
                    </span>
                </div>
                <button className="btn-secondary" onClick={onBack}>
                    ← Return to Orbit
                </button>
            </div>

            <div className="panel-content" style={{ flex: 1, overflowY: 'auto' }}>

                {isCity ? (
                    <div className="city-overview" style={{ marginBottom: '2rem' }}>
                        <h3>City Status</h3>
                        <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                            <div className="stat-card card">
                                <div className="label">Population</div>
                                <div className="value" style={{ fontSize: '1.5rem', color: 'var(--accent-primary)' }}>12,450</div>
                            </div>
                            <div className="stat-card card">
                                <div className="label">Happiness</div>
                                <div className="value" style={{ fontSize: '1.5rem', color: 'var(--success)' }}>87%</div>
                            </div>
                            <div className="stat-card card">
                                <div className="label">Output</div>
                                <div className="value" style={{ fontSize: '1.5rem', color: 'var(--warning)' }}>98%</div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="terrain-overview" style={{ marginBottom: '2rem', padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                        This sector is currently under development. Construct facilities to exploit local resources.
                    </div>
                )}

                <h3>Facilities</h3>
                <div className="facilities-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {facilities.map(facility => (
                        <div key={facility.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem' }}>
                            <div>
                                <div style={{ fontWeight: 'bold' }}>{facility.name}</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{facility.output}</div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <span className={`status-indicator ${facility.status === 'Active' ? 'active' : ''}`} style={{
                                    color: facility.status === 'Active' ? 'var(--success)' : 'var(--text-secondary)'
                                }}>
                                    ● {facility.status}
                                </span>
                                <button className="btn-secondary" style={{ fontSize: '0.8rem', padding: '0.3rem 0.8rem' }}>Config</button>
                            </div>
                        </div>
                    ))}
                    <button className="card" style={{
                        border: '1px dashed var(--text-secondary)',
                        background: 'transparent',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        color: 'var(--text-secondary)'
                    }}>
                        + Construct New Facility
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ManagementPanel;
