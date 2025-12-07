import React, { useRef, useEffect } from 'react';
import { TILE_TYPES, WORLD_SIZE } from '../data/worldData';

const TILE_COLORS = {
    [TILE_TYPES.OCEAN]: '#001a33',
    [TILE_TYPES.PLAINS]: '#1a4d1a',
    [TILE_TYPES.FOREST]: '#0d260d',
    [TILE_TYPES.MOUNTAIN]: '#4d4d4d',
    [TILE_TYPES.CITY]: '#ffb800', // Warning color
    // Fallback
    'default': '#050510'
};

function Minimap({ map, playerPos }) {
    const canvasRef = useRef(null);

    useEffect(() => {
        if (!map || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const width = WORLD_SIZE;
        const height = WORLD_SIZE;

        // Resize canvas if needed
        if (canvas.width !== width) canvas.width = width;
        if (canvas.height !== height) canvas.height = height;

        const imageData = ctx.createImageData(width, height);
        const data = imageData.data;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const tile = map[y][x];
                const colorHex = TILE_COLORS[tile.type] || TILE_COLORS.default;

                const r = parseInt(colorHex.slice(1, 3), 16);
                const g = parseInt(colorHex.slice(3, 5), 16);
                const b = parseInt(colorHex.slice(5, 7), 16);

                const index = (y * width + x) * 4;
                data[index] = r;
                data[index + 1] = g;
                data[index + 2] = b;
                data[index + 3] = 255;
            }
        }

        ctx.putImageData(imageData, 0, 0);

        // Draw Player
        if (playerPos) {
            ctx.fillStyle = '#00f0ff'; // Accent Primary
            ctx.shadowColor = '#00f0ff';
            ctx.shadowBlur = 5;
            ctx.beginPath();
            ctx.arc(playerPos.x, playerPos.y, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0; // Reset

            // Draw Viewport Rect (15x15) - centered on player
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.strokeRect(playerPos.x - 7, playerPos.y - 7, 15, 15);
        }

    }, [map, playerPos]);

    return (
        <div className="minimap-container">
            <canvas
                ref={canvasRef}
                className="minimap-canvas"
            />
            <div className="minimap-label">
                RADAR
            </div>
        </div>
    );
}

export default Minimap;
