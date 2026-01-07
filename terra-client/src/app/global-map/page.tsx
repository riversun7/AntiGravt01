"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import SystemMenu from "@/components/SystemMenu";
import * as d3 from 'd3';
import * as topojson from 'topojson-client';

interface GeoJSONFeature {
    type: string;
    bbox?: [[number, number], [number, number]]; // [West, South], [East, North]
    properties: {
        name: string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        [key: string]: unknown;
    };
    geometry: {
        type: string;
        coordinates: number[] | number[][] | number[][][];
    };
}

// PERFORMANCE: Using 110m resolution (Lowest standard) for maximum speed as requested
const WORLD_ATLAS_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';
const US_ATLAS_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json';

const HIGHCHARTS_CDN_BASE = 'https://code.highcharts.com/mapdata';

// EXPANDED COUNTRY LIST
const COUNTRY_SOURCES: { [key: string]: string } = {
    // Asia/Pacific
    'South Korea': `${HIGHCHARTS_CDN_BASE}/countries/kr/kr-all.topo.json`, // Added KR
    'China': `${HIGHCHARTS_CDN_BASE}/countries/cn/cn-all.topo.json`,
    'India': `${HIGHCHARTS_CDN_BASE}/countries/in/in-all.topo.json`,
    'Australia': `${HIGHCHARTS_CDN_BASE}/countries/au/au-all.topo.json`,
    'Japan': `${HIGHCHARTS_CDN_BASE}/countries/jp/jp-all.topo.json`,
    'Indonesia': `${HIGHCHARTS_CDN_BASE}/countries/id/id-all.topo.json`,
    'Kazakhstan': `${HIGHCHARTS_CDN_BASE}/countries/kz/kz-all.topo.json`,
    'Saudi Arabia': `${HIGHCHARTS_CDN_BASE}/countries/sa/sa-all.topo.json`,
    'Iran': `${HIGHCHARTS_CDN_BASE}/countries/ir/ir-all.topo.json`,
    'Turkey': `${HIGHCHARTS_CDN_BASE}/countries/tr/tr-all.topo.json`,
    'Thailand': `${HIGHCHARTS_CDN_BASE}/countries/th/th-all.topo.json`,
    'Vietnam': `${HIGHCHARTS_CDN_BASE}/countries/vn/vn-all.topo.json`,

    // Americas
    'Canada': `${HIGHCHARTS_CDN_BASE}/countries/ca/ca-all.topo.json`,
    'Brazil': `${HIGHCHARTS_CDN_BASE}/countries/br/br-all.topo.json`,
    'Argentina': `${HIGHCHARTS_CDN_BASE}/countries/ar/ar-all.topo.json`,
    'Mexico': `${HIGHCHARTS_CDN_BASE}/countries/mx/mx-all.topo.json`,
    'Colombia': `${HIGHCHARTS_CDN_BASE}/countries/co/co-all.topo.json`,
    'Peru': `${HIGHCHARTS_CDN_BASE}/countries/pe/pe-all.topo.json`,
    'Chile': `${HIGHCHARTS_CDN_BASE}/countries/cl/cl-all.topo.json`,

    // Europe
    'Russia': `${HIGHCHARTS_CDN_BASE}/countries/ru/ru-all.topo.json`,
    'France': `${HIGHCHARTS_CDN_BASE}/countries/fr/fr-all.topo.json`,
    'Germany': `${HIGHCHARTS_CDN_BASE}/countries/de/de-all.topo.json`,
    'United Kingdom': `${HIGHCHARTS_CDN_BASE}/countries/gb/gb-all.topo.json`,
    'Italy': `${HIGHCHARTS_CDN_BASE}/countries/it/it-all.topo.json`,
    'Spain': `${HIGHCHARTS_CDN_BASE}/countries/es/es-all.topo.json`,
    'Poland': `${HIGHCHARTS_CDN_BASE}/countries/pl/pl-all.topo.json`,
    'Ukraine': `${HIGHCHARTS_CDN_BASE}/countries/ua/ua-all.topo.json`,
    'Netherlands': `${HIGHCHARTS_CDN_BASE}/countries/nl/nl-all.topo.json`,
    'Sweden': `${HIGHCHARTS_CDN_BASE}/countries/se/se-all.topo.json`,
    'Norway': `${HIGHCHARTS_CDN_BASE}/countries/no/no-all.topo.json`,

    // Africa
    'Algeria': `${HIGHCHARTS_CDN_BASE}/countries/dz/dz-all.topo.json`,
    'Egypt': `${HIGHCHARTS_CDN_BASE}/countries/eg/eg-all.topo.json`,
    'Nigeria': `${HIGHCHARTS_CDN_BASE}/countries/ng/ng-all.topo.json`,
    'South Africa': `${HIGHCHARTS_CDN_BASE}/countries/za/za-all.topo.json`
};

// Korean Province Name Lookup (HASC code -> English Name)
const KOREAN_PROVINCE_NAMES: { [key: string]: string } = {
    'CB': 'North Chungcheong',
    'CN': 'South Chungcheong',
    'GB': 'Gangwon',
    'GN': 'North Gyeongsang',
    'GS': ' South Gyeongsang',
    'GW': 'Gwangju',
    'JB': 'North Jeolla',
    'JN': 'South Jeolla',
    'KG': 'Gyeonggi',
    'KW': 'Gangwon-do',
    'SO': 'Seoul',
    'BS': 'Busan',
    'DG': 'Daegu',
    'DJ': 'Daejeon',
    'IC': 'Incheon',
    'UL': 'Ulsan',
    'SJ': 'Sejong'
};


export default function GlobalMapPage() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Refs for Rendering
    const transformRef = useRef(d3.zoomIdentity);
    const dimensionsRef = useRef({ width: 800, height: 600 });

    // Data State
    const [worldData, setWorldData] = useState<any>(null);
    const [usData, setUsData] = useState<any>(null);
    const [countrySubdivisions, setCountrySubdivisions] = useState<Map<string, GeoJSONFeature[]>>(new Map());

    // Interaction State
    const [selectedRegion, setSelectedRegion] = useState<{ name: string, country?: string } | null>(null);

    // Pre-calculate Bounding Boxes
    const preCalculateBounds = (features: GeoJSONFeature[]) => {
        features.forEach(f => {
            if (!f.bbox) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                f.bbox = d3.geoBounds(f as any);
            }
        });
        return features;
    };

    // 1. Init Dimensions
    useEffect(() => {
        const updateDimensions = () => {
            if (containerRef.current) {
                dimensionsRef.current = {
                    width: containerRef.current.clientWidth,
                    height: containerRef.current.clientHeight
                };
                if (canvasRef.current) {
                    const dpr = 1;
                    canvasRef.current.width = dimensionsRef.current.width * dpr;
                    canvasRef.current.height = dimensionsRef.current.height * dpr;
                    canvasRef.current.style.width = `${dimensionsRef.current.width}px`;
                    canvasRef.current.style.height = `${dimensionsRef.current.height}px`;
                }
            }
        };
        window.addEventListener('resize', updateDimensions);
        updateDimensions();
        return () => window.removeEventListener('resize', updateDimensions);
    }, []);

    // 2. Fetch Data
    useEffect(() => {
        Promise.all([
            fetch(WORLD_ATLAS_URL).then(r => r.json()),
            fetch(US_ATLAS_URL).then(r => r.json())
        ]).then(([world, us]) => {
            setWorldData(world);
            setUsData(us);
        }).catch(err => console.error("Base Data fetch error:", err));

        const subdivisionMap = new Map<string, GeoJSONFeature[]>();
        const fetchPromises = Object.entries(COUNTRY_SOURCES).map(async ([name, url]) => {
            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error(`Failed to fetch ${name}`);
                const topo = await response.json();
                const objectKey = Object.keys(topo.objects).find(k => k !== 'copyright');
                if (objectKey) {
                    const features = (topojson.feature(topo, topo.objects[objectKey]) as any).features;
                    subdivisionMap.set(name, preCalculateBounds(features));
                }
            } catch (e) {
                console.warn(`Failed to load subdivisions for ${name}`, e);
            }
        });
        Promise.all(fetchPromises).then(() => {
            setCountrySubdivisions(new Map(subdivisionMap));
        });
    }, []);

    // 3. Process Features
    const features = useMemo(() => {
        if (!worldData) return [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const countries = topojson.feature(worldData, worldData.objects.countries) as any;
        return preCalculateBounds(countries.features as GeoJSONFeature[]);
    }, [worldData]);

    const usFeatures = useMemo(() => {
        if (!usData) return [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const f = (topojson.feature(usData, usData.objects.states) as any).features as GeoJSONFeature[];
        return preCalculateBounds(f);
    }, [usData]);

    // 4. Hit Testing & Click Handler
    const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Current Projection State
        const width = dimensionsRef.current.width;
        const height = dimensionsRef.current.height;
        const t = transformRef.current;
        const k = t.k;

        const projection = d3.geoMercator()
            .scale(width / 6.5)
            .translate([width / 2, height / 1.5]);

        // Invert to Geo Coordinates
        // [screenX, screenY] -> [transform-less X, Y] -> [Lon, Lat]
        const tx = (x - t.x) / k;
        const ty = (y - t.y) / k;

        const geoPoint = projection.invert?.([tx, ty]);
        if (!geoPoint) return;

        // Search for containment
        let found: { name: string, country?: string } | null = null;

        // Check Subdivisions first (Priority) if zoomed in
        if (k > 6) {
            // US
            for (const f of usFeatures) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                if (d3.geoContains(f as any, geoPoint)) {
                    found = { name: f.properties.name, country: 'United States' };
                    break;
                }
            }

            // Other Countries
            if (!found) {
                for (const [countryName, feats] of countrySubdivisions.entries()) {
                    for (const f of feats) {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        if (d3.geoContains(f as any, geoPoint)) {
                            // DEBUG: Log actual properties to identify correct field
                            console.log(`Clicked ${countryName}:`, f.properties);

                            // Extract region name - Highcharts uses different properties per country
                            let regionName: string;

                            // Try standard name properties first
                            if (typeof f.properties['name'] === 'string') {
                                regionName = f.properties['name'];
                            } else if (typeof f.properties['NAME_1'] === 'string') {
                                regionName = f.properties['NAME_1'];
                            } else if (typeof f.properties['NAME'] === 'string') {
                                regionName = f.properties['NAME'];
                            } else if (typeof f.properties['hc-key'] === 'string') {
                                // For countries like South Korea that only have hc-key
                                // Use HASC or hc-a2 as fallback for display
                                const hasc = f.properties['hasc'] as string | undefined; // e.g., "KR.GB"
                                const hcA2 = f.properties['hc-a2'] as string | undefined; // e.g., "GB"

                                // Extract last part of HASC as region code
                                if (hasc && hasc.includes('.')) {
                                    const code = hasc.split('.')[1];
                                    // Use lookup table for Korean provinces
                                    if (countryName === 'South Korea' && KOREAN_PROVINCE_NAMES[code]) {
                                        regionName = KOREAN_PROVINCE_NAMES[code];
                                    } else {
                                        regionName = code; // Fallback to code
                                    }
                                } else if (hcA2) {
                                    // Try lookup for Korea
                                    if (countryName === 'South Korea' && KOREAN_PROVINCE_NAMES[hcA2]) {
                                        regionName = KOREAN_PROVINCE_NAMES[hcA2];
                                    } else {
                                        regionName = hcA2;
                                    }
                                } else {
                                    regionName = f.properties['hc-key'] as string || "Unknown Region";
                                }
                            } else {
                                regionName = "Unknown Region";
                            }

                            found = { name: regionName, country: countryName };
                            break;
                        }
                    }
                    if (found) break;
                }
            }
        }

        // Fallback to Base Countries
        if (!found) {
            for (const f of features) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                if (d3.geoContains(f as any, geoPoint)) {
                    found = { name: f.properties.name };
                    break;
                }
            }
        }

        setSelectedRegion(found);
    };

    // 5. Main Render & Zoom Logic (Combined)
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const width = dimensionsRef.current.width;
        const height = dimensionsRef.current.height;

        const projection = d3.geoMercator()
            .scale(width / 6.5)
            .translate([width / 2, height / 1.5]);

        const pathGenerator = d3.geoPath().projection(projection).context(ctx);

        let animationFrameId: number;
        let lastFrameTime = 0;
        const TARGET_FPS = 30; // Limit FPS
        const FRAME_INTERVAL = 1000 / TARGET_FPS;

        const render = (time: number) => {
            animationFrameId = requestAnimationFrame(render);

            const delta = time - lastFrameTime;
            if (delta < FRAME_INTERVAL) return;
            lastFrameTime = time - (delta % FRAME_INTERVAL);

            const t = transformRef.current;
            const dpr = 1;
            const k = t.k;
            const showDetails = k > 6;

            ctx.save();
            ctx.clearRect(0, 0, width * dpr, height * dpr);
            ctx.scale(dpr, dpr);
            ctx.translate(t.x, t.y);
            ctx.scale(k, k);
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';

            // Calculate Visible Bounds
            let vGeoBounds: [[number, number], [number, number]] | null = null;
            if (showDetails) {
                try {
                    const tl = projection.invert?.([(0 - t.x) / k, (0 - t.y) / k]);
                    const br = projection.invert?.([(width - t.x) / k, (height - t.y) / k]);
                    if (tl && br) vGeoBounds = [tl, br];
                } catch (e) { /* ignore */ }
            }

            const isVisible = (f: GeoJSONFeature) => {
                if (!vGeoBounds || !f.bbox) return true;
                const [fw, fs] = f.bbox[0];
                const [fe, fn] = f.bbox[1];
                const [vw, vn] = vGeoBounds[0];
                const [ve, vs] = vGeoBounds[1];
                if (fn < vs || fs > vn) return false;
                if (fw > fe) return (fw <= ve) || (fe >= vw);
                return !(fe < vw || fw > ve);
            };

            // A. Base World
            ctx.beginPath();
            features.forEach(f => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                pathGenerator(f as any);
            });
            ctx.fillStyle = 'transparent';
            ctx.fill();
            ctx.strokeStyle = 'rgba(0, 255, 255, 0.4)';
            ctx.lineWidth = 1.0 / k;
            ctx.stroke();

            // B. Subdivisions
            if (showDetails) {
                const drawFeatures = (list: GeoJSONFeature[], stroke: string, countryName?: string) => {
                    ctx.beginPath();
                    let hasVisible = false;
                    list.forEach(f => {
                        if (isVisible(f)) {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            pathGenerator(f as any);
                            hasVisible = true;
                        }
                    });
                    if (hasVisible) {
                        ctx.fillStyle = 'transparent';
                        ctx.fill();
                        ctx.strokeStyle = stroke;
                        ctx.lineWidth = 1.0 / k;
                        ctx.stroke();
                    }
                };

                const subStroke = 'rgba(0, 240, 255, 0.6)';

                if (usFeatures.length) drawFeatures(usFeatures, subStroke);
                countrySubdivisions.forEach((list, name) => {
                    // Slight highlight for KR if desired, otherwise same API
                    if (name === 'South Korea') {
                        drawFeatures(list, 'rgba(0, 255, 100, 0.8)', name);
                    } else {
                        drawFeatures(list, subStroke, name);
                    }
                });
            }

            // C. Highlight Selected Interaction
            if (selectedRegion && selectedRegion.name) {
                // Find and draw it
                // We'd need to search for it again or store geometry. 
                // For perf, just let the overlay UI handle it, or we can iterate features here.
                // Doing simple overlay UI is better to avoid 60fps search loop.
            }

            ctx.restore();
        };

        const selection = d3.select(canvas);
        const zoom = d3.zoom()
            .scaleExtent([1, 200])
            .translateExtent([[-5000, -5000], [width + 5000, height + 5000]])
            .on("zoom", (e) => {
                transformRef.current = e.transform;
            });

        selection.call(zoom as any);

        if (transformRef.current === d3.zoomIdentity) {
            const initialScale = 30;
            const [x, y] = projection([127.8, 36.5]) || [0, 0];
            const t = d3.zoomIdentity.translate(width / 2, height / 2).scale(initialScale).translate(-x, -y);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            selection.call(zoom.transform as any, t);
            transformRef.current = t;
        }

        animationFrameId = requestAnimationFrame(render);
        return () => {
            selection.on(".zoom", null);
            cancelAnimationFrame(animationFrameId);
        };

    }, [features, usFeatures, countrySubdivisions, selectedRegion]); // Added selectedRegion to dep array if needed, though unused in render for now

    const handleMouseMove = () => { };

    return (
        <div className="min-h-screen bg-background text-white p-4 overflow-hidden">
            <header className="flex items-center justify-between mb-4 pb-2 border-b border-surface-border">
                <div className="flex items-center gap-4">
                    <SystemMenu activePage="global-map" />
                    <div>
                        <h1 className="text-xl font-bold flex items-center gap-2 text-cyan-400">
                            🗺️ GLOBAL STRATEGY MAP
                        </h1>
                        <p className="text-xs text-gray-500 font-mono">
                            D3 // 30FPS // INTERACTIVE // KR_DATA
                        </p>
                    </div>
                </div>
            </header>

            <div ref={containerRef} className="map-container h-[calc(100vh-120px)] overflow-hidden relative bg-slate-950 rounded-lg border border-surface-border">
                <div className="absolute inset-0 pointer-events-none"
                    style={{
                        zIndex: 0,
                        opacity: 0.3,
                        backgroundImage: 'linear-gradient(rgba(0, 255, 255, 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 255, 255, 0.3) 1px, transparent 1px)',
                        backgroundSize: '40px 40px'
                    }}
                />

                <canvas
                    ref={canvasRef}
                    onClick={handleCanvasClick}
                    onMouseMove={handleMouseMove}
                    className="cursor-pointer block relative z-10"
                    style={{ background: 'transparent' }}
                />

                <div className="absolute bottom-4 left-4 text-gray-500 text-xs font-mono pointer-events-none z-20">
                    CLICK REGIONS FOR INFO
                </div>

                {/* INFO OVERLAY */}
                {selectedRegion && (
                    <div className="absolute top-4 right-4 bg-slate-900/90 border border-cyan-500 p-4 rounded shadow-lg backdrop-blur z-30 min-w-[200px]">
                        <h2 className="text-cyan-400 text-sm font-bold uppercase tracking-wider mb-1">Target Selected</h2>
                        <div className="text-2xl font-bold text-white mb-1">{selectedRegion.name}</div>
                        {selectedRegion.country && (
                            <div className="text-xs text-slate-400 font-mono">{selectedRegion.country.toUpperCase()}</div>
                        )}
                        <div className="h-px bg-cyan-900/50 my-2" />
                        <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                            <div>STATUS:</div><div className="text-right text-green-400">SECURE</div>
                            <div>POPULATION:</div><div className="text-right">--</div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
