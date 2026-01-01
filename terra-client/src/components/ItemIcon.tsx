import React from 'react';
import {
    Sword, Shield, Zap, Crosshair, Eye, Brain, Scan,
    ChevronsRight, MousePointer2, Ghost, Activity,
    Cpu, Battery, Box, Pickaxe, Cloud, Utensils,
    Component, HardHat, Shirt, Footprints, Flame,
    Sun, Radiation, Skull, Scissors, BicepsFlexed,
    Hammer, Hexagon, CircleDot
} from 'lucide-react';

interface ItemIconProps {
    item: {
        code: string;
        name: string;
        type?: 'RESOURCE' | 'EQUIPMENT' | string;
    };
    size?: "sm" | "md" | "lg" | "xl";
    className?: string;
}

const ICON_MAP: Record<string, any> = {
    // Weapons
    'LASER_RIFLE': Crosshair,
    'RAILGUN_PROTO': ChevronsRight,
    'SHOCK_BATON': Zap,
    'PLASMA_CUTTER': Scissors,
    'NANO_SWARM': Skull,

    // Armor
    'TITANIUM_HELM': HardHat,
    'TITANIUM_PLATE': Shield,
    'CARBON_VEST': Shirt,
    'REACTIVE_ARMOR': Shield,
    'STEALTH_SUIT': Ghost,

    // Cybernetics
    'CYBER_EYE': Eye,
    'CYBER_EYE_1': Eye,
    'TAC_VISOR': Scan,
    'NEURAL_LINK': Brain,

    // Limbs
    'HYDRA_ARMS': BicepsFlexed,
    'POWER_GAUNTLET': Hammer,
    'SERVO_LEGS': Footprints,
    'JUMP_JETS': Activity,
    'MAG_BOOTS': MousePointer2,
    'SPRINT_PISTONS': ChevronsRight,

    // Core
    'FUSION_CORE': Battery,
    'ANTIMATTER_CELL': Radiation,
    'SOLAR_CONV': Sun,
    'OC_MODULE': Flame,

    // Resources
    'ORE': Pickaxe,
    'GAS': Cloud,
    'FOOD': Utensils,
    'CYBORG_PART': Component,
    'WHEAT': Utensils,
    'IRON': Box,
    'GOLD': Box
};

export default function ItemIcon({ item, size = "md", className = "" }: ItemIconProps) {
    const sizeClasses = {
        sm: "w-8 h-8 p-1.5",
        md: "w-12 h-12 p-2.5",
        lg: "w-24 h-24 p-6",
        xl: "w-32 h-32 p-8"
    };

    const iconSizeClasses = {
        sm: 16,
        md: 24,
        lg: 48,
        xl: 64
    };

    if (!item) return <div className={`${sizeClasses[size]} bg-slate-800 ${className}`} />;

    // Safety check for code
    const itemCode = item.code || 'UNKNOWN';

    // Find icon
    let IconComponent = ICON_MAP[itemCode];

    // Fallback based on partial match or type
    if (!IconComponent) {
        if (itemCode.includes('ORE')) IconComponent = Pickaxe;
        else if (itemCode.includes('GAS')) IconComponent = Cloud;
        else if (item.type === 'EQUIPMENT') IconComponent = Cpu;
        else if (item.type === 'RESOURCE') IconComponent = Box;
        else IconComponent = CircleDot;
    }

    const isEquipment = ('type' in item) ? item.type === 'EQUIPMENT' : true;

    // Dynamic Colors based on Item Type/Code could be added here
    const iconColor = isEquipment ? "text-cyan-400" : "text-emerald-400";
    const bg = isEquipment ? 'bg-slate-900' : 'bg-slate-950';

    return (
        <div className={`${sizeClasses[size]} ${bg} flex items-center justify-center flex-shrink-0 border border-white/10 rounded ${className}`}>
            <IconComponent
                size={iconSizeClasses[size]}
                className={`${iconColor} drop-shadow-[0_0_8px_rgba(34,211,238,0.3)]`}
                strokeWidth={1.5}
            />
        </div>
    )
}
