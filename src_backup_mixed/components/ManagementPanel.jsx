import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { UNIT_TYPES } from '../data/units';
import { BUILDINGS } from '../data/buildings';

function ManagementPanel({ tile, onBack }) {
    const { player, setPlayer, log, addToLog } = useGame();
    const [activeTab, setActiveTab] = useState('personnel'); // facilities, personnel

    const handleRecruit = (unitType) => {
        // Cost Check
        if (player.money < unitType.cost.money) {
            addToLog(`Insufficient Credits to recruit ${unitType.name}.`);
            return;
        }
        if (unitType.cost.food && (player.food || 0) < unitType.cost.food) {
            // We don't have food resource yet, ignore for now or add to player structure
            // simplifying to just money/energy/materials for MVP
        }

        // Deduct Cost
        const newMoney = player.money - unitType.cost.money;
        const newUnits = [...(player.units || []), {
            ...unitType,
            instanceId: Date.now(),
            assignedTo: null
        }];

        setPlayer(p => ({
            ...p,
            money: newMoney,
            units: newUnits
        }));

        addToLog(`Recruited: ${unitType.name}.`);
    };

    const unitList = Object.values(UNIT_TYPES);
    const ownedUnits = player.units || [];
    const ownedBuildings = player.buildings || [];

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
                    <h2 style={{ margin: 0 }}>Command Center</h2>
                    {tile && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                            Sector [{tile.x}, {tile.y}] Local Command
                        </div>
                    )}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                        className={`btn-secondary ${activeTab === 'personnel' ? 'active-tab' : ''}`}
                        onClick={() => setActiveTab('personnel')}
                        style={{ background: activeTab === 'personnel' ? 'var(--accent-primary)' : '' }}
                    >
                        Personnel
                    </button>
                    <button
                        className={`btn-secondary ${activeTab === 'facilities' ? 'active-tab' : ''}`}
                        onClick={() => setActiveTab('facilities')}
                        style={{ background: activeTab === 'facilities' ? 'var(--accent-primary)' : '' }}
                    >
                        Facilities
                    </button>
                </div>
            </div>

            <div className="panel-content" style={{ flex: 1, overflowY: 'auto' }}>

                {activeTab === 'facilities' && (
                    <div className="facilities-section">
                        <h3>Operational Facilities ({ownedBuildings.length})</h3>
                        {ownedBuildings.length === 0 && <p style={{ color: 'var(--text-secondary)' }}>No facilities constructed.</p>}
                        <div className="list-grid">
                            {ownedBuildings.map((b, i) => (
                                <div key={i} className="card" style={{ padding: '1rem', marginBottom: '0.5rem' }}>
                                    <div style={{ fontWeight: 'bold' }}>{b.name}</div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--success)' }}>Active (Efficiency: 100%)</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'personnel' && (
                    <div className="personnel-section">
                        <div className="recruitment-center" style={{ marginBottom: '2rem' }}>
                            <h3>Recruitment Protocol</h3>
                            <div className="recruit-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                                {unitList.map(u => (
                                    <div key={u.id} className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        <div style={{ fontWeight: 'bold' }}>{u.name}</div>
                                        <div style={{ fontSize: '0.8rem' }}>{u.description}</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--warning)' }}>Cost: ${u.cost.money}</div>
                                        <button
                                            className="btn-primary"
                                            style={{ fontSize: '0.8rem', padding: '0.3rem' }}
                                            onClick={() => handleRecruit(u)}
                                            disabled={player.money < u.cost.money}
                                        >
                                            Recruit
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <h3>Roster ({ownedUnits.length})</h3>
                        <div className="roster-list">
                            {ownedUnits.map(u => (
                                <div key={u.instanceId} className="card" style={{ padding: '0.5rem', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                                    <span>{u.name} #{u.instanceId.toString().slice(-4)}</span>
                                    <span style={{ color: 'var(--text-secondary)' }}>Status: {u.assignedTo ? 'Assigned' : 'Idle'}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}

export default ManagementPanel;
