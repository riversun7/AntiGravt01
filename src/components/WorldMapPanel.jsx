
import React from 'react';

const WorldMapPanel = () => {
    return (
        <div style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }}>
            <iframe
                src="/world_globe.html"
                title="Cyberpunk Globe"
                style={{
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    backgroundColor: 'black' // Match the globe background to avoid white flash
                }}
            />
            <div style={{
                position: 'absolute',
                top: '20px',
                left: '20px',
                color: '#00ffff',
                fontFamily: 'monospace',
                pointerEvents: 'none', // Let clicks pass through to the iframe
                textShadow: '0 0 5px #00ffff'
            }}>
                <h2>SYSTEM: GLOBAL_RECON</h2>
                <p>&gt; ACQUIRING REAL-TIME ORBITAL DATA...</p>
                <p>&gt; CONNECTED.</p>
            </div>
        </div>
    );
};

export default WorldMapPanel;
