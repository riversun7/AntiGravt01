# NAS 배포 가이드 (Synology NAS Deployment)

## 📦 개요

GitHub Container Registry (GHCR)를 통해 Docker 이미지를 자동으로 빌드하고, Synology NAS Container Manager에서 배포합니다.

---

## 🚀 배포 방법

### 1. 프로젝트 설정

**NAS Container Manager → 프로젝트 → 새 프로젝트**

- 이름: `antigravt02`
- 경로: `/docker/antigravt02`
- YAML: `docker-compose.production.yml` 내용 붙여넣기

### 2. 이미지 자동 업데이트

GitHub에 코드를 푸시하면:
1. **GitHub Actions**가 자동으로 빌드 (`.github/workflows/docker-publish.yml`)
2. **GHCR**에 이미지 업로드 (`ghcr.io/riversun7/antigravt01-client:latest`, `server:latest`)
3. **Watchtower**가 60초마다 새 이미지 자동 다운로드 및 재시작

---

## 🗄️ 데이터베이스 이식 (로컬 → NAS)

### 방법 1: 직접 복사 (권장)

**1. 로컬에서 DB 백업**
```bash
# Windows
copy "terra-server\db\database.db" "database-backup.db"
```

**2. NAS에 업로드**
- DSM 파일 스테이션 접속
- `/docker/antigravt02/terra-data/db/` 폴더로 이동
- `database-backup.db` 업로드

**3. NAS에서 교체**
```bash
# NAS SSH 접속 후
cd /volume1/docker/antigravt02/terra-data/db
mv database.db database.db.old  # 기존 백업
mv database-backup.db database.db  # 새 DB로 교체
```

**4. 컨테이너 재시작**
```
Container Manager → antigravt02 → 중지 → 시작
```

---

### 방법 2: SQL 덤프 사용

**1. 로컬에서 덤프 생성**
```bash
cd terra-server\db
sqlite3 database.db .dump > backup.sql
```

**2. NAS로 전송 후 복원**
```bash
# NAS SSH에서
cd /volume1/docker/antigravt02/terra-data/db
sqlite3 database.db < backup.sql
```

---

## 🏥 헬스 체크

**정상 작동 확인:**
```
https://riversun7.synology.me → 로그인 페이지
Admin 계정: admin / 1234
```

**로그 확인:**
```
Container Manager → 컨테이너 → terra-server → 로그
→ [REQUEST] POST /api/login from ... (이 로그가 보여야 정상)
```

---

## ⚠️ 주의사항

### 1. 데이터베이스 경로
- **로컬**: `terra-server/db/database.db`
- **NAS**: `/volume1/docker/antigravt02/terra-data/db/database.db`
- **Docker 내부**: `/app/db/database.db`

### 2. 환경변수
```yaml
# docker-compose.production.yml
services:
  client:
    environment:
      - INTERNAL_API_URL=http://server:3001  # 중요! localhost 아님
  server:
    environment:
      - CORS_ORIGIN=https://riversun7.synology.me
```

### 3. 포트 충돌
- Synology 웹 스테이션이 80/443 사용 중이면 리버스 프록시 필요
- DSM → 제어판 → 로그인 포털 → 고급 → 리버스 프록시

---

## 📊 GitHub Actions 상태

**빌드 확인:**
https://github.com/riversun7/AntiGravt01/actions

**성공 시:**
- `build-and-push (client)` ✅
- `build-and-push (server)` ✅
- Watchtower가 1분 내 자동 업데이트

**실패 시:**
- Actions 탭에서 에러 로그 확인
- 주로 빌드 에러 또는 GHCR 인증 문제
