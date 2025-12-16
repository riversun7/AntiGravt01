Researching Map Technologies & Data Sources
Researched data sources for D3 (Natural Earth), Leaflet (OSM/Mapbox), and Three.js (NASA Blue Marble). Documented findings in 

docs/MapTech_Research.md
.

Files Edited
Task

MapTech_Research.md
Progress Updates
1
Analyzing map data sources and capabilities for Global, Terrain, and 3D World maps

2
Documenting research findings on map data sources and implementation techniques in docs/MapTech_Research.md

3
Completed research on map data sources. Notifying user with findings in docs/MapTech_Research.md

요청하신 3가지 맵 기술(Global, Terrain, World)에 대한 데이터 소스와 확장 가능성을 분석하여 docs/MapTech_Research.md 문서로 정리했습니다.

연구 결과 요약:

Global Map (D3): Natural Earth Data가 가장 추천되는 고해상도(10m급) 무료 소스입니다.
Terrain Map (Leaflet): OpenStreetMap이나 Mapbox가 원천입니다. 커스텀 맵은 QGIS/TileMill로 제작 가능하지만 정적 이미지 생성 비용이 큽니다.
World Map (Three.js): NASA Blue Marble 텍스처를 입히거나, three-geo 라이브러리로 위성 타일을 3D 구체에 맵핑하면 구글 어스급 디테일 구현이 가능합니다.
이 중에서 먼저 구현해보고 싶은 기능이 있으신가요? (예: 3D 지구본에 NASA 텍스처 입히기 등) 말씀해주시면 바로 진행하겠습니다.


MapTech_Research.md

# 맵 기술 심층 분석 및 데이터 소스 가이드

사용자가 문의한 각 맵 구현 방식에 대한 심층 정보와 데이터 소스, 그리고 확장 방법에 대한 연구 결과입니다.

## 1. 글로벌 맵 (Global Map - D3.js)
**사용자가 좋아하는 스타일**: 벡터 기반의 깔끔한 경계선 및 데이터 시각화.

### 고해상도 샘플 데이터 소스
D3.js는 **GeoJSON** 또는 **TopoJSON** 형식을 사용합니다.
1.  **Natural Earth Data (추천)**
    *   **설명**: 가장 대중적이고 저작권 문제가 없는 공공 도메인 지도 데이터입니다.
    *   **특징**: 110m(저해상도), 50m(중해상도), 10m(고해상도)의 세 가지 스케일을 제공합니다. 강, 호수, 도로, 철도 등 다양한 레이어가 있습니다.
    *   **데이터 다운로드**: [Natural Earth Data](https://www.naturalearthdata.com/)
    *   **변환 방법**: 다운로드한 Shapefile(.shp)을 `mapshaper.org` 같은 도구를 이용해 TopoJSON으로 변환하여 사용합니다.
2.  **GADM (Global Administrative Areas)**
    *   **설명**: 전 세계 행정 구역을 매우 상세하게 제공합니다.
    *   **링크**: [GADM](https://gadm.org/) (비상업적 연구용 무료)

---

## 2. 테레인 맵 (Terrain Map - Leaflet)
**기술 분석**: **TMS (Tile Map Service)** 또는 **XYZ Tiles** 프로토콜을 사용합니다.
거대한 지도를 256x256 픽셀 조각(Tile)으로 쪼개서, 필요한 부분만 실시간으로 로딩하는 기술입니다.

### 원본 데이터 기술 및 소스 링크
1.  **OpenStreetMap (OSM)**
    *   **설명**: 전 세계 사용자가 만드는 오픈소스 지도 위키입니다.
    *   **링크**: [OpenStreetMap](https://www.openstreetmap.org/)
2.  **Mapbox**
    *   **설명**: OSM 데이터를 기반으로 매우 아름다운 커스텀 타일을 제공하는 상용 서비스입니다.
    *   **링크**: [Mapbox](https://www.mapbox.com/)
3.  **Thunderforest**: 아웃도어, 사이클링 등 테마별 타일 제공.

### 게임 기획 한계 및 확장성
*   **어느 정도까지 가능한가?**:
    *   **현실 기반 게임**: Pokemon GO 처럼 실제 지형을 기반으로 한 게임에는 최적입니다.
    *   **RPG/전략**: 타일 위에 유닛 마커, 히트맵, 이동 경로 등을 오버레이하는 것은 매우 쉽습니다.
*   **새로운 맵 제작 (Custom Maps)**:
    *   가장 어렵지만 가능합니다. "나만의 타일 등고선 이미지"를 만들어야 합니다.
    *   **도구**: **QGIS** (지리정보 툴)로 맵을 디자인하고, **TileMill**이나 **Mapbox Studio**를 통해 타일 이미지(XYZ)로 렌더링해야 합니다.
    *   **한계**: 맵이 바뀌면 모든 이미지를 다시 생성해야 하므로, 실시간으로 지형이 파괴되거나 변하는 기능은 구현하기 어렵습니다.

---

## 3. 월드 맵 (World Map - Three.js)
**문제점**: "테레인 맵처럼 디테일하지 않다." -> 기본 예제는 와이어프레임만 사용했기 때문입니다.

### 고해상도 화질 (디테일) 구현 방법
1.  **텍스처 매핑 (Texture Mapping)**
    *   Leaflet에서 사용하는 위성 사진(Tile)을 하나의 거대한 이미지(예: 8K Texture)로 합쳐 구체(Sphere)에 씌우면 테레인 맵과 똑같은 디테일을 3D로 볼 수 있습니다.
    *   **NASA Blue Marble**: 초고해상도 지구 위성 사진을 무료로 제공합니다. [NASA Visible Earth](https://visibleearth.nasa.gov/)
2.  **타일 매핑 (Tile Mapping in 3D)**
    *   전체 이미지를 입히는 대신, Three.js에서도 Leaflet처럼 카메라가 가까워지면 고해상도 타일을 로딩하여 구체 표면에 붙이는 기법을 사용할 수 있습니다.
    *   **라이브러리**: `three-geo` 또는 `cesium.js`를 사용하면 3D 지구본 위에서 Google Earth 수준의 디테일을 구현할 수 있습니다.

### 결론
*   **Global Map (D3)**: 데이터 시각화, 전략 시뮬레이션의 UI (Natural Earth Data 활용 추천).
*   **Terrain Map (Leaflet)**: 현실 지형 기반의 탐험/이동 (Mapbox/OSM 활용). 커스텀 맵은 이미지 생성 비용 발생.
*   **World Map (Three.js)**: 화려한 연출. NASA 텍스처나 위성 타일 매핑 기술을 도입하면 해상도 문제는 해결됨.
