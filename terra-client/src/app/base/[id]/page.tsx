"use client";

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import InternalBaseMap from '@/components/map/InternalBaseMap';

export default function BasePage() {
    const params = useParams();
    const router = useRouter();
    const id = params?.id ? Number(params.id) : null;
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return null;
    if (!id) return <div className="p-10 text-white">Invalid Base ID</div>;

    return (
        <div className="w-full h-screen bg-black">
            <InternalBaseMap
                userBuildingId={id}
                onClose={() => router.push('/terrain-map')}
            />
        </div>
    );
}
