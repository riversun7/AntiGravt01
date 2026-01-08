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

interface Tile {
    id: string;
    x: number;
    y: number;
    type: string;
    name: string;
    owner_id: number | null;
    faction: string | null;
}

interface TileInfoModalProps {
    tile: Tile;
    buildings: Building[];
    onClose: () => void;
    onClaim?: () => void;
    onBuild?: (buildingType: string) => void;
    onMove?: (x: number, y: number) => void; // Add move handler
    userId: number | null;
    position: { x: number; y: number }; // Screen/Container coordinates
}

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

export default function TileInfoModal({ tile, buildings, onClose, onClaim, onBuild, onMove, userId, position }: TileInfoModalProps) {
    const isOwnedByMe = String(tile.owner_id) === String(userId);
    const isOwned = !!tile.owner_id;
    const [showBuildMenu, setShowBuildMenu] = React.useState(false);

    return (
        <div
            className="absolute z-[1000] bg-slate-900/95 backdrop-blur-md border border-cyan-500/30 rounded-lg shadow-2xl p-4 w-72"
            style={{ left: position.x, top: position.y }}
            onClick={(e) => e.stopPropagation()}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-3 border-b border-gray-700 pb-2">
                <div className="flex items-center gap-2">
                    <MapPin className="text-cyan-400" size={16} />
                    <span className="font-bold text-white text-sm">{tile.name || `Sector ${tile.x}, ${tile.y}`}</span>
                </div>
                <button onClick={onClose} className="text-gray-400 hover:text-white">
                    <X size={16} />
                </button>
            </div>

            {/* Basic Info */}
            <div className="text-xs space-y-1 mb-3 text-gray-300">
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
            </div>

            {/* Actions Grid */}
            <div className="grid grid-cols-3 gap-2 mb-2">
                {onMove && (
                    <button
                        onClick={() => onMove(tile.x, tile.y)} // Pass coordinates
                        className="flex flex-col items-center justify-center p-2 bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/50 rounded transition-colors"
                    >
                        <span className="text-lg mb-1">🏃</span>
                        <span className="text-[10px] font-bold text-blue-300">Move</span>
                    </button>
                )}

                {onBuild && (
                    <button
                        onClick={() => setShowBuildMenu(!showBuildMenu)}
                        className={`flex flex-col items-center justify-center p-2 border rounded transition-colors ${showBuildMenu ? 'bg-amber-600/40 border-amber-500' : 'bg-amber-600/20 hover:bg-amber-600/40 border-amber-500/50'}`}
                    >
                        <span className="text-lg mb-1">🏗️</span>
                        <span className="text-[10px] font-bold text-amber-300">Build</span>
                    </button>
                )}

                <button
                    onClick={() => { }} // Placeholder for detailed info or just expand
                    className="flex flex-col items-center justify-center p-2 bg-slate-700/30 hover:bg-slate-700/50 border border-slate-600/50 rounded transition-colors opacity-50 cursor-not-allowed"
                >
                    <span className="text-lg mb-1">ℹ️</span>
                    <span className="text-[10px] font-bold text-slate-400">Info</span>
                </button>
            </div>

            {/* Expanded Build Menu */}
            {showBuildMenu && (isOwnedByMe || !isOwned) && onBuild && (
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
            )}
        </div>
    );
}
