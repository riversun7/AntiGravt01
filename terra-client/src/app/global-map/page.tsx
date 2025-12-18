"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, useMemo } from "react";
import { ArrowLeft } from "lucide-react";
import * as d3 from 'd3';
import * as topojson from 'topojson-client';

const WORLD_ATLAS_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

export default function GlobalMapPage() {
    const router = useRouter();
    const [geographies, setGeographies] = useState([]);
    const [transform, setTransform] = useState(d3.zoomIdentity);
    const svgRef = useRef(null);
    const containerRef = useRef(null);
    const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
    const [tooltip, setTooltip] = useState({ show: false, x: 0, y: 0, content: '' });

    useEffect(() => {
        const updateDimensions = () => {
            if (containerRef.current) {
                setDimensions({
                    width: containerRef.current.clientWidth,
                    height: containerRef.current.clientHeight
                });
            }
        };

        window.addEventListener('resize', updateDimensions);
        updateDimensions();

        return () => window.removeEventListener('resize', updateDimensions);
    }, []);

    useEffect(() => {
        fetch(WORLD_ATLAS_URL)
            .then(response => response.json())
            .then(worldData => {
                const countries = topojson.feature(worldData, worldData.objects.countries);
                setGeographies(countries.features);
            })
            .catch(err => console.error("Error fetching world atlas data:", err));
    }, []);

    const projection = useMemo(() =>
        d3.geoMercator()
            .scale(dimensions.width / 6.5)
            .translate([dimensions.width / 2, dimensions.height / 1.5])
        , [dimensions]);

    const pathGenerator = useMemo(() => d3.geoPath().projection(projection), [projection]);

    useEffect(() => {
        if (!svgRef.current) return;

        const svg = d3.select(svgRef.current);

        const zoomBehavior = d3.zoom()
            .scaleExtent([0.8, 12])
            .translateExtent([[0, 0], [dimensions.width, dimensions.height]])
            .on('zoom', (event) => {
                setTransform(event.transform);
            });

        svg.call(zoomBehavior);

        return () => {
            svg.on('.zoom', null);
        };
    }, [dimensions]);

    const handleMouseMove = (event, geo) => {
        const countryName = geo.properties?.name || 'Unknown Sector';
        setTooltip({
            show: true,
            x: event.clientX + 15,
            y: event.clientY,
            content: countryName
        });
    };

    const handleMouseLeave = () => {
        setTooltip(prev => ({ ...prev, show: false }));
    };

    return (
        <div className="min-h-screen bg-background text-white p-4 overflow-hidden">
            <header className="flex items-center justify-between mb-4 pb-2 border-b border-surface-border">
                <div className="flex items-center gap-4">
                    <button onClick={() => router.push("/dashboard")} className="p-2 hover:bg-surface-light rounded-full text-gray-400 hover:text-white">
                        <ArrowLeft size={24} />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold flex items-center gap-2 text-cyan-400">
                            🗺️ GLOBAL MAP (D3)
                        </h1>
                        <p className="text-xs text-gray-500 font-mono">D3 MERCATOR PROJECTION // WORLD ATLAS</p>
                    </div>
                </div>
            </header>

            <div ref={containerRef} className="map-container h-[calc(100vh-120px)] overflow-hidden relative bg-slate-950 rounded-lg border border-surface-border">
                <svg ref={svgRef} width="100%" height="100%">
                    <g transform={transform.toString()}>
                        {geographies.map((geo, i) => (
                            <path
                                key={geo.properties?.name + i}
                                d={pathGenerator(geo) || ''}
                                style={{
                                    fill: 'rgba(30, 40, 55, 1)',
                                    stroke: 'rgba(0, 240, 255, 0.2)',
                                    strokeWidth: 0.5,
                                    transition: 'fill 0.2s ease',
                                    cursor: 'pointer'
                                }}
                                onMouseEnter={(e) => {
                                    e.target.style.fill = 'rgba(0, 240, 255, 0.2)';
                                }}
                                onMouseLeave={(e) => {
                                    e.target.style.fill = 'rgba(30, 40, 55, 1)';
                                    handleMouseLeave();
                                }}
                                onMouseMove={(e) => handleMouseMove(e, geo)}
                            />
                        ))}
                    </g>
                </svg>

                {tooltip.show && (
                    <div style={{
                        position: 'fixed',
                        left: tooltip.x,
                        top: tooltip.y,
                        background: 'rgba(0, 0, 0, 0.8)',
                        border: '1px solid cyan',
                        padding: '0.5rem 1rem',
                        color: 'white',
                        borderRadius: '4px',
                        pointerEvents: 'none',
                        zIndex: 1000,
                        fontSize: '0.9rem',
                        backdropFilter: 'blur(4px)'
                    }}>
                        {tooltip.content}
                    </div>
                )}

                <div className="absolute bottom-4 left-4 text-gray-500 text-xs font-mono pointer-events-none">
                    GLOBAL SAT_LINK ACTIVE // D3_MERCATOR_PROJECTION
                </div>
            </div>
        </div>
    );
}
