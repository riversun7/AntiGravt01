"use client";

import React, { useEffect, useState, useMemo, Suspense, useRef } from "react";
import { useRouter } from "next/navigation";
import { Globe, Database, Map as MapIcon, Box, MousePointer2 } from "lucide-react";
import { Canvas, useLoader, useFrame, ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Stars, Html } from "@react-three/drei";
import * as THREE from "three";
import SystemMenu from "@/components/SystemMenu";
import { API_BASE_URL } from "@/lib/config";

// Types
interface WorldTile {
    id: string; // x_y
    x: number;
    y: number;
    type: string;
    faction?: string;
    owner_id?: number;
    name?: string;
}

interface MovementState {
    startPos: { x: number, y: number };
    endPos: { x: number, y: number };
    startTime: number;
    endTime: number;
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
    disabled?: boolean;
}

// Map Constants matching Server Generation
const MAP_W = 160;
const MAP_H = 80;

function InteractiveGlobe({
    userPos,
    movement,
    tiles,
    onTileClick,
    selectedTile,
    texturePath
}: {
    userPos: string | null,
    movement: MovementState | null,
    tiles: Map<string, WorldTile>,
    onTileClick: (x: number, y: number) => void,
    selectedTile: WorldTile | null,
    texturePath: string
}) {
    const earthTexture = useLoader(THREE.TextureLoader, texturePath);

    // Raycasting Logic
    const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
        if (!e.uv) return;
        const u = e.uv.x;
        const v = e.uv.y;
        const x = Math.floor(u * MAP_W);
        const y = Math.floor((1 - v) * MAP_H);
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

            {/* User Marker (Self) - Animated */}
            {movement ? (
                <AnimatedMarker movement={movement} />
            ) : (
                userPos && (
                    <Marker
                        x={parseInt(userPos.split('_')[0])}
                        y={parseInt(userPos.split('_')[1])}
                        color="#22d3ee" // Cyan-400
                        label="COMMANDER"
                        isUnit
                    />
                )
            )}
        </group>
    );
}

// Convert Tile XY to 3D Cartesian Position on Sphere
function tileToVector3(x: number, y: number, radius: number) {
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
    return <MarkerMesh pos={pos} color={color} label={label} isUnit={isUnit} />;
}

// Separate mesh component to reuse for static and animated logic
function MarkerMesh({ pos, color, label, isUnit }: { pos: THREE.Vector3, color: string, label?: string, isUnit?: boolean }) {
    const quaternion = useMemo(() => {
        const normal = pos.clone().normalize();
        return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
    }, [pos]);

    return (
        <group position={pos} quaternion={quaternion}>
            {/* Laser/Pole */}
            <mesh position={[0, 0.15, 0]}>
                <cylinderGeometry args={[0.002, 0.002, 0.3, 4]} />
                <meshBasicMaterial color={color} transparent opacity={0.4} blending={THREE.AdditiveBlending} />
            </mesh>
            {/* Base Indicator */}
            <mesh position={[0, 0.005, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.02, 0.025, 32]} />
                <meshBasicMaterial color={color} side={THREE.DoubleSide} transparent opacity={0.6} />
            </mesh>
            {/* Unit Core */}
            <mesh position={[0, 0, 0]}>
                <sphereGeometry args={[0.015, 16, 16]} />
                <meshBasicMaterial color={color} />
            </mesh>
            {/* Label */}
            {label && (
                <Html position={[0.05, 0, 0.2]} center distanceFactor={4} zIndexRange={[100, 0]} style={{ pointerEvents: 'none' }}>
                    <div className="flex flex-col items-center opacity-80">
                        <div className={`text-[6px] font-mono font-bold tracking-widest ${isUnit ? 'text-cyan-400' : 'text-amber-400'}`}
                            style={{ textShadow: '0 0 2px currentColor', whiteSpace: 'nowrap' }}>
                            {label}
                        </div>
                        <div className={`w-px h-3 opacity-30 ${isUnit ? 'bg-cyan-500' : 'bg-amber-500'}`} style={{ transform: 'skewX(-10deg)' }}></div>
                    </div>
                </Html>
            )}
        </group>
    );
}

function AnimatedMarker({ movement }: { movement: MovementState }) {
    const [currentPosVec, setCurrentPosVec] = useState(new THREE.Vector3(0, 0, 0));
    const [statusLabel, setStatusLabel] = useState("MOVING");

    useFrame(() => {
        const now = Date.now();
        // Calculate progress (0 to 1)
        let progress = (now - movement.startTime) / (movement.endTime - movement.startTime);
        if (progress > 1) progress = 1;

        // Linear interpolation of Tile Coordinates
        const x = movement.startPos.x + (movement.endPos.x - movement.startPos.x) * progress;
        const y = movement.startPos.y + (movement.endPos.y - movement.startPos.y) * progress;

        const vec = tileToVector3(x, y, 2.0);
        setCurrentPosVec(vec);

        const remaining = Math.ceil((movement.endTime - now) / 1000);
        setStatusLabel(remaining > 0 ? `MOVING (${remaining}s)` : "ARRIVING...");
    });

    return <MarkerMesh pos={currentPosVec} color="#22d3ee" label={statusLabel} isUnit={true} />;
}

export default function MapPage3D() {
    const [tiles, setTiles] = useState<Map<string, WorldTile>>(new Map());
    const [userPos, setUserPos] = useState<string | null>(null);
    const [movement, setMovement] = useState<MovementState | null>(null);
    const [selectedTile, setSelectedTile] = useState<WorldTile | null>(null);
    const [loading, setLoading] = useState(true);
    const [currentTex, setCurrentTex] = useState("/maps/tactical_v3.png");

    const MAP_OPTIONS = [
        { label: "TACTICAL", path: "/maps/tactical_v3.png" },
        { label: "REALISTIC", path: "/maps/realistic_final_4k.png" },
        { label: "HOLOGRAM", path: "/maps/hologram_v4.png" },
        { label: "STRATEGY", path: "/maps/strategy_v3.png" }
    ];

    // Fetch Data & Refresh Status
    const fetchData = async () => {
        try {
            const [mapData, userData] = await Promise.all([
                fetch(`${API_BASE_URL}/api/world-map`).then(r => r.json()),
                fetch(`${API_BASE_URL}/api/user/1`).then(r => r.json())
            ]);

            const map = new Map<string, WorldTile>();
            mapData.forEach((t: WorldTile) => map.set(t.id, t));
            setTiles(map);

            if (userData.current_pos) setUserPos(userData.current_pos);

            // Handle Movement State
            if (userData.destination_pos && userData.arrival_time && userData.start_pos) {
                const now = Date.now();
                const arrival = new Date(userData.arrival_time).getTime();

                if (arrival > now) {
                    // Still moving
                    const startRaw = userData.start_pos.split('_').map(Number);
                    const endRaw = userData.destination_pos.split('_').map(Number);
                    const depTime = new Date(userData.departure_time).getTime();

                    setMovement({
                        startPos: { x: startRaw[0], y: startRaw[1] },
                        endPos: { x: endRaw[0], y: endRaw[1] },
                        startTime: depTime,
                        endTime: arrival
                    });
                } else {
                    // Should be arrived, but client just loaded
                    // Refresh to finish arrival server-side (GET /user/:id triggers it)
                    // We already fetched /user/1 which should have triggered resolution
                    setMovement(null);
                    // Refetch user to get final pos if resolution just happened
                    const updatedUser = await fetch(`${API_BASE_URL}/api/user/1`).then(r => r.json());
                    if (updatedUser.current_pos) setUserPos(updatedUser.current_pos);
                }
            } else {
                setMovement(null);
            }
            setLoading(false);
        } catch (e) {
            console.error("Init Error", e);
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();

        // Poll for arrival completion if moving
        const interval = setInterval(() => {
            if (movement) {
                if (Date.now() > movement.endTime) {
                    fetchData(); // Refresh to snap to final pos
                }
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [movement]);

    const handleTileClick = (x: number, y: number) => {
        const id = `${x}_${y}`;
        const tile = tiles.get(id);
        if (tile) {
            setSelectedTile(tile);
        } else {
            setSelectedTile({ id, x, y, type: 'UNKNOWN', name: 'Uncharted' });
        }
    };

    const handleMove = async () => {
        if (!selectedTile) return;
        try {
            const res = await fetch(`${API_BASE_URL}/api/map/move`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: 1, targetId: selectedTile.id })
            });
            const data = await res.json();

            if (data.success) {
                // Set client animation state
                const currentRaw = (userPos || "0_0").split('_').map(Number);
                const targetRaw = selectedTile.id.split('_').map(Number);
                const startTime = Date.now();
                const endTime = new Date(data.arrival_time).getTime();

                setMovement({
                    startPos: { x: currentRaw[0], y: currentRaw[1] },
                    endPos: { x: targetRaw[0], y: targetRaw[1] },
                    startTime: startTime,
                    endTime: endTime
                });
            } else {
                alert("Move failed: " + data.error);
            }
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="w-full h-screen bg-black relative font-mono overflow-hidden">
            {/* TOP BAR */}
            <div className="absolute top-0 left-0 w-full h-16 bg-gradient-to-b from-slate-900 via-slate-900/80 to-transparent z-50 flex items-center justify-between px-6 border-b border-cyan-500/20 backdrop-blur-sm">
                <div className="flex items-center gap-4 relative">
                    <SystemMenu activePage="map2" variant="overlay" />
                    <div className="flex gap-1 ml-4 bg-slate-900/50 p-1 rounded border border-slate-700">
                        {MAP_OPTIONS.map(opt => (
                            <button
                                key={opt.label}
                                onClick={() => setCurrentTex(opt.path)}
                                className={`text-[9px] px-2 py-1 rounded transition-colors uppercase font-bold ${currentTex === opt.path ? "bg-cyan-900 text-cyan-300" : "text-slate-500 hover:text-slate-300"}`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>
                {/* Resource Counters */}
                <div className="flex items-center gap-8">
                    <ResourceItem icon={<Database size={14} />} label="CREDITS" value="12,450" color="text-yellow-400" />
                    <ResourceItem icon={<Box size={14} />} label="MATERIALS" value="850" color="text-blue-400" />
                    <ResourceItem icon={<Globe size={14} />} label="ENERGY" value="98%" color="text-green-400" />
                </div>
            </div>

            {/* SIDE PANEL */}
            <div className="absolute top-20 left-6 w-80 z-10 flex flex-col gap-2">
                <div className="bg-slate-900/90 border border-cyan-500/30 p-1">
                    <div className="bg-slate-900/50 border border-cyan-500/10 p-4 relative overflow-hidden">
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
                            </div>
                        ) : (
                            <div className="h-40 flex items-center justify-center text-slate-600 text-xs text-center leading-relaxed">
                                NO SECTOR SELECTED<br />INITIATE SCAN OR SELECT TARGET
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-slate-900/80 border-t border-slate-700 p-2 text-[10px] text-green-500 font-mono h-24 overflow-hidden shadow-lg">
                    <div className="opacity-50">System: Connection established...</div>
                    <div className="opacity-70">System: 3D Engine ready.</div>
                    {movement && <div className="text-yellow-400 animate-pulse">&gt; MOVEMENT IN PROGRESS...</div>}
                </div>
            </div>

            {/* BOTTOM BAR */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10">
                <div className="flex gap-2 bg-slate-900/90 p-2 rounded-lg border border-slate-700 shadow-2xl backdrop-blur-md">
                    <ActionButton
                        icon={<MousePointer2 size={20} />}
                        label={movement ? "MOVING..." : "MOVE"}
                        active={!!selectedTile && !movement}
                        onClick={handleMove}
                        hotkey="M"
                        disabled={!!movement}
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
                        movement={movement}
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

// UI Helpers
function ResourceItem({ icon, label, value, color }: ResourceItemProps) {
    return (
        <div className="flex items-center gap-2">
            <div className={`opacity-80 ${color}`}>{icon}</div>
            <div className="flex flex-col leading-none">
                <span className="text-[9px] text-slate-500 font-bold">{label}</span>
                <span className={`text-sm font-bold ${color}`}>{value}</span>
            </div>
        </div>
    );
}

function InfoBox({ label, value, highlight }: InfoBoxProps) {
    return (
        <div className="bg-slate-800/50 p-2 rounded border border-slate-700">
            <div className="text-[9px] text-slate-500 uppercase mb-1">{label}</div>
            <div className={`text-sm font-bold ${highlight ? 'text-cyan-400' : 'text-slate-200'}`}>{value}</div>
        </div>
    );
}

function ActionButton({ icon, label, active, onClick, hotkey, disabled }: ActionButtonProps) {
    return (
        <button
            disabled={!active || disabled}
            onClick={onClick}
            className={`
                relative group flex flex-col items-center justify-center w-20 h-20 rounded 
                border transition-all duration-200
                ${active && !disabled
                    ? 'bg-slate-800 border-cyan-500/50 hover:bg-cyan-900/30 hover:border-cyan-400 text-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.1)]'
                    : 'bg-slate-900/50 border-slate-800 text-slate-600 cursor-not-allowed'
                }
            `}
        >
            <div className="mb-1 transform group-hover:scale-110 transition-transform">{icon}</div>
            <div className="text-[10px] font-bold tracking-wider">{label}</div>
            <div className="absolute top-1 right-2 text-[8px] opacity-50 font-mono border border-current px-1 rounded">{hotkey}</div>
            {active && !disabled && <div className="absolute bottom-0 w-full h-0.5 bg-cyan-500 scale-x-0 group-hover:scale-x-100 transition-transform"></div>}
        </button>
    );
}
