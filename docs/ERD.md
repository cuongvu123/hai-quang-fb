# ERD — Sơ đồ quan hệ thực thể

```mermaid
erDiagram
    TENANTS ||--o{ USERS : "có"
    TENANTS ||--o{ SOURCES : "sở hữu"
    TENANTS ||--o{ CRAWLED_NEWS : "chứa"
    TENANTS ||--o{ AI_DRAFTS : "chứa"
    TENANTS ||--o{ PUBLISHING_SCHEDULE : "chứa"
    TENANTS ||--o{ PUBLISHING_LOGS : "chứa"
    TENANTS ||--o{ SETTINGS : "cấu hình"

    SOURCES ||--o{ CRAWLED_NEWS : "sinh ra"
    AI_DRAFTS ||--o{ PUBLISHING_SCHEDULE : "được lên lịch"
    PUBLISHING_SCHEDULE ||--o{ PUBLISHING_LOGS : "ghi log"
    AI_DRAFTS ||--o{ PUBLISHING_LOGS : "ghi log"
    USERS ||--o{ AI_DRAFTS : "duyệt"
    USERS ||--o{ PUBLISHING_SCHEDULE : "tạo"

    TENANTS {
        uuid id PK
        text name
        text slug UK
        text province
        text fb_group_id
        text timezone
    }
    USERS {
        uuid id PK "= auth.users.id"
        uuid tenant_id FK
        text email
        user_role role
    }
    SOURCES {
        uuid id PK
        uuid tenant_id FK
        text name
        text url
        source_type type
        boolean is_active
        jsonb config
        int crawl_interval_min
        timestamptz last_crawled_at
    }
    CRAWLED_NEWS {
        uuid id PK
        uuid tenant_id FK
        uuid source_id FK
        text title
        text content
        timestamptz published_at
        text origin_url
        text image_url
        text dedup_hash UK
    }
    AI_DRAFTS {
        uuid id PK
        uuid tenant_id FK
        text title
        text body
        news_category category
        post_template template
        draft_status status
        uuid_arr source_news_ids
        jsonb moderation
        uuid reviewed_by FK
    }
    PUBLISHING_SCHEDULE {
        uuid id PK
        uuid tenant_id FK
        uuid draft_id FK
        timestamptz scheduled_at
        publish_provider provider
        schedule_status status
        int attempts
    }
    PUBLISHING_LOGS {
        uuid id PK
        uuid tenant_id FK
        uuid schedule_id FK
        uuid draft_id FK
        publish_provider provider
        boolean success
        text fb_post_id
        text message
    }
    SETTINGS {
        uuid tenant_id PK,FK
        text key PK
        text value
        boolean is_secret
    }
```

Điểm thiết kế chính:
- **`tenant_id` ở mọi bảng** → sẵn sàng SaaS đa xã/phường, cô lập dữ liệu bằng RLS.
- **`dedup_hash` unique theo tenant** → chống trùng lặp tin ở tầng DB.
- **`ai_drafts.status`** là trục vòng đời: `generated → pending → approved/rejected → scheduled → published/failed`.
- **`publishing_schedule` + `publishing_logs`** tách lịch và lịch sử để audit & retry.
