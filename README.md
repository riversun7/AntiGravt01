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
