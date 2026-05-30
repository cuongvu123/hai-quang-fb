-- =====================================================================
-- Hai Quang Community AI — Database Schema
-- PostgreSQL 15+ / Supabase
-- =====================================================================
-- Thiết kế hỗ trợ multi-tenant (nhiều xã/phường) ngay từ đầu qua bảng
-- `tenants`. Mọi bảng nghiệp vụ đều mang tenant_id để dễ mở rộng thành SaaS.
-- =====================================================================

create extension if not exists "pgcrypto";       -- gen_random_uuid()
create extension if not exists "pg_trgm";         -- fuzzy / dedup similarity

-- ---------- ENUMS ----------------------------------------------------
create type source_type as enum (
  'local_website',      -- Website địa phương (xã)
  'province_website',   -- Website tỉnh Ninh Bình
  'gov_website',        -- Website cơ quan nhà nước
  'rss',                -- RSS Feed
  'facebook_page',      -- Fanpage Facebook công khai
  'local_news'          -- Báo điện tử địa phương
);

create type news_category as enum (
  'admin_notice',   -- Thông báo hành chính
  'education',      -- Giáo dục
  'health',         -- Y tế
  'culture',        -- Văn hóa
  'sports',         -- Thể thao
  'traffic',        -- Giao thông
  'utilities',      -- Điện nước
  'security',       -- An ninh trật tự
  'recruitment',    -- Tuyển dụng
  'community',      -- Hoạt động cộng đồng
  'uncategorized'
);

create type draft_status as enum (
  'generated',   -- AI vừa sinh
  'pending',     -- Qua moderation, chờ admin duyệt
  'approved',    -- Admin duyệt
  'rejected',    -- Admin từ chối
  'scheduled',   -- Đã lên lịch
  'published',   -- Đã đăng
  'failed'       -- Đăng lỗi
);

create type post_template as enum (
  'weekly_open',     -- Bản tin đầu tuần
  'midweek',         -- Điểm tin giữa tuần
  'weekend',         -- Tổng hợp cuối tuần
  'urgent',          -- Thông báo khẩn
  'event'            -- Sự kiện sắp diễn ra
);

create type schedule_status as enum ('queued', 'publishing', 'done', 'error', 'canceled');
create type publish_provider as enum ('graph_api', 'playwright');
create type user_role as enum ('owner', 'admin', 'editor', 'viewer');

-- ---------- TENANTS (multi-tenant gốc) -------------------------------
create table tenants (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,                 -- "Xã Hải Quang"
  slug          text not null unique,          -- "hai-quang"
  province      text,                          -- "Ninh Bình"
  fb_group_id   text,                          -- nhóm Facebook đích
  timezone      text not null default 'Asia/Ho_Chi_Minh',
  created_at    timestamptz not null default now()
);

-- ---------- USERS ----------------------------------------------------
-- Liên kết 1-1 với auth.users của Supabase (id = auth.uid()).
create table users (
  id          uuid primary key references auth.users(id) on delete cascade,
  tenant_id   uuid not null references tenants(id) on delete cascade,
  email       text not null,
  full_name   text,
  role        user_role not null default 'editor',
  created_at  timestamptz not null default now()
);
create index idx_users_tenant on users(tenant_id);

-- ---------- SOURCES --------------------------------------------------
create table sources (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  name          text not null,
  url           text not null,
  type          source_type not null,
  is_active      boolean not null default true,
  -- selector cấu hình parse cho website thường (css selectors), null với rss
  config        jsonb not null default '{}'::jsonb,
  crawl_interval_min int not null default 360,  -- mỗi 6h
  last_crawled_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (tenant_id, url)
);
create index idx_sources_tenant_active on sources(tenant_id, is_active);

-- ---------- CRAWLED_NEWS ---------------------------------------------
create table crawled_news (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  source_id     uuid not null references sources(id) on delete cascade,
  title         text not null,
  content       text not null,
  summary       text,
  published_at  timestamptz,
  origin_url    text not null,
  image_url     text,
  -- hash để chống trùng (sha256 của origin_url|title chuẩn hóa)
  dedup_hash    text not null,
  raw           jsonb not null default '{}'::jsonb,
  crawled_at    timestamptz not null default now(),
  unique (tenant_id, dedup_hash)
);
create index idx_news_tenant_pub on crawled_news(tenant_id, published_at desc);
create index idx_news_title_trgm on crawled_news using gin (title gin_trgm_ops);

-- ---------- AI_DRAFTS ------------------------------------------------
create table ai_drafts (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  title         text not null,
  body          text not null,                 -- nội dung bài Facebook
  category      news_category not null default 'uncategorized',
  template      post_template not null default 'midweek',
  status        draft_status not null default 'generated',
  -- nguồn tin tạo nên bài (mảng id crawled_news)
  source_news_ids uuid[] not null default '{}',
  image_urls    text[] not null default '{}',
  -- kết quả moderation
  moderation    jsonb not null default '{}'::jsonb,  -- {passed, flags:[...], score}
  ai_provider   text,                                -- 'claude' | 'openai'
  ai_model      text,
  reviewed_by   uuid references users(id),
  reviewed_at   timestamptz,
  reject_reason text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index idx_drafts_tenant_status on ai_drafts(tenant_id, status, created_at desc);

-- ---------- PUBLISHING_SCHEDULE --------------------------------------
create table publishing_schedule (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  draft_id      uuid not null references ai_drafts(id) on delete cascade,
  scheduled_at  timestamptz not null,
  provider      publish_provider not null default 'graph_api',
  status        schedule_status not null default 'queued',
  attempts      int not null default 0,
  created_by    uuid references users(id),
  created_at    timestamptz not null default now()
);
create index idx_sched_due on publishing_schedule(status, scheduled_at)
  where status = 'queued';

-- ---------- PUBLISHING_LOGS ------------------------------------------
create table publishing_logs (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  schedule_id   uuid references publishing_schedule(id) on delete set null,
  draft_id      uuid references ai_drafts(id) on delete set null,
  provider      publish_provider not null,
  success       boolean not null,
  fb_post_id    text,                          -- id bài trên Facebook
  message       text,                          -- log / lỗi
  payload       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index idx_logs_tenant_time on publishing_logs(tenant_id, created_at desc);

-- ---------- SETTINGS (key-value theo tenant) -------------------------
-- API key được mã hoá ở tầng app trước khi lưu (xem src/lib/crypto.ts).
create table settings (
  tenant_id   uuid not null references tenants(id) on delete cascade,
  key         text not null,    -- 'claude_api_key','openai_api_key','fb_page_token'...
  value       text,             -- giá trị (đã mã hoá nếu là secret)
  is_secret   boolean not null default false,
  updated_at  timestamptz not null default now(),
  primary key (tenant_id, key)
);

-- ---------- updated_at trigger ---------------------------------------
create or replace function set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger trg_sources_upd before update on sources
  for each row execute function set_updated_at();
create trigger trg_drafts_upd before update on ai_drafts
  for each row execute function set_updated_at();

-- ---------- ROW LEVEL SECURITY ---------------------------------------
-- Mỗi user chỉ thấy dữ liệu thuộc tenant của mình.
alter table sources             enable row level security;
alter table crawled_news        enable row level security;
alter table ai_drafts           enable row level security;
alter table publishing_schedule enable row level security;
alter table publishing_logs     enable row level security;
alter table settings            enable row level security;
alter table users               enable row level security;

create or replace function current_tenant_id() returns uuid as $$
  select tenant_id from users where id = auth.uid();
$$ language sql stable;

-- Policy mẫu (áp dụng tương tự cho các bảng còn lại)
create policy tenant_isolation_sources on sources
  using (tenant_id = current_tenant_id());
create policy tenant_isolation_news on crawled_news
  using (tenant_id = current_tenant_id());
create policy tenant_isolation_drafts on ai_drafts
  using (tenant_id = current_tenant_id());
create policy tenant_isolation_sched on publishing_schedule
  using (tenant_id = current_tenant_id());
create policy tenant_isolation_logs on publishing_logs
  using (tenant_id = current_tenant_id());
create policy tenant_isolation_settings on settings
  using (tenant_id = current_tenant_id());
create policy self_tenant_users on users
  using (tenant_id = current_tenant_id());

-- LƯU Ý: các cron job / service chạy bằng SERVICE_ROLE key sẽ bypass RLS,
-- vì vậy luôn truyền tenant_id tường minh trong repository ở tầng server.
