# 시놀로지 NAS Docker 배포 가이드

이 문서는 생성된 Docker 설정을 사용하여 애플리케이션을 시놀로지 NAS에 배포하고, 자동 업데이트 시스템을 구축하는 방법을 설명합니다.

## 1. 사전 준비 (GitHub)

가장 먼저, 작성된 코드를 GitHub에 올려서 이미지가 자동으로 생성되게 해야 합니다.

1.  **커밋 및 푸시**:
    ```bash
    git add .
    git commit -m "Add Docker configuration with CI/CD"
    git push origin main
    ```
2.  **빌드 확인**:
    - GitHub 저장소의 **Actions** 탭으로 이동합니다.
    - `Docker Build and Publish` 워크플로우가 초록색 체크(성공)가 될 때까지 기다립니다.
    - 성공하면 GitHub Packages(GHCR)에 이미지가 등록된 것입니다.

## 2. 시놀로지 NAS 준비

### 필수 패키지 설치
시놀로지 **패키지 센터**에서 다음을 설치해 주세요:
- **Container Manager** (구 Docker)
- **Text Editor** (설정 파일 수정용, 선택 사항)

### 폴더 구성
보통 `/volume1/docker/` 아래에 프로젝트 폴더를 만듭니다.

1.  **File Station**을 엽니다.
2.  `docker` 공유 폴더 안에 `antigravt01` 폴더를 만듭니다.
3.  그 안에 `terra-data` 폴더를 만들고, 다시 그 안에 `db` 폴더를 만듭니다.
    - 구조: `/docker/antigravt01/terra-data/db/`
    - *이 폴더에 게임 데이터(`terra.db`)가 저장되어, 컨테이너를 지워도 데이터가 안전합니다.*

## 3. 실행 (두 가지 방법)

### 방법 A: Container Manager (프로젝트 기능) 사용 - **추천**
(최신 DSM 7.2 이상)

1.  **Container Manager** 앱을 실행합니다.
2.  좌측 메뉴에서 **프로젝트(Project)**를 클릭합니다.
3.  **생성(Create)**을 누릅니다.
    - **프로젝트 이름**: `antigravt01`
    - **경로**: `/docker/antigravt01` (아까 만든 폴더 선택)
    - **소스**: `docker-compose.yml` 업로드 또는 내용 붙여넣기.
      *(로컬에 있는 `docker-compose.yml` 내용을 복사해서 붙여넣으세요)*
4.  **다음** -> **완료**를 누르면 자동으로 이미지를 다운받고 실행됩니다.

### 방법 B: SSH 사용 (고급 사용자)
1.  NAS에 SSH로 접속합니다.
2.  폴더로 이동: `cd /volume1/docker/antigravt01`
3.  `docker-compose.yml` 파일을 해당 폴더에 업로드합니다.
4.  실행: `sudo docker-compose up -d`

## 4. 접속 확인

- **클라이언트 (게임 접속)**: `http://<NAS_IP>:3000`
- **서버 (API)**: `http://<NAS_IP>:3001`

방화벽이 켜져 있다면 제어판에서 3000, 3001 포트를 허용해야 할 수 있습니다.

## 5. 자동 업데이트 작동 원리

이제부터는 로컬에서 코드를 수정하고 **GitHub에 푸시하기만 하면** 됩니다.

1.  GitHub Actions가 새 이미지를 빌드합니다.
2.  NAS에 떠 있는 **Watchtower** 컨테이너가 5분마다 새 이미지를 검사합니다.
3.  새 버전이 감지되면 자동으로 서버/클라이언트 컨테이너를 끄고, 새 버전으로 교체한 뒤 다시 켭니다.
