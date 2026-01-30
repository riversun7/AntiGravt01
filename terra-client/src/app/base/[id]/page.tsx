"use client";

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import InternalBaseMap from '@/components/map/InternalBaseMap';

export default function BasePage() {
    const params = useParams();
    const router = useRouter();
    const id = params?.id ? Number(params.id) : null;
    const [mounted, setMounted] = useState(false);

    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        setMounted(true);
        // Temporary: Check if user 1 is admin (for single player dev)
        fetch('/api/user/1')
            .then(res => res.json())
            .then(data => {
                if (data.role === 'admin') setIsAdmin(true);
            })
            .catch(err => console.error(err));
    }, []);

    if (!mounted) return null;
    if (!id) return <div className="p-10 text-white">Invalid Base ID</div>;

    return (
        <div className="w-full h-screen bg-black">
            <InternalBaseMap
                userBuildingId={id}
                onClose={() => router.push('/terrain-map')}
                isAdmin={isAdmin}
            />
        </div>
    );
}
