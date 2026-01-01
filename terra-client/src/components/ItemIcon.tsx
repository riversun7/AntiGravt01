import React from 'react';

interface ItemIconProps {
    item: {
        code: string;
        name: string;
        type?: 'RESOURCE' | 'EQUIPMENT' | string;
    };
    size?: "sm" | "md" | "lg" | "xl";
    className?: string;
}

export default function ItemIcon({ item, size = "md", className = "" }: ItemIconProps) {
    const sizeClasses = {
        sm: "w-8 h-8",
        md: "w-12 h-12",
        lg: "w-24 h-24",
        xl: "w-32 h-32"
    };

    if (!item) return <div className={`${sizeClasses[size]} bg-slate-800 ${className}`} />;

    // Safety check for code
    const itemCode = item.code || 'UNKNOWN';

    // Use DiceBear Shapes/Icons as abstract representations
    // 'shapes' style is good for abstract tech items
    const style = itemCode.includes('ORE') || itemCode.includes('WHEAT') ? 'icons' : 'shapes';
    const isEquipment = ('type' in item) ? item.type === 'EQUIPMENT' : true;
    const bg = isEquipment ? 'bg-slate-800' : 'bg-slate-900';

    return (
        <div className={`${sizeClasses[size]} ${bg} flex-shrink-0 overflow-hidden border border-white/5 ${className}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={`https://api.dicebear.com/9.x/${style}/svg?seed=${itemCode}&backgroundColor=transparent`}
                alt={item.name || 'Item'}
                className="w-full h-full object-cover opacity-80"
            />
        </div>
    )
}
