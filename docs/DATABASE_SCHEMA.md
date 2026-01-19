# 📜 AntiGravt01 Database Schema

> [!CAUTION]
> **🤖 [AI 개발자 필독] 데이터베이스 작업 원칙**
> 
> 이 문서는 데이터베이스 구조의 **유일한 진실 공급원(Single Source of Truth)**입니다.
> 
> 1.  **스키마 확인 필수**: 쿼리를 작성하거나 데이터를 수정하기 전에 반드시 이 문서의 ERD와 제약조건을 확인하십시오.
> 2.  **원시 수정 금지**: `database.js`에 임의의 테이블을 추가하거나 컬럼을 변경하지 마십시오. 스키마 변경이 필요하면 `migration` 전략을 세우고 사용자 승인을 받으십시오.
> 3.  **팩토리 패턴 사용**: 테스트 데이터나 초기 데이터를 생성할 때는 반드시 유저, 사이보그, 기본 건물을 원자적으로 생성하는 **`UserFactory`**를 사용하십시오. 개별 `INSERT` 문 사용을 금지합니다.
> 4.  **Deprecated 컬럼 사용 금지**: `user_buildings` 테이블의 `type` 컬럼은 구버전입니다. 반드시 **`building_type_code`**를 사용하십시오.

---

## 🗺️ Entity Relationship Diagram (ERD)

```mermaid
erDiagram
    %% --- Core User ---
    USERS {
        int id PK
        string username
        string role "user, admin"
        string npc_type "NONE, ABSOLUTE, FREE"
        string current_pos "좌표 (x_y)"
        string faction_id FK "소속 팩션(nullable)"
    }

    FACTIONS {
        int id PK
        string name
        string type "PLAYER, ABSOLUTE, FREE"
        int leader_id FK
    }

    %% --- Character System ---
    CHARACTER_CYBORG {
        int id PK
        int user_id FK "1:1 관계 (필수)"
        string name
        int hp "계산됨: con*10 + str*5"
        int mp "계산됨: wis*8 + int*6"
        int strength
        int dexterity
        int constitution
        int intelligence
        int wisdom
        real movement_speed
        real vision_range
    }

    CHARACTER_MINION {
        int id PK
        int user_id FK "1:N 관계"
        string type "human, android, creature"
        string current_action "IDLE, GATHERING..."
        int battery "Android only"
        int fuel "Android only"
    }

    %% --- Building System ---
    BUILDING_TYPES {
        int id PK
        string code UK "식별 코드 (예: COMMAND_CENTER)"
        string category
        json construction_cost
        real production_rate
        int is_territory_center
    }

    USER_BUILDINGS {
        int id PK
        int user_id FK
        string building_type_code FK "참조: BUILDING_TYPES.code"
        string type "⚠️ DEPRECATED: 사용 금지"
        int world_x
        int world_y
        real x "위도 (Latitude)"
        real y "경도 (Longitude)"
        int hp
        datetime last_collected_at
        datetime last_maintenance_at
    }

    %% --- Economy ---
    USER_RESOURCES {
        int user_id PK
        int gold
        int gem
    }

    MARKET_ITEMS {
        int id PK
        string code UK
        string type "RESOURCE, EQUIPMENT, VEHICLE"
        int base_price
    }

    %% Relationships
    USERS ||--o| CHARACTER_CYBORG : "has 1 (Required)"
    USERS ||--o{ CHARACTER_MINION : "owns many"
    USERS ||--o{ USER_BUILDINGS : "owns many"
    USERS ||--|| USER_RESOURCES : "has wallet"
    USERS }o--|| FACTIONS : "member of"
    FACTIONS |o--|| USERS : "led by"
    USER_BUILDINGS }o--|| BUILDING_TYPES : "defined by"
```

---

## 🏗️ Table Standards & Rules

### 1. Users & Characters
*   **원칙**: 모든 `users` 레코드는 반드시 1개의 대응되는 `character_cyborg` 레코드를 가져야 합니다.
*   **이유**: 게임 내 모든 스탯 계산은 `character_cyborg`를 기준으로 수행됩니다. 없는 경우 치명적인 오류가 발생합니다.

### 2. Buildings (건물)
*   **원칙**: 건물 인스턴스(`user_buildings`)는 `building_type_code`를 통해 `building_types`의 메타데이터를 참조해야 합니다.
*   **주의**: 과거에 사용되던 `type` 컬럼은 호환성을 위해 남겨두었으나, 신규 코드에서는 값을 읽거나 쓰지 마십시오.

### 3. Factions (팩션)
*   **구조**: 팩션은 `factions` 테이블에 정의되며, `users.faction_id`를 통해 소속이 결정됩니다.
*   **순환 참조**: `factions.leader_id`는 유저를 가리키고, `users.faction_id`는 팩션을 가리킵니다. 생성 순서에 주의가 필요하므로 `UserFactory` 사용을 권장합니다.
