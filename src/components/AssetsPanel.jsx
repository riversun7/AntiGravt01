import { useState } from 'react';

function AssetsPanel({ player }) {
    const [subTab, setSubTab] = useState('resources'); // resources, humans, creatures, androids

    if (!player) return <div>No Data</div>;

    const renderList = (items, type) => {
        if (!items || items.length === 0) {
            return <div style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>No {type} acquired.</div>;
        }
        return (
            <div className="asset-list">
                {items.map((item, idx) => (
                    <div key={idx} className="card" style={{ marginBottom: '0.5rem', padding: '0.5rem' }}>
                        {item.name || "Unknown"}
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="sector-detail">
            <h2>Assets & Possessions</h2>

            <div className="tabs" style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
                {['resources', 'humans', 'creatures', 'androids'].map(tab => (
                    <button
                        key={tab}
                        className={subTab === tab ? 'active' : ''}
                        style={{
                            padding: '0.5rem 1rem',
                            color: subTab === tab ? 'var(--accent-primary)' : 'var(--text-secondary)',
                            borderBottom: subTab === tab ? '2px solid var(--accent-primary)' : 'none'
                        }}
                        onClick={() => setSubTab(tab)}
                    >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                ))}
            </div>

            <div className="tab-content" style={{ height: 'calc(100% - 100px)', overflowY: 'auto' }}>
                {subTab === 'resources' && (
                    <div>
                        <div className="resource-summary card" style={{ marginBottom: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', padding: '1rem' }}>
                            <div>
                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Credits</div>
                                <div style={{ fontSize: '1.2rem', color: 'var(--warning)' }}>{player.money}</div>
                            </div>
                            <div>
                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Energy</div>
                                <div style={{ fontSize: '1.2rem', color: 'var(--success)' }}>{player.energy}</div>
                            </div>
                            <div>
                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Materials</div>
                                <div style={{ fontSize: '1.2rem', color: 'var(--text-primary)' }}>{player.materials}</div>
                            </div>
                        </div>
                        <h3>Inventory</h3>
                        {renderList(player.inventory, 'items')}
                    </div>
                )}

                {subTab === 'humans' && (
                    <div>
                        <h3>Hired Personnel</h3>
                        {renderList(player.human_employees, 'humans')}
                    </div>
                )}

                {subTab === 'creatures' && (
                    <div>
                        <h3>Biological Specimens</h3>
                        {renderList(player.creatures, 'creatures')}
                    </div>
                )}

                {subTab === 'androids' && (
                    <div>
                        <h3>Android Units</h3>
                        {renderList(player.androids, 'androids')}
                    </div>
                )}
            </div>
        </div>
    );
}

export default AssetsPanel;
