import React, { useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { TECH_TREE } from '../data/techTree';

function ResearchPanel() {
    const { player, setPlayer, addToLog } = useGame();
    const { research } = player;

    // Check completion (Active Polling via Render - simple for now)
    useEffect(() => {
        if (research.current) {
            const tech = TECH_TREE[research.current];
            if (research.progress >= tech.time) {
                // COMPLETE!
                addToLog(`Research Complete: ${tech.name}`);
                setPlayer(p => ({
                    ...p,
                    research: {
                        completed: [...p.research.completed, research.current],
                        current: null,
                        progress: 0
                    }
                }));
            }
        }
    }, [research, setPlayer, addToLog]);

    const handleStartResearch = (techId) => {
        const tech = TECH_TREE[techId];

        // Cost Check
        if (player.money < tech.cost.money || (player.energy < (tech.cost.energy || 0))) {
            addToLog("Insufficient resources to fund this project.");
            return;
        }

        // Deduct & Start
        setPlayer(p => ({
            ...p,
            money: p.money - tech.cost.money,
            energy: p.energy - (tech.cost.energy || 0),
            research: {
                ...p.research,
                current: techId,
                progress: 0
            }
        }));
        addToLog(`Started Research: ${tech.name}`);
    };

    return (
        <div className="research-panel screen-container" style={{ alignItems: 'flex-start', overflowY: 'auto' }}>
            <h2 className="title-large" style={{ fontSize: '3rem', alignSelf: 'center' }}>R&D LAB</h2>

            {research.current && (
                <div className="card" style={{ width: '100%', marginBottom: '2rem', borderColor: 'var(--accent-primary)' }}>
                    <h3>Active Project: {TECH_TREE[research.current].name}</h3>
                    <div className="progress-bar-container" style={{ height: '20px', background: 'rgba(0,0,0,0.5)', width: '100%', borderRadius: '10px', overflow: 'hidden' }}>
                        <div className="progress-fill" style={{
                            height: '100%',
                            width: `${Math.min(100, (research.progress / TECH_TREE[research.current].time) * 100)}%`,
                            background: 'var(--accent-primary)',
                            transition: 'width 1s linear'
                        }}></div>
                    </div>
                </div>
            )}

            <div className="tech-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '2rem', width: '100%' }}>
                {Object.values(TECH_TREE).map(tech => {
                    const isCompleted = research.completed.includes(tech.id);
                    const isUnlocked = tech.prereq.every(p => research.completed.includes(p));
                    const isResearching = research.current === tech.id;

                    let statusClass = 'locked';
                    if (isCompleted) statusClass = 'completed';
                    else if (isResearching) statusClass = 'researching';
                    else if (isUnlocked) statusClass = 'available';

                    return (
                        <div key={tech.id} className={`card tech-node ${statusClass}`} style={{
                            opacity: statusClass === 'locked' ? 0.5 : 1,
                            border: isCompleted ? '1px solid var(--success)' : (isResearching ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)')
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <h3>{tech.name}</h3>
                                {isCompleted && <span style={{ color: 'var(--success)' }}>✔</span>}
                            </div>
                            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{tech.description}</p>

                            {!isCompleted && (
                                <div style={{ fontSize: '0.8rem', marginTop: '1rem' }}>
                                    <div>Cost: ${tech.cost.money}</div>
                                    <div>Time: {tech.time}s</div>
                                    <button
                                        className="btn-primary"
                                        style={{ width: '100%', marginTop: '0.5rem', padding: '0.5rem' }}
                                        disabled={!isUnlocked || research.current !== null}
                                        onClick={() => handleStartResearch(tech.id)}
                                    >
                                        {isUnlocked ? "Begin Research" : "Locked"}
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default ResearchPanel;
