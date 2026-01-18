
import React, { useState } from 'react';

interface NpcControlModalProps {
    npc: any;
    onClose: () => void;
    onUpdate?: () => void;
}

export default function NpcControlModal({ npc, onClose, onUpdate }: NpcControlModalProps) {
    const [speed, setSpeed] = useState(npc.movement_speed || 0.1);
    const [vision, setVision] = useState(npc.vision_range || 10.0);
    const [loading, setLoading] = useState(false);
    const [statusMsg, setStatusMsg] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

    const handleUpdateStats = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setLoading(true);
        setStatusMsg(null);
        try {
            const res = await fetch(`/api/admin/npc/${npc.user_id}/update-stats`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ movement_speed: Number(speed), vision_range: Number(vision) })
            });
            if (res.ok) {
                setStatusMsg({ text: 'Stats updated!', type: 'success' });
                if (onUpdate) onUpdate();
            } else {
                setStatusMsg({ text: 'Update failed', type: 'error' });
            }
        } catch (e) {
            console.error(e);
            setStatusMsg({ text: 'Network error', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleCommand = async (command: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setLoading(true);
        setStatusMsg(null);
        try {
            const res = await fetch(`/api/admin/npc/${npc.user_id}/command`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command })
            });
            if (res.ok) {
                setStatusMsg({ text: `Command ${command} sent!`, type: 'success' });
                if (onUpdate) onUpdate();
            } else {
                const d = await res.json();
                setStatusMsg({ text: `Error: ${d.error}`, type: 'error' });
            }
        } catch (e) {
            console.error(e);
            setStatusMsg({ text: 'Command failed', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            onClick={(e) => e.stopPropagation()}
            style={{
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                backgroundColor: '#1a1a1a',
                padding: '20px',
                borderRadius: '8px',
                zIndex: 10001,
                color: 'white',
                border: '1px solid #444',
                minWidth: '300px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
            }}
        >
            <h2 style={{ margin: '0 0 15px 0' }}>{npc.cyborg_name} (Level {npc.level})</h2>
            <p style={{ color: '#888' }}>{npc.faction_name} ({npc.npc_type})</p>

            <div style={{ marginBottom: '15px' }}>
                <h3 style={{ fontSize: '14px', borderBottom: '1px solid #444', paddingBottom: '5px' }}>Stats</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>Speed (km/s)</label>
                        <input
                            type="number"
                            step="0.01"
                            value={speed}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => setSpeed(e.target.value)}
                            style={{ width: '100%', padding: '5px', background: '#333', border: '1px solid #555', color: 'white' }}
                        />
                        <div style={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>
                            ≈ {(Number(speed) * 3600).toFixed(0)} km/h
                        </div>
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>Vision Range (km)</label>
                        <input
                            type="number"
                            step="0.1"
                            value={vision}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => setVision(e.target.value)}
                            style={{ width: '100%', padding: '5px', background: '#333', border: '1px solid #555', color: 'white' }}
                        />
                    </div>
                    <button
                        type="button"
                        onClick={handleUpdateStats}
                        disabled={loading}
                        style={{ padding: '8px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                        Update Stats
                    </button>
                </div>
            </div>

            <div>
                <h3 style={{ fontSize: '14px', borderBottom: '1px solid #444', paddingBottom: '5px' }}>Commands</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
                    <button type="button" onClick={(e) => handleCommand('PATROL', e)} disabled={loading} style={btnStyle}>Patrol</button>
                    <button type="button" onClick={(e) => handleCommand('EXPAND', e)} disabled={loading} style={btnStyle}>Expand</button>
                    <button type="button" onClick={(e) => handleCommand('RETURN', e)} disabled={loading} style={btnStyle}>Return Base</button>
                    <button type="button" onClick={(e) => handleCommand('STOP', e)} disabled={loading} style={{ ...btnStyle, background: '#ef4444' }}>Stop</button>
                </div>
            </div>

            {statusMsg && (
                <div style={{
                    marginTop: '15px',
                    padding: '8px',
                    borderRadius: '4px',
                    background: statusMsg.type === 'success' ? 'rgba(0, 255, 0, 0.1)' : 'rgba(255, 0, 0, 0.1)',
                    color: statusMsg.type === 'success' ? '#4ade80' : '#ef4444',
                    fontSize: '12px',
                    textAlign: 'center'
                }}>
                    {statusMsg.text}
                </div>
            )}

            <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onClose(); }}
                style={{ marginTop: '20px', width: '100%', padding: '8px', background: 'transparent', border: '1px solid #666', color: '#ccc', borderRadius: '4px', cursor: 'pointer' }}
            >
                Close
            </button>
        </div>
    );
}

const btnStyle = {
    padding: '8px',
    background: '#333',
    color: 'white',
    border: '1px solid #555',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px'
};
