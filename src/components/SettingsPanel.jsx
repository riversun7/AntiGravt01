import React from 'react';

function SettingsPanel({ theme, onThemeChange, onResetData }) {
    return (
        <div className="sector-detail">
            <h2>System Configuration</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
                Adjust neural interface parameters and memory banks.
            </p>

            <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '1.2rem', color: 'var(--accent-primary)', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                    Visual Interface
                </h3>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button
                        className={`btn-small ${theme === 'cyber' ? 'active' : ''}`}
                        onClick={() => onThemeChange('cyber')}
                        style={{
                            borderColor: theme === 'cyber' ? 'var(--accent-primary)' : 'var(--border-color)',
                            color: theme === 'cyber' ? 'var(--accent-primary)' : 'var(--text-secondary)'
                        }}
                    >
                        Cyber (Default)
                    </button>
                    <button
                        className={`btn-small ${theme === 'pastel' ? 'active' : ''}`}
                        onClick={() => onThemeChange('pastel')}
                        style={{
                            borderColor: theme === 'pastel' ? 'var(--accent-primary)' : 'var(--border-color)',
                            color: theme === 'pastel' ? 'var(--accent-primary)' : 'var(--text-secondary)'
                        }}
                    >
                        Pastel (Light)
                    </button>
                </div>
            </div>

            <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '1.2rem', color: 'var(--accent-primary)', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                    Memory Banks
                </h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-dim)', marginBottom: '1rem' }}>
                    Clear local simulation data. This action cannot be undone.
                </p>
                <button
                    className="btn-small"
                    onClick={onResetData}
                    style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
                >
                    Factory Reset
                </button>
            </div>
        </div>
    );
}

export default SettingsPanel;
