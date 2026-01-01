import { useState, useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';

// TopoJSON 데이터 소스 URL (전 세계 국가 경계 데이터 - 110m 해상도)
// CDN을 통해 topojson 형식의 지도 데이터를 가져옵니다.
const WORLD_ATLAS_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

const GlobalMap = () => {
    // [STATE] 지도에 그릴 지리 데이터(GeoJSON feature들의 배열)를 저장합니다.
    const [geographies, setGeographies] = useState([]);

    // [STATE] 줌/팬 상태를 저장합니다. d3.zoomIdentity는 초기 상태(x=0, y=0, k=1)를 의미합니다.
    const [transform, setTransform] = useState(d3.zoomIdentity);

    // [REF] SVG 요소에 직접 접근하기 위한 Ref입니다. D3가 이 요소를 제어합니다.
    const svgRef = useRef(null);

    // [REF] 부모 컨테이너의 크기를 측정하기 위한 Ref입니다.
    const containerRef = useRef(null);

    // [STATE] 지도가 그려질 영역의 크기입니다. 반응형 처리를 위해 상태로 관리합니다.
    const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

    // [STATE] 마우스 오버 시 정보를 보여줄 툴팁의 상태입니다.
    const [tooltip, setTooltip] = useState({ show: false, x: 0, y: 0, content: '' });

    // [EFFECT] 창 크기 변경 감지 및 반응형 크기 업데이트
    useEffect(() => {
        const updateDimensions = () => {
            if (containerRef.current) {
                // 컨테이너의 실제 크기를 측정하여 상태를 업데이트합니다.
                setDimensions({
                    width: containerRef.current.clientWidth,
                    height: containerRef.current.clientHeight
                });
            }
        };

        // 리사이즈 이벤트 리스너 등록
        window.addEventListener('resize', updateDimensions);
        // 초기 로드 시 한 번 실행
        updateDimensions();

        // 컴포넌트 언마운트 시 리스너 제거 (Clean-up)
        return () => window.removeEventListener('resize', updateDimensions);
    }, []);

    // [EFFECT] 지도 데이터 페치 (비동기 데이터 로딩)
    useEffect(() => {
        fetch(WORLD_ATLAS_URL)
            .then(response => response.json())
            .then(worldData => {
                // 받아온 TopoJSON 데이터를 D3에서 사용할 수 있는 GeoJSON 형식으로 변환합니다.
                // topojson.feature(topology, object) 함수가 이 변환을 수행합니다.
                const countries = topojson.feature(worldData, worldData.objects.countries);
                // 변환된 GeoJSON의 features(각 국가의 다각형 정보)를 상태에 저장합니다.
                setGeographies(countries.features);
            })
            .catch(err => console.error("Error fetching world atlas data:", err));
    }, []);

    // [MEMO] 지도 투영법(Projection) 설정
    // 3차원 지구를 2차원 화면에 그리는 수학적 방법을 정의합니다.
    // 여기서는 가장 일반적인 '메르카토르 도법(d3.geoMercator)'을 사용합니다.
    const projection = useMemo(() =>
        d3.geoMercator()
            .scale(dimensions.width / 6.5) // 지도의 확대 배율을 화면 너비에 맞춰 조절합니다.
            .translate([dimensions.width / 2, dimensions.height / 1.5]) // 지도의 중심점을 화면 중앙으로 이동시킵니다.
        , [dimensions]); // dimensions가 변경될 때만 투영법을 재계산합니다.

    // [MEMO] 경로 생성기(Path Generator) 생성
    // 설정된 투영법(projection)을 사용하여 GeoJSON 좌표를 <svg path>의 'd' 속성 문자열로 변환하는 함수입니다.
    const pathGenerator = useMemo(() => d3.geoPath().projection(projection), [projection]);

    // [EFFECT] 줌(Zoom) & 팬(Pan) 기능 설정
    useEffect(() => {
        if (!svgRef.current) return;

        // D3를 사용하여 SVG 요소를 선택합니다.
        const svg = d3.select(svgRef.current);

        // 줌 동작을 정의합니다.
        const zoomBehavior = d3.zoom()
            .scaleExtent([0.8, 12]) // 줌의 최소(0.8배) 및 최대(12배) 범위를 제한합니다.
            .translateExtent([[0, 0], [dimensions.width, dimensions.height]]) // 팬 이동 범위를 제한합니다.
            .on('zoom', (event) => {
                // 줌 이벤트 발생 시, 변경된 상세 변환 정보(transform)를 상태에 업데이트합니다.
                // 이 상태가 변경되면 컴포넌트가 리렌더링되어 <g> 태그의 transform 속성이 바뀝니다.
                setTransform(event.transform);
            });

        // SVG 요소에 줌 동작을 바인딩합니다.
        svg.call(zoomBehavior);

        // Clean-up: 줌 리스너 제거
        return () => {
            svg.on('.zoom', null);
        };
    }, [dimensions]); // 크기가 변경되면 줌 설정(이동 범위 등)도 다시 해야 합니다.

    // [HANDLER] 마우스 이동 핸들러 (툴팁 위치 및 내용 업데이트)
    const handleMouseMove = (event, geo) => {
        // TopoJSON 데이터에 포함된 국가 이름 속성을 가져옵니다. 없을 경우 기본값을 사용합니다.
        const countryName = geo.properties?.name || 'Unknown Sector';
        setTooltip({
            show: true,
            x: event.clientX + 15, // 마우스 포인터보다 약간 오른쪽으로 이동
            y: event.clientY,
            content: countryName   // 툴팁에 표시할 텍스트
        });
    };

    // [HANDLER] 마우스 이탈 핸들러 (툴팁 숨기기)
    const handleMouseLeave = () => {
        setTooltip(prev => ({ ...prev, show: false }));
    };

    return (
        // 전체 컨테이너
        <div ref={containerRef} className="map-container" style={{ padding: 0, overflow: 'hidden', position: 'relative', background: 'rgba(11, 16, 27, 0.9)' }}>

            {/* SVG 캔버스 */}
            <svg ref={svgRef} width="100%" height="100%">
                {/* 
                    줌/팬 변환 그룹 (<g>)
                    D3 zoom 이벤트로 업데이트된 transform 상태값(이동 x, y, 확대 k)을 여기에 적용합니다.
                    따라서 이 그룹 내부의 모든 요소(지도 경로들)가 함께 이동하고 확대/축소됩니다.
                */}
                <g transform={transform.toString()}>
                    {/* 각 국가별 경로(Path) 렌더링 */}
                    {geographies.map((geo, i) => (
                        <path
                            key={geo.properties?.name + i} // 리액트 최적화를 위한 고유 키
                            d={pathGenerator(geo) || ''}   // GeoJSON -> SVG Path 문자열 변환
                            style={{
                                fill: 'rgba(30, 40, 55, 1)',      // 기본 색상 (어두운 남색)
                                stroke: 'rgba(0, 240, 255, 0.2)', // 경계선 색상 (네온 블루)
                                strokeWidth: 0.5,                 // 경계선 두께
                                transition: 'fill 0.2s ease',     // 색상 변경 애니메이션
                                cursor: 'pointer'
                            }}
                            // 마우스 오버 시 하이라이트 효과 (직접 스타일 조작으로 성능 최적화)
                            onMouseEnter={(e) => {
                                e.target.style.fill = 'rgba(0, 240, 255, 0.2)';
                            }}
                            // 마우스 아웃 시 원래 색상 복귀 및 툴팁 끄기
                            onMouseLeave={(e) => {
                                e.target.style.fill = 'rgba(30, 40, 55, 1)';
                                handleMouseLeave();
                            }}
                            // 마우스 이동 시 툴팁 위치 업데이트
                            onMouseMove={(e) => handleMouseMove(e, geo)}
                        />
                    ))}
                </g>
            </svg>

            {/* 커스텀 툴팁 UI (조건부 렌더링) */}
            {tooltip.show && (
                <div style={{
                    position: 'fixed', // 화면 기준 절대 위치
                    left: tooltip.x,
                    top: tooltip.y,
                    background: 'rgba(0, 0, 0, 0.8)',
                    border: '1px solid var(--accent-primary)',
                    padding: '0.5rem 1rem',
                    color: 'var(--text-primary)',
                    borderRadius: '4px',
                    pointerEvents: 'none', // 마우스 이벤트가 툴팁에 막히지 않도록 통과시킴
                    zIndex: 1000,
                    fontSize: '0.9rem',
                    backdropFilter: 'blur(4px)'
                }}>
                    {tooltip.content}
                </div>
            )}

            {/* 장식용 텍스트 오버레이 */}
            <div style={{ position: 'absolute', bottom: 20, left: 20, pointerEvents: 'none', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                GLOBAL SAT_LINK ACTIVE // D3_MERCATOR_PROJECTION
            </div>
        </div>
    );
};

export default GlobalMap;
