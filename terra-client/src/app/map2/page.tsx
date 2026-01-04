"use client";

import React, { useEffect, useState, useMemo, Suspense } from "react";
import { useRouter } from "next/navigation";
import { Globe, Database, Map as MapIcon, Box, MousePointer2 } from "lucide-react";
import { Canvas, useLoader, useFrame, ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Stars, Html } from "@react-three/drei";
import * as THREE from "three";
import SystemMenu from "@/components/SystemMenu";

// Types
interface WorldTile {
    id: string; // x_y
    x: number;
    y: number;
    type: string;
    faction?: string;
    owner_id?: number;
    name?: string; // Add optional name
}

interface ResourceItemProps {
    icon: React.ReactNode;
    label: string;
    value: string;
    color: string;
}

interface InfoBoxProps {
    label: string;
    value: string;
    highlight?: boolean;
}

interface ActionButtonProps {
    icon: React.ReactNode;
    label: string;
    active: boolean;
    onClick: () => void;
    hotkey: string;
}

// Map Constants matching Server Generation
const MAP_W = 160;
const MAP_H = 80;

function InteractiveGlobe({
    userPos,
    tiles,
    onTileClick,
    selectedTile,
    texturePath
}: {
    userPos: string | null,
    tiles: Map<string, WorldTile>,
    onTileClick: (x: number, y: number) => void,
    selectedTile: WorldTile | null,
    texturePath: string
}) {
    const earthTexture = useLoader(THREE.TextureLoader, texturePath);

    // Raycasting Logic
    const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
        // e.uv contains the texture coordinate [0..1, 0..1]
        if (!e.uv) return;

        const u = e.uv.x;
        const v = e.uv.y;

        // Map UV to Tile Grid
        // U (0..1) -> X (0..159)
        // V (0..1) -> Y (0..79)
        // Note: V usually goes bottom(0) to top(1), but our map might be top-down.
        // Standard Equirectangular: V=1 is North Pole (Y=0), V=0 is South Pole (Y=79).

        const x = Math.floor(u * MAP_W);
        const y = Math.floor((1 - v) * MAP_H); // Invert V for standard map tiling

        onTileClick(x, y);
    };

    return (
        <group>
            {/* Main Earth Sphere */}
            <mesh onClick={handlePointerDown}>
                <sphereGeometry args={[2, 64, 64]} />
                <meshBasicMaterial
                    map={earthTexture}
                    color="white"
                />
            </mesh>

            {/* Atmosphere Glow */}
            <mesh scale={[2.02, 2.02, 2.02]}>
                <sphereGeometry args={[2.02, 64, 64]} />
                <meshBasicMaterial
                    color="#00ffff"
                    transparent
                    opacity={0.05}
                    side={THREE.BackSide}
                />
            </mesh>

            {/* Selected Tile Marker (Target) */}
            {selectedTile && (
                <Marker
                    x={selectedTile.x}
                    y={selectedTile.y}
                    color="#fbbf24" // Amber-400
                    label={selectedTile.name ? selectedTile.name.toUpperCase() : "TARGET"}
                />
            )}

            {/* User Marker (Self) */}
            {userPos && (
                <Marker
                    x={parseInt(userPos.split('_')[0])}
                    y={parseInt(userPos.split('_')[1])}
                    color="#22d3ee" // Cyan-400
                    label="COMMANDER"
                    isUnit
                />
            )}
        </group>
    );
}

// Convert Tile XY to 3D Cartesian Position on Sphere
function tileToVector3(x: number, y: number, radius: number) {
    // Map X/Y to Lat/Lon
    // X (0..160) -> Lon (-180..180)
    // Y (0..80) -> Lat (90..-90)

    const lon = (x / MAP_W) * 360 - 180;
    const lat = 90 - (y / MAP_H) * 180;

    // Safety offset to center of tile
    const lonCenter = lon + (180 / MAP_W);
    const latCenter = lat - (90 / MAP_H);

    // Spherical to Cartesian
    const phi = (90 - latCenter) * (Math.PI / 180);
    const theta = (lonCenter + 180) * (Math.PI / 180);

    const vx = -(radius * Math.sin(phi) * Math.cos(theta));
    const vz = radius * Math.sin(phi) * Math.sin(theta);
    const vy = radius * Math.cos(phi);

    return new THREE.Vector3(vx, vy, vz);
}

function Marker({ x, y, color, label, isUnit }: { x: number, y: number, color: string, label?: string, isUnit?: boolean }) {
    const pos = useMemo(() => tileToVector3(x, y, 2.0), [x, y]);

    // Explicitly align the group's "Up" (Y-axis) to the surface normal
    const quaternion = useMemo(() => {
        const normal = pos.clone().normalize();
        return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
    }, [pos]);

    return (
        <group position={pos} quaternion={quaternion}>
            {/* Laser/Pole Line from Surface - Aligned with Y-axis (Default) */}
            <mesh position={[0, 0.15, 0]}>
                <cylinderGeometry args={[0.002, 0.002, 0.3, 4]} />
                <meshBasicMaterial color={color} transparent opacity={0.4} blending={THREE.AdditiveBlending} />
            </mesh>

            {/* Base Indicator (Ring on Ground) - Rotate X 90 to lay flat on XZ plane relative to Y-up */}
            <mesh position={[0, 0.005, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.02, 0.025, 32]} />
                <meshBasicMaterial color={color} side={THREE.DoubleSide} transparent opacity={0.6} />
            </mesh>

            {/* Unit/Target Glowing Core */}
            <mesh position={[0, 0, 0]}>
                <sphereGeometry args={[0.015, 16, 16]} />
                <meshBasicMaterial color={color} />
            </mesh>

            {/* Floating Label - Ultra Minimal & Compact */}
            {label && (
                <Html position={[0.05, 0, 0.2]} center distanceFactor={4} zIndexRange={[100, 0]} style={{ pointerEvents: 'none' }}>
                    <div className="flex flex-col items-center opacity-80">
                        <div className={`
text - [6px] font - mono font - bold tracking - widest
                            ${isUnit ? 'text-cyan-400' : 'text-amber-400'}
`} style={{ textShadow: '0 0 2px currentColor', whiteSpace: 'nowrap' }}>
                            {label}
                        </div>
                        {/* Connecting Line */}
                        <div className={`w - px h - 3 opacity - 30 ${isUnit ? 'bg-cyan-500' : 'bg-amber-500'} `} style={{ transform: 'skewX(-10deg)' }}></div>
                    </div>
                </Html>
            )}
        </group>
    );
}


export default function MapPage3D() {
    const [tiles, setTiles] = useState<Map<string, WorldTile>>(new Map());
    const [userPos, setUserPos] = useState<string | null>(null);
    const [selectedTile, setSelectedTile] = useState<WorldTile | null>(null);
    const [loading, setLoading] = useState(true);
    const [currentTex, setCurrentTex] = useState("/maps/tactical_v4.png");

    // New Map Candidates
    const MAP_OPTIONS = [
        { label: "TACTICAL", path: "/maps/tactical_v4.png" },
        { label: "REALISTIC", path: "/maps/realistic_final_4k.png" },
        { label: "HOLOGRAM", path: "/maps/hologram_v4.png" },
        { label: "STRATEGY", path: "/maps/strategy_v3.png" }
    ];

    // Fetch Data
    useEffect(() => {
        Promise.all([
            fetch('http://localhost:3001/api/world-map').then(r => r.json()),
            fetch('http://localhost:3001/api/user/1').then(r => r.json()) // Hardcoded User 1 for MVP
        ]).then(([mapData, userData]) => {
            const map = new Map<string, WorldTile>();
            mapData.forEach((t: WorldTile) => map.set(t.id, t));
            setTiles(map);
            if (userData.current_pos) setUserPos(userData.current_pos);
            setLoading(false);
        });
    }, []);

    const handleTileClick = (x: number, y: number) => {
        const id = `${x}_${y} `;
        const tile = tiles.get(id);
        if (tile) {

            setSelectedTile(tile);
        } else {
            // Emulate implicit tile if not in DB (empty ocean etc)
            setSelectedTile({ id, x, y, type: 'UNKNOWN', name: 'Uncharted' });
        }
    };

    const handleMove = async () => {
        if (!selectedTile) return;
        try {
            await fetch('http://localhost:3001/api/map/move', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: 1, targetId: selectedTile.id })
            });
            setUserPos(selectedTile.id);
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="w-full h-screen bg-black relative font-mono overflow-hidden">
            {/* --- TOP BAR: RESOURCES & STATUS --- */}
            <div className="absolute top-0 left-0 w-full h-16 bg-gradient-to-b from-slate-900 via-slate-900/80 to-transparent z-50 flex items-center justify-between px-6 border-b border-cyan-500/20 backdrop-blur-sm">
                <div className="flex items-center gap-4 relative">
                    {/* System Menu Component */}
                    <SystemMenu activePage="map2" variant="overlay" />

                    {/* Map Switcher UI */}
                    <div className="flex gap-1 ml-4 bg-slate-900/50 p-1 rounded border border-slate-700">
                        {MAP_OPTIONS.map(opt => (
                            <button
                                key={opt.label}
                                onClick={() => setCurrentTex(opt.path)}
                                className={`text - [9px] px - 2 py - 1 rounded transition - colors uppercase font - bold ${currentTex === opt.path ? "bg-cyan-900 text-cyan-300" : "text-slate-500 hover:text-slate-300"} `}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>

                    <div className="h-6 w-px bg-cyan-800/50 mx-2"></div>
                    <div className="flex flex-col">
                        <span className="text-[10px] text-cyan-600 uppercase tracking-widest">System Time</span>
                        <span className="text-cyan-400 text-sm font-bold">2140.05.12 :: 14:00</span>
                    </div>
                </div>

                {/* Resource Counters (Mockup for now, connect to DB later) */}
                <div className="flex items-center gap-8">
                    <ResourceItem icon={<Database size={14} />} label="CREDITS" value="12,450" color="text-yellow-400" />
                    <ResourceItem icon={<Box size={14} />} label="MATERIALS" value="850" color="text-blue-400" />
                    <ResourceItem icon={<Globe size={14} />} label="ENERGY" value="98%" color="text-green-400" />
                </div>

                <div className="text-xs text-slate-500 uppercase tracking-widest">
                    <span className="text-cyan-500 animate-pulse">● ONLINE</span> { /* COMMANDER */}
                </div>
            </div>

            {/* --- SIDE PANEL: SECTOR INTEL --- */}
            <div className="absolute top-20 left-6 w-80 z-10 flex flex-col gap-2">
                <div className="bg-slate-900/90 border border-cyan-500/30 p-1">
                    <div className="bg-slate-900/50 border border-cyan-500/10 p-4 relative overflow-hidden">
                        {/* Decorative Corner lines */}
                        <div className="absolute top-0 left-0 w-2 h-2 border-l border-t border-cyan-500"></div>
                        <div className="absolute top-0 right-0 w-2 h-2 border-r border-t border-cyan-500"></div>
                        <div className="absolute bottom-0 right-0 w-2 h-2 border-r border-b border-cyan-500"></div>
                        <div className="absolute bottom-0 left-0 w-2 h-2 border-l border-b border-cyan-500"></div>

                        <h2 className="text-cyan-400 font-bold text-lg mb-1 flex items-center gap-2">
                            <MapIcon size={18} /> SECTOR ANALYSIS
                        </h2>
                        <div className="h-px w-full bg-gradient-to-r from-cyan-500/50 to-transparent mb-4"></div>

                        {selectedTile ? (
                            <div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-300">
                                <div>
                                    <div className="text-xs text-slate-500 uppercase">Sector ID</div>
                                    <div className="text-2xl text-white font-bold tracking-wider">
                                        {selectedTile.x.toString().padStart(3, '0')}-{selectedTile.y.toString().padStart(3, '0')}
                                    </div>
                                    <div className="text-sm text-cyan-300 mt-1">{selectedTile.name || "Uncharted Territory"}</div>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <InfoBox label="TERRAIN" value={selectedTile.type} />
                                    <InfoBox label="FACTION" value={selectedTile.faction || "Neutral"} highlight={!!selectedTile.faction} />
                                </div>

                                <div className="p-3 bg-cyan-950/20 border border-cyan-500/20 rounded">
                                    <div className="text-[10px] text-cyan-600 uppercase mb-2">Resource Yield</div>
                                    <div className="flex justify-between text-xs text-slate-300">
                                        <span>Minerals: <span className="text-white">High</span></span>
                                        <span>Energy: <span className="text-white">Low</span></span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="h-40 flex items-center justify-center text-slate-600 text-xs text-center leading-relaxed">
                                NO SECTOR SELECTED<br />INITIATE SCAN OR SELECT TARGET
                            </div>
                        )}
                    </div>
                </div>

                {/* --- CONSOLE LOG / STATUS --- */}
                <div className="bg-slate-900/80 border-t border-slate-700 p-2 text-[10px] text-green-500 font-mono h-24 overflow-hidden shadow-lg">
                    <div className="opacity-50">System: Connection established...</div>
                    <div className="opacity-70">System: 3D Engine ready.</div>
                    {selectedTile && <div>&gt; Target locked: Sector {selectedTile.x}-{selectedTile.y}</div>}
                    <div className="animate-pulse">&gt; Awaiting input_</div>
                </div>
            </div>

            {/* --- BOTTOM BAR: ACTIONS --- */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10">
                <div className="flex gap-2 bg-slate-900/90 p-2 rounded-lg border border-slate-700 shadow-2xl backdrop-blur-md">
                    <ActionButton
                        icon={<MousePointer2 size={20} />}
                        label="MOVE"
                        active={!!selectedTile}
                        onClick={handleMove}
                        hotkey="M"
                    />
                    <ActionButton
                        icon={<Database size={20} />}
                        label="SCAN"
                        active={!!selectedTile}
                        onClick={() => { }}
                        hotkey="S"
                    />
                    <ActionButton
                        icon={<Box size={20} />}
                        label="BUILD"
                        active={!!selectedTile}
                        onClick={() => { }}
                        hotkey="B"
                    />
                </div>
            </div>

            {loading && <div className="absolute inset-0 flex items-center justify-center text-cyan-500 z-50 bg-black">INITIALIZING 3D ENGINE...</div>}

            <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
                <ambientLight intensity={1.5} />
                <pointLight position={[10, 10, 10]} intensity={2.0} />
                <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />

                <Suspense fallback={null}>
                    <InteractiveGlobe
                        userPos={userPos}
                        tiles={tiles}
                        onTileClick={handleTileClick}
                        selectedTile={selectedTile}
                        texturePath={currentTex}
                    />
                </Suspense>

                <OrbitControls
                    enablePan={false}
                    minDistance={2.5}
                    maxDistance={8}
                    rotateSpeed={0.5}
                    zoomSpeed={0.8}
                />
            </Canvas>
        </div>
    );
}

// UI Components
function ResourceItem({ icon, label, value, color }: ResourceItemProps) {
    return (
        <div className="flex items-center gap-2">
            <div className={`opacity - 80 ${color} `}>{icon}</div>
            <div className="flex flex-col leading-none">
                <span className="text-[9px] text-slate-500 font-bold">{label}</span>
                <span className={`text - sm font - bold ${color} `}>{value}</span>
            </div>
        </div>
    );
}

function InfoBox({ label, value, highlight }: InfoBoxProps) {
    return (
        <div className="bg-slate-800/50 p-2 rounded border border-slate-700">
            <div className="text-[9px] text-slate-500 uppercase mb-1">{label}</div>
            <div className={`text - sm font - bold ${highlight ? 'text-cyan-400' : 'text-slate-200'} `}>{value}</div>
        </div>
    );
}

function ActionButton({ icon, label, active, onClick, hotkey }: ActionButtonProps) {
    return (
        <button
            disabled={!active}
            onClick={onClick}
            className={`
                relative group flex flex - col items - center justify - center w - 20 h - 20 rounded 
                border transition - all duration - 200
                ${active
                    ? 'bg-slate-800 border-cyan-500/50 hover:bg-cyan-900/30 hover:border-cyan-400 text-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.1)]'
                    : 'bg-slate-900/50 border-slate-800 text-slate-600 cursor-not-allowed'
                }
`}
        >
            <div className="mb-1 transform group-hover:scale-110 transition-transform">{icon}</div>
            <div className="text-[10px] font-bold tracking-wider">{label}</div>
            <div className="absolute top-1 right-2 text-[8px] opacity-50 font-mono border border-current px-1 rounded">{hotkey}</div>

            {/* Status indicator */}
            {active && <div className="absolute bottom-0 w-full h-0.5 bg-cyan-500 scale-x-0 group-hover:scale-x-100 transition-transform"></div>}
        </button>
    );
}
