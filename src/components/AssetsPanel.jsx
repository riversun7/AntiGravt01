import { useState } from 'react';
import { useGame } from '../context/GameContext';

const MARKET_RATES = {
    energy: { buy: 2, sell: 1 },
    materials: { buy: 5, sell: 3 },
    food: { buy: 10, sell: 5 }
};

function AssetsPanel() {
    const { player, setPlayer, addToLog } = useGame();
    const [subTab, setSubTab] = useState('resources'); // resources, market, units

    if (!player) return <div>No Data</div>;

    const handleTrade = (resource, type) => {
        const rate = MARKET_RATES[resource];
        const amount = 10; // Batch size

        if (type === 'buy') {
            const cost = rate.buy * amount;
            if (player.money >= cost) {
                setPlayer(p => ({
                    ...p,
                    money: p.money - cost,
                    [resource]: (p[resource] || 0) + amount
                }));
                addToLog(`Market: Bought ${amount} ${resource} for $${cost}.`);
            } else {
                addToLog("Insufficient Credits.");
            }
        } else {
            // Sell
            if ((player[resource] || 0) >= amount) {
                const gain = rate.sell * amount;
                setPlayer(p => ({
                    ...p,
                    money: p.money + gain,
                    [resource]: p[resource] - amount
                }));
                addToLog(`Market: Sold ${amount} ${resource} for $${gain}.`);
            } else {
                addToLog(`Insufficient ${resource}.`);
            }
        }
    };

    return (
        <div className="sector-detail">
            <div className="panel-header" style={{
                borderBottom: '1px solid var(--border-color)',
                paddingBottom: '1rem',
                marginBottom: '1rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <h2 style={{ margin: 0 }}>Assets & Trade</h2>
            </div>

            <div className="tabs" style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
                {['resources', 'market', 'units'].map(tab => (
                    <button
                        key={tab}
                        className={subTab === tab ? 'active' : ''}
                        style={{
                            padding: '0.5rem 1rem',
                            color: subTab === tab ? 'var(--accent-primary)' : 'var(--text-secondary)',
                            fontWeight: subTab === tab ? 'bold' : 'normal',
                            borderBottom: subTab === tab ? '2px solid var(--accent-primary)' : 'none',
                            background: 'transparent',
                            cursor: 'pointer'
                        }}
                        onClick={() => setSubTab(tab)}
                    >
                        {tab.toUpperCase()}
                    </button>
                ))}
            </div>

            <div className="tab-content" style={{ height: 'calc(100% - 150px)', overflowY: 'auto' }}>
                {subTab === 'resources' && (
                    <div>
                        <div className="resource-summary card" style={{ marginBottom: '1rem', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', padding: '1.5rem' }}>
                            <div>
                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Credits</div>
                                <div style={{ fontSize: '1.5rem', color: 'var(--warning)', fontWeight: 'bold' }}>${player.money.toLocaleString()}</div>
                            </div>
                            <div>
                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Energy</div>
                                <div style={{ fontSize: '1.5rem', color: 'var(--success)', fontWeight: 'bold' }}>{player.energy.toLocaleString()}</div>
                            </div>
                            <div>
                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Materials</div>
                                <div style={{ fontSize: '1.5rem', color: 'var(--text-primary)', fontWeight: 'bold' }}>{player.materials.toLocaleString()}</div>
                            </div>
                        </div>
                    </div>
                )}

                {subTab === 'market' && (
                    <div className="market-interface">
                        <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
                            <h3 style={{ marginTop: 0 }}>Global Exchange</h3>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Real-time trading prices established by the Trade Federation.</p>

                            <div className="trade-grid" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                                {Object.entries(MARKET_RATES).map(([res, rates]) => (
                                    <div key={res} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '0.8rem', borderRadius: '4px' }}>
                                        <div style={{ textTransform: 'capitalize', fontWeight: 'bold', minWidth: '100px' }}>{res}</div>
                                        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                            Buy: <span style={{ color: 'var(--danger)' }}>${rates.buy}</span> | Sell: <span style={{ color: 'var(--success)' }}>${rates.sell}</span>
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <button className="btn-small" onClick={() => handleTrade(res, 'buy')}>Buy 10</button>
                                            <button className="btn-small" onClick={() => handleTrade(res, 'sell')}>Sell 10</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {subTab === 'units' && (
                    <div>
                        <h3>Deployed Assets</h3>
                        <div className="asset-list">
                            {(player.units || []).map((u, i) => (
                                <div key={i} className="card" style={{ marginBottom: '0.5rem', padding: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                                    <span>{u.name}</span>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Status: Active</span>
                                </div>
                            ))}
                            {(!player.units || player.units.length === 0) && <div style={{ fontStyle: 'italic', color: 'var(--text-secondary)' }}>No units deployed.</div>}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default AssetsPanel;
