'use client';

import React from 'react';
import { X, MapPin, Building, User } from 'lucide-react';

interface Building {
    id: number;
    type: string;
    level: number;
    x: number;
    y: number;
}

interface TerritoryInfo {
    id: number;
    owner_name: string;
    level: number;
    radius: number;
    is_absolute: boolean;
}

export interface Tile {
    x: number;
    y: number;
    type: string;
    name?: string;
    owner_id?: number | null;
}

interface TileInfoModalProps {
    tile?: Tile | null; // Make optional if territoryInfo is primary
    buildings?: Building[];
    territoryInfo?: TerritoryInfo;
    onClose: () => void;
    onClaim?: () => void;
    onBuild?: (buildingType: string) => void;
    onMove?: (x: number, y: number) => void;
    userId: number | null;
    position: { x: number; y: number };
}

// ... (Imports)

// Restoration of ConstructionButton
interface ConstructionButtonProps {
    icon: string;
    label: string;
    cost: string;
    onClick: () => void;
}

function ConstructionButton({ icon, label, cost, onClick }: ConstructionButtonProps) {
    return (
        <button
            onClick={onClick}
            className="flex flex-col items-center justify-center p-2 bg-slate-700 hover:bg-slate-600 rounded border border-slate-600 transition-colors"
        >
            <span className="text-2xl mb-1">{icon}</span>
            <span className="text-xs font-bold text-gray-200">{label}</span>
            <span className="text-[10px] text-yellow-400">{cost}</span>
        </button>
    );
}

export default function TileInfoModal({ tile, buildings = [], territoryInfo, onClose, onClaim, onBuild, onMove, userId, position }: TileInfoModalProps) {
    //...
    // If territoryInfo is present, we prioritize showing that context
    // But we might also have tile info (e.g. clicked on territory, also a tile).
    // If only territoryInfo, ensure safely handled.

    // Determine ownership
    const isOwnedByMe = territoryInfo
        ? false // username comparison needed, or assume 'My Territory' label logic upstream. 
        // Actually server returned user_id too? I didn't add user_id to query in server.js but it exists in territories list.
        // Assuming parent checks ownership.
        : (tile && String(tile.owner_id) === String(userId));

    const isOwned = territoryInfo ? true : (tile ? !!tile.owner_id : false);

    const [showBuildMenu, setShowBuildMenu] = React.useState(false);
    const [isMobile, setIsMobile] = React.useState(false);

    // ... Mobile detection ... (same)
    React.useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const getDesktopStyle = () => {
        let left = position.x + 20;
        let top = position.y + 20;
        if (typeof window !== 'undefined') {
            const width = 288;
            const height = 400;
            if (left + width > window.innerWidth) left = position.x - width - 20;
            if (top + height > window.innerHeight) top = position.y - height - 20;
        }
        return { left, top };
    };

    const modalStyle = isMobile ? undefined : getDesktopStyle();

    return (
        <div
            className={`
                z-[1600] bg-slate-900/95 backdrop-blur-md border border-cyan-500/30 shadow-2xl p-4
                ${isMobile
                    ? 'fixed bottom-[70px] left-2 right-2 rounded-xl animate-slide-up border mx-auto max-w-sm'
                    : 'absolute rounded-lg w-72'
                }
            `}
            style={isMobile ? undefined : modalStyle}
            onClick={(e) => e.stopPropagation()}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-3 border-b border-gray-700 pb-2">
                <div className="flex items-center gap-2">
                    {territoryInfo ? (
                        <div className="flex items-center gap-2 text-cyan-400">
                            <span className="text-lg">🏳️</span>
                            <span className="font-bold text-white text-sm">Territory Control</span>
                        </div>
                    ) : (
                        <>
                            <MapPin className="text-cyan-400" size={16} />
                            <span className="font-bold text-white text-sm">{tile?.name || `Sector ${tile?.x}, ${tile?.y}`}</span>
                        </>
                    )}
                </div>
                <button onClick={onClose} className="text-gray-400 hover:text-white">
                    <X size={16} />
                </button>
            </div>

            {/* Info Body */}
            <div className="text-xs space-y-1 mb-3 text-gray-300">
                {territoryInfo ? (
                    <>
                        {/* Territory Specific Info */}
                        <div className="flex justify-between items-center bg-slate-800 p-2 rounded border border-slate-700">
                            <div className="flex items-center gap-2">
                                <User size={14} className="text-cyan-400" />
                                <span className="text-gray-400">Owner:</span>
                            </div>
                            <span className="font-bold text-white bg-slate-900 px-2 py-0.5 rounded border border-gray-600">
                                {territoryInfo.owner_name || "Unknown"}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span>Status:</span>
                            <span className={territoryInfo.is_absolute ? "text-red-400 font-bold" : "text-green-400"}>
                                {territoryInfo.is_absolute ? "ABSOLUTE FACTION" : "Standard Faction"}
                            </span>
                        </div>
                        <div className="flex justify-between border-t border-gray-700 pt-1 mt-1">
                            <span>HQ Level:</span> <span className="text-yellow-400">Lv.{territoryInfo.level}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Radius/Bounds:</span>
                            <span className="text-white">
                                {territoryInfo.is_absolute ? "Fixed Boundary" : `${territoryInfo.radius}km`}
                            </span>
                        </div>
                    </>
                ) : (
                    tile && (
                        <>
                            <div className="flex justify-between">
                                <span>Type:</span> <span className="text-white">{tile.type}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Owner:</span>
                                <span className={isOwned ? "text-green-400" : "text-gray-500"}>
                                    {isOwned ? (isOwnedByMe ? 'YOU' : `User ${tile.owner_id}`) : 'None'}
                                </span>
                            </div>
                            {buildings.length > 0 && (
                                <div className="flex justify-between">
                                    <span>Buildings:</span> <span className="text-white">{buildings.length}</span>
                                </div>
                            )}
                        </>
                    )
                )}
            </div>

            {/* Actions Grid */}
            <div className="grid grid-cols-3 gap-2 mb-2">
                {onMove && tile && (
                    <button
                        onClick={() => onMove(tile.x, tile.y)}
                        className="flex flex-col items-center justify-center p-2 bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/50 rounded transition-colors"
                    >
                        <span className="text-lg mb-1">🏃</span>
                        <span className="text-[10px] font-bold text-blue-300">Move</span>
                    </button>
                )}

                {/* Only show Build if it's a TILE modal AND not a Territory Info view (or handle logic) */}
                {!territoryInfo && onBuild && (
                    <button
                        onClick={() => setShowBuildMenu(!showBuildMenu)}
                        className={`flex flex-col items-center justify-center p-2 border rounded transition-colors ${showBuildMenu ? 'bg-amber-600/40 border-amber-500' : 'bg-amber-600/20 hover:bg-amber-600/40 border-amber-500/50'}`}
                    >
                        <span className="text-lg mb-1">🏗️</span>
                        <span className="text-[10px] font-bold text-amber-300">Build</span>
                    </button>
                )}

                {/* For Territory Info, maybe specific actions? */}
            </div>

            {/* Expanded Build Menu - Only for Tile view */}
            {showBuildMenu && !territoryInfo && isOwnedByMe !== undefined && onBuild && (
                // Reuse existing logic
                (isOwnedByMe || !isOwned) && (
                    <div className="mt-3 pt-3 border-t border-gray-700">
                        <h4 className="text-[10px] font-bold text-amber-400 mb-2 flex items-center gap-1">
                            CONSTRUCTION
                        </h4>
                        <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto">
                            {!isOwned && (
                                <ConstructionButton
                                    icon="🏰"
                                    label="Base"
                                    cost="500G"
                                    onClick={() => onBuild('COMMAND_CENTER')}
                                />
                            )}
                            {isOwnedByMe && (
                                <>
                                    <ConstructionButton icon="📦" label="Storage" cost="50G" onClick={() => onBuild('WAREHOUSE')} />
                                    <ConstructionButton icon="⛏️" label="Mine" cost="100G" onClick={() => onBuild('MINE')} />
                                    <ConstructionButton icon="⚔️" label="Barracks" cost="150G" onClick={() => onBuild('BARRACKS')} />
                                    <ConstructionButton icon="🌾" label="Farm" cost="75G" onClick={() => onBuild('FARM')} />
                                    <ConstructionButton icon="🏭" label="Factory" cost="200G" onClick={() => onBuild('FACTORY')} />
                                </>
                            )}
                        </div>
                    </div>
                )
            )}
        </div>
    );
}
