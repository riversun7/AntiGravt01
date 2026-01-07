# 시놀로지 NAS 배포 가이드 (최종 솔루션)

이 문서는 시행착오를 거쳐 검증된 **"가장 확실하고 쉬운 배포 방법"**을 정리한 최종 가이드입니다.

---

## ⚠️ 핵심 주의사항 (이것 때문에 많이 실패합니다!)
**"리포지토리(코드)가 공개라고 해서, 패키지(이미지)가 자동으로 공개되는 것이 아닙니다."**
시놀로지에서 로그인 없이 이미지를 받으려면 반드시 **패키지 자체를 Public**으로 설정해야 합니다.

---

## 1. GitHub 패키지 공개 설정 (필수)
이 과정을 건너뛰면 시놀로지에서 `permission denied` 또는 `unauthorized` 오류가 발생합니다.

1.  GitHub 상단 메뉴의 **Packages** 탭 클릭
    *   (메인 코드가 있는 곳이 아닙니다! 프로필 메뉴 또는 상단 탭에서 찾으세요)
2.  `antigravt01-server` 패키지 클릭
3.  우측 하단 **Package settings** 클릭
4.  맨 아래 **Danger Zone** -> **Change visibility** -> **Public**으로 변경
5.  `antigravt01-client` 패키지도 동일하게 수행

---

## 2. 시놀로지 NAS 설정 (Container Manager)

### A. 기존 로그인 정보 삭제 (충돌 방지)
이전에 시도했던 **레지스트리 설정**이 있다면 지워야 합니다.
1.  **Container Manager** -> **레지스트리(Registry)**
2.  `GHCR` (또는 `ghcr.io`) 항목이 있다면 **삭제**합니다.
    *   *공개 패키지는 로그인 정보가 아예 없어야 가장 잘 받아집니다.*

### B. 프로젝트 생성 (빌드 금지, 이미지 사용)
1.  **프로젝트(Project)** -> **생성(Create)**
2.  **프로젝트 이름**: `antigravt01`
3.  **경로**: `/docker/antigravt01` (File Station에서 미리 생성 추천)
4.  **소스**: 아래 내용을 복사해서 붙여넣습니다. (기존 `docker-compose.yml` 사용 금지)

```yaml
version: '3.8'

services:
  server:
    # Build 명령 없이 완성된 이미지를 바로 가져옵니다
    image: ghcr.io/${GITHUB_REPOSITORY_OWNER:-riversun7}/antigravt01-server:latest
    container_name: terra-server
    ports:
      - "3001:3001"
    volumes:
      - ./terra-data/db:/app/db # 데이터 베이스 저장 경로
    environment:
      - NODE_ENV=production
      # DDNS 도메인 (CORS 문제 해결)
      - CORS_ORIGIN=http://riversun7.synology.me:3000
    restart: always
    networks:
      - terra-network

  client:
    image: ghcr.io/${GITHUB_REPOSITORY_OWNER:-riversun7}/antigravt01-client:latest
    container_name: terra-client
    ports:
      - "3000:3000"
    environment:
      # 브라우저가 접속할 주소
      - NEXT_PUBLIC_API_URL=http://riversun7.synology.me:3001
      - INTERNAL_API_URL=http://server:3001
    depends_on:
      - server
    restart: always
    networks:
      - terra-network

  watchtower:
    # 새 버전이 나오면 자동으로 업데이트해주는 컨테이너
    image: containrrr/watchtower
    container_name: terra-watchtower
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    command: --interval 300 --cleanup
    restart: always

networks:
  terra-network:
    driver: bridge
```

5.  **다음** -> **완료**를 누르면 자동으로 이미지를 다운로드(Pulling)하고 실행됩니다.

---

## 3. 공유기 포트포워딩 (외부 접속용)
외부에서 접속하려면 공유기가 길을 열어줘야 합니다.

1.  공유기 관리자 페이지 접속
2.  **포트포워딩 설정** 메뉴
3.  규칙 추가:
    *   **외부 포트 3000** -> **내부 IP (NAS) 포트 3000** (게임 접속용)
    *   **외부 포트 3001** -> **내부 IP (NAS) 포트 3001** (API 통신용)

---

## 4. 접속 확인
브라우저 주소창에:
`http://riversun7.synology.me:3000`
(HTTPS가 아닌 HTTP입니다)

---

## 5. 업데이트 방법 (자동화 완료)
이제 로컬 컴퓨터에서 코드를 수정하고 GitHub에 `git push`만 하면 됩니다.
1.  GitHub Actions가 새 이미지를 만들고 (Public 패키지로 등록)
2.  NAS의 **Watchtower**가 5분마다 확인해서
3.  새 버전이 있으면 자동으로 컨테이너를 재시작합니다.
