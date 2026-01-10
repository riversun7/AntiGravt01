# Terra In-cognita (AntiGravt01)

이 프로젝트는 React(Vite 기반) 프론트엔드와 Express/Node.js 백엔드, 그리고 Next.js 클라이언트를 포함하는 복합 프로젝트입니다.

## 🛠️ 개발 환경 설정 (Setup)

이 프로젝트를 실행하기 위해 Node.js가 설치되어 있어야 합니다.

### 1. 의존성 설치 (Installation)

프로젝트 루트, 클라이언트, 서버의 모든 라이브러리를 한 번에 설치하려면 다음 명령어를 실행하세요:

```bash
npm run install:all
```

또는 개별적으로 설치할 수도 있습니다:

```bash
# 루트 (Vite App)
npm install

# 클라이언트 (Next.js)
cd terra-client && npm install

# 서버 (Express)
cd terra-server && npm install
```

---

## 🚀 프로젝트 실행 (Running)

### 전체 시스템 실행 (권장)
클라이언트와 서버를 동시에 실행하려면 루트 디렉토리에서 아래 명령어를 사용하세요:

```bash
npm run dev
```
이 명령어는 다음 두 가지를 동시에 실행합니다:
- **Frontend (Next.js)**: [http://localhost:3000](http://localhost:3000)
- **Backend (Express)**: [http://localhost:3001](http://localhost:3001)

### 개별 실행

**서버 (Backend)**
```bash
cd terra-server
npm run dev
```

**클라이언트 (Frontend)**
```bash
cd terra-client
npm run dev
```

---

## ⚠️ 트러블슈팅 (Troubleshooting)

**1. "concurrently" 명령어를 찾을 수 없음**
`npm run dev` 실행 시 오류가 발생하면 루트 디렉토리에서 `npm install`을 다시 실행해주세요.

**2. 로그인이 안 될 때**
백엔드 서버(포트 3001)가 켜져 있는지 확인하세요. `Connection Refused` 에러는 서버가 꺼져있을 때 발생합니다.

**3. NAS 배포 시 500 Internal Server Error (중요!)**

**증상:**
- 로컬에서는 정상 작동
- NAS 배포 후 `/api/login` 등에서 500 에러
- 브라우저 콘솔: `Error: Login failed (500)`
- 서버 로그에 `[REQUEST]` 없음 (요청이 도달 안 함)

**원인:**
Next.js의 `rewrites` 설정은 **빌드 타임**에 환경변수를 읽어서 코드에 하드코딩합니다.
```typescript
// ❌ 빌드 시점에 localhost로 고정됨
async rewrites() {
  return [{ source: '/api/:path*', destination: 'http://localhost:3001/api/:path*' }]
}
```

**해결:**
**런타임 Middleware 사용** - 실행 시점에 환경변수를 읽음
```typescript
// ✅ terra-client/src/middleware.ts
export async function middleware(request) {
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const apiUrl = process.env.INTERNAL_API_URL || 'http://localhost:3001';
    // 실행할 때마다 환경변수를 읽어서 프록시
  }
}
```

**핵심 차이:**
- **빌드 타임 (rewrites)**: GitHub Actions에서 빌드할 때 이미 `localhost`로 박힘
- **런타임 (middleware)**: NAS에서 실행할 때 `INTERNAL_API_URL=http://server:3001` 읽음

---

## 🏛️ 기술 스택 및 아키텍처 (Technical Stack)

이 프로젝트는 최신 웹 기술을 사용하여 확장 가능하고 반응성이 뛰어난 시스템으로 구축되었습니다.

### 프론트엔드 (`terra-client`)
-   **Next.js 16 (App Router)** - 웹사이트를 더 빠르고 효율적으로 만들기 위한 React 기반의 프레임워크
-   **React 19** - 웹사이트의 화면 요소(버튼, 메뉴 등)를 재사용 가능한 조각으로 만드는 도구
-   **TypeScript** - 코드에 오류가 있는지 미리 알려주는 도구로, 코드의 안정성을 높임
-   **Tailwind CSS** - 웹사이트 디자인을 빠르고 쉽게 꾸밀 수 있게 해주는 스타일 도구
-   **Framer Motion** - 버튼 클릭이나 화면 전환 시 부드러운 움직임 효과를 주는 애니메이션 도구
-   **Lucide React** - 웹사이트에 사용할 수 있는 깔끔한 아이콘 모음
-   **Leaflet과 React Leaflet** - 지도를 웹사이트에 표시하고 상호작용하게 만드는 도구
-   **Three.js, React Three Fiber, Drei** - 웹사이트에서 3D 그래픽(3차원 이미지)을 보여주는 도구
-   **D3.js, TopoJSON Client** - 데이터를 그래프나 지도 형태로 시각적으로 표현하는 도구
-   **Mermaid** - 데이터베이스나 시스템 구조를 그림으로 표현해주는 도구
-   **clsx, tailwind-merge** - Tailwind CSS 클래스를 조건에 따라 쉽게 조합하는 유틸리티

### 백엔드 (`terra-server`)
-   **Node.js** - 자바스크립트로 서버(컴퓨터 백그라운드)에서 프로그램을 실행할 수 있게 해주는 도구
-   **Express.js** - 서버에서 웹사이트 요청을 처리하고 응답을 보내주는 간단한 프레임워크
-   **SQLite (better-sqlite3)** - 데이터를 저장하는 간단한 데이터베이스로, 파일 하나로 관리 가능
-   **CORS, Body-parser** - 웹사이트와 서버가 안전하게 통신할 수 있도록 도와주는 보안 설정
-   **Nodemon** - 코드를 수정할 때 자동으로 서버를 다시 시작해주는 개발 도구

### 개발 도구
-   **npm** - 프로젝트에 필요한 라이브러리나 도구를 설치하고 관리하는 패키지 매니저
-   **concurrently** - 프론트엔드와 백엔드를 동시에 실행할 수 있게 해주는 도구
-   **ESLint** - 코드를 작성할 때 규칙을 지키고 오류를 방지해주는 검사 도구

---

## 💻 주요 시스템 기능 (System Features)

### 1. 관리자 콘솔 (Admin Console)
`/admin` 경로에서 접근 가능한 통합 관리 시스템입니다.
-   **Dashboard**: 서버 상태 및 주요 지표 모니터링.
-   **User Management**: 유저 정보(골드, 젬, 스탯) 실시간 수정.
-   **DB Designer (No-Code)**: GUI 기반 데이터베이스 스키마 설계 및 시각화 (Mermaid.js 자동 변환).
-   **Planning Board**: 프로젝트 할 일(Task) 및 아이디어 관리 (localStorage 연동).

### 2. 메일 시스템 (Mail System)
유저와 관리자 간의 소통 및 보상 지급 시스템입니다.
-   **기능**: 텍스트 메일, 아이템 첨부(골드, 장비 등), 예약 발송.
-   **Expiration (만료)**: 관리자가 만료일(1일, 7일 등)을 설정하면 자동으로 열람 불가능 처리.
-   **Timezone Safe**: 모든 시간은 UTC 기준으로 처리되어 전 세계 어디서든 정확한 시간에 노출.
-   **Text-Only Claim**: 아이템이 없는 메일도 '읽음/삭제' 처리 가능.

### 3. 글로벌 알림 시스템 (Global Toast System)
애플리케이션 전역에서 발생하는 이벤트를 사용자에게 알리는 시스템입니다 (`ToastContext`).
-   **Types**:
    -   ℹ️ **Info** (Blue): 일반 정보 (예: 메일 수신)
    -   ✅ **Success** (Green): 작업 성공 (예: 저장 완료, 아이템 획득)
    -   ⚠️ **Warning** (Yellow): 주의 필요
    -   ⛔ **Error** (Red): 작업 실패
-   **Features**:
    -   자동 사라짐 (Duration 제어 가능)
    -   사운드 효과 (유형별 차별화된 비프음)
    -   애니메이션 (Slide In/Out)

### 4. 맵 시스템 (Map Systems)
다양한 레벨의 전장을 시각화합니다.
-   **Tactical Map (2D)**: 타일 기반 전술 지도, Canvas API 사용.
-   **Global Map (3D/D3)**: 전 세계 구체 시각화 및 노드 연결.
-   **Terrain Map (Game Mode)**: Leaflet 기반의 위성 지도/지형 모드입니다.
    -   **GPS Tracking**: 사용자 실시간 위치 추적 및 이동 제한 시스템 (기본 10km 반경).
    -   **Admin Mode**: 관리자 계정('1')을 위한 확장된 이동 범위(100km) 및 고속 이동(100km/s).
    -   **Building System**: 건물 건설, 자원 수집, 유닛 배치, 건물 파괴 기능 (Floating Game Panel 통합).
    -   **Unit Management**: 보유 하수인 전체 목록 조회, 상태(Active/Idle) 모니터링 및 건물 배치.
    -   **Floating UI**: 정보, 유닛, 건물, 건설, 설정을 통합한 모바일 친화적 탭 인터페이스.

    #### 🌍 영토 시스템 (Territory System) **(New)**
    -   **Command Center (사령부)**: 영토를 확립하는 핵심 건물입니다. 건설 탭의 '👑 영토' 카테고리에서 건설할 수 있습니다.
    -   **Radius Control**: 사령부를 건설하면 반경 **5km**의 영토가 즉시 확보됩니다. (이전의 타일 단위 점령 방식 대체)
    -   **Voronoi Visualization**: 다른 플레이어의 영토와 겹칠 경우, 두 사령부의 **중간 지점**을 기준으로 경계선이 자동으로 분할되어 시각화됩니다 (Voronoi-like Clipping).
    -   **Interaction**: 영토 영역은 클릭되지 않으며, 오직 이동 및 건설을 위한 배경으로만 작용합니다.

    #### 🕹️ UX 개선 (UX Improvements) **(New)**
    -   **Action Popup**: 빈 땅을 클릭하면 화면을 가리는 모달 대신, **직관적인 팝업 메뉴**가 나타납니다.
        -   **[🏃 Move]**: 해당 위치로 이동 (더블클릭 이동 제거로 오작동 방지)
        -   **[🏗️ Build]**: 건설 메뉴 접근
    -   **Clean Selection**: 불필요한 선택 박스나 하이라이트를 제거하여 지도 가시성을 높였습니다.
