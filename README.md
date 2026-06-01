# Hải Quang — Hệ thống AI tổng hợp tin & hỗ trợ đăng Facebook cộng đồng

Tự động: **thu thập tin → AI tổng hợp → moderation → admin duyệt → lên lịch → đăng Facebook**.
Con người luôn ở giữa (human-in-the-loop). AI **không bao giờ** đăng trực tiếp khi chưa duyệt.

> 🚀 **Mới bắt đầu? Đọc [`docs/SETUP_GUIDE.md`](docs/SETUP_GUIDE.md)** — hướng dẫn từng-click từ máy tính rồi vận hành trên điện thoại (~90 phút lần đầu, sau đó chỉ dùng phone).

> 🆓 **Có thể chạy hoàn toàn miễn phí** (Vercel + Supabase + Gemini + GitHub Actions).
> Tóm tắt nhanh: [`docs/FREE_DEPLOY.md`](docs/FREE_DEPLOY.md).

> 📥 **Nạp tin không cần kỹ thuật**: ngoài crawler RSS/HTML, có 3 kênh nạp thủ công —
> **tải ảnh/PDF** (Gemini đọc nội dung), **Google Sheet**, **bot Telegram**.
> Xem [`docs/INGEST_GUIDE.md`](docs/INGEST_GUIDE.md).

> ⚠️ **Đây là một nền tảng (foundation) chạy được, không phải sản phẩm đã đóng gói 100%.**
> Các phần "bộ não" (AI generator, moderation, crawler, provider pattern Facebook, schema, cron jobs, API)
> được implement đầy đủ. Phần UI admin có 2 màn hình mẫu hoàn chỉnh + cấu trúc cho các màn còn lại để bạn mở rộng.
> Xem mục [Trạng thái hoàn thiện](#trạng-thái-hoàn-thiện) cuối file.

---

## 1. Phân tích kiến trúc tổng thể

Luồng dữ liệu một chiều, mỗi tầng có trách nhiệm rõ ràng (Clean Architecture):

```
Sources (cấu hình nguồn)
   │  cron/crawl (mỗi giờ)
   ▼
Crawler (rss / html parser + dedup)
   │
   ▼
Database (crawled_news)
   │  cron/generate (theo lịch tuần)
   ▼
AI Content Generator (Claude|OpenAI) ──► Moderation (deterministic + flag)
   │  draft.status = pending
   ▼
Admin Dashboard (duyệt / sửa / từ chối / lên lịch)
   │  draft.status = scheduled  + publishing_schedule
   ▼
Facebook Publisher (Provider Pattern: Graph API | Playwright)
   │  cron/publish (mỗi 5 phút) ──► publishing_logs
   ▼
Nhóm/Trang Facebook
```

Nguyên tắc:
- **Tách lớp**: `lib/crawler`, `lib/ai`, `lib/facebook`, `lib/db` độc lập, không phụ thuộc UI.
- **Provider Pattern** ở 2 chỗ dễ thay đổi nhất: AI và Facebook publisher.
- **Background jobs** qua cron (Vercel Cron khi deploy cloud, hoặc container `cron` khi self-host).
- **Multi-tenant từ gốc** (`tenant_id` ở mọi bảng + RLS) → mở rộng SaaS nhiều xã/phường.
- **Type-safe** đầu-cuối với TypeScript + Zod ở biên API.
- **Logging** JSON-line (`lib/logger.ts`), **error handling** ở mọi cron/route.

---

## 2. Folder structure

```
hai-quang-ai/
├─ .github/workflows/
│  ├─ cron.yml              # GitHub Actions cron miễn phí (thay Vercel Cron)
│  └─ backup.yml            # Backup DB tuần (bù cho Supabase Free)
├─ supabase/migrations/
│  ├─ 0001_init.sql          # schema đầy đủ + enum + index + RLS
│  └─ 0002_seed.sql          # seed demo xã Hải Quang
├─ docs/
│  ├─ ERD.md                 # sơ đồ quan hệ (mermaid)
│  ├─ WIREFRAMES.md          # wireframe + danh sách màn hình + user flow
│  └─ FREE_DEPLOY.md         # hướng dẫn deploy 0đ/tháng
├─ src/
│  ├─ types/index.ts         # domain types dùng chung
│  ├─ lib/
│  │  ├─ logger.ts
│  │  ├─ cron-auth.ts        # bảo vệ cron + tenant mặc định
│  │  ├─ db/
│  │  │  ├─ client.ts        # adminDb (service role) / publicDb (anon)
│  │  │  └─ repositories.ts  # mọi truy vấn DB tập trung ở đây
│  │  ├─ crawler/
│  │  │  ├─ index.ts         # crawlSource() + isDue()
│  │  │  ├─ dedup.ts         # hash chống trùng
│  │  │  └─ parsers/{rss,html}.ts
│  │  ├─ ai/
│  │  │  ├─ provider.ts      # interface AiProvider
│  │  │  ├─ index.ts         # factory + generateDraft + moderate
│  │  │  ├─ parse.ts         # trích JSON / chuẩn hoá category
│  │  │  ├─ schedule.ts      # chọn template theo thứ
│  │  │  ├─ providers/{claude,openai,gemini}.ts
│  │  │  └─ templates/prompts.ts
│  │  └─ facebook/
│  │     ├─ publisher.ts     # interface FacebookPublisher
│  │     ├─ index.ts         # factory createPublisher()
│  │     └─ providers/{graph-api,playwright}.ts
│  └─ app/
│     ├─ layout.tsx · globals.css · page.tsx
│     ├─ (dashboard)/
│     │  ├─ layout.tsx       # sidebar
│     │  ├─ dashboard/page.tsx   # tổng quan (server, KPI)
│     │  └─ drafts/page.tsx      # duyệt bài (client)
│     └─ api/
│        ├─ cron/{crawl,generate,publish}/route.ts
│        ├─ sources/route.ts · sources/[id]/route.ts
│        └─ drafts/route.ts · drafts/[id]/{approve,reject}/route.ts
├─ Dockerfile · docker-compose.yml · vercel.json
├─ package.json · tsconfig.json · next.config.ts · .env.example
└─ tailwind.config.ts · postcss.config.mjs
```

---

## 3–4. Database schema & ERD

- Schema SQL đầy đủ: [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql)
- ERD: [`docs/ERD.md`](docs/ERD.md)

Bảng: `tenants, users, sources, crawled_news, ai_drafts, publishing_schedule, publishing_logs, settings`.
Có enum cho mọi trạng thái, index cho truy vấn nóng, `pg_trgm` để hỗ trợ dedup/tìm kiếm, và RLS cô lập tenant.

---

## 5. API design

| Method | Endpoint | Mô tả | Bảo vệ |
|---|---|---|---|
| GET | `/api/cron/crawl` | Crawl các nguồn tới hạn | `CRON_SECRET` |
| GET | `/api/cron/generate` | Sinh bài nháp + moderation | `CRON_SECRET` |
| GET | `/api/cron/publish` | Đăng bài tới giờ | `CRON_SECRET` |
| GET/POST | `/api/sources` | Liệt kê / tạo nguồn | Auth admin |
| PATCH/DELETE | `/api/sources/:id` | Sửa / xoá nguồn | Auth admin |
| GET | `/api/drafts?status=` | Liệt kê bài nháp | Auth admin |
| POST | `/api/drafts/:id/approve` | Duyệt + lên lịch | Auth admin |
| POST | `/api/drafts/:id/reject` | Từ chối | Auth admin |

Tất cả body được validate bằng **Zod** (xem `api/sources/route.ts`). Lỗi trả JSON chuẩn `{ error }`.

---

## 6–8. UI wireframe · Danh sách màn hình · User flow

Xem [`docs/WIREFRAMES.md`](docs/WIREFRAMES.md). Tóm tắt 6 màn hình:
Dashboard · Sources · News · AI Drafts · Publishing Calendar · Settings.

---

## 9. Source code

Đã triển khai trong `src/`. Phần cốt lõi (AI, crawler, Facebook provider, cron, schema, API) hoàn chỉnh.

---

## 10–11. Docker & chạy local

### Cách A — Supabase Cloud (khuyến nghị, nhanh nhất)

```bash
# 1. Tạo project tại https://supabase.com, vào SQL Editor chạy lần lượt:
#    supabase/migrations/0001_init.sql  rồi  0002_seed.sql
# 2. Cài deps
npm install
# 3. Tạo .env từ mẫu và điền URL + anon + service_role key
cp .env.example .env
# 4. Tạo tài khoản admin: Supabase > Authentication > Add user
#    Lấy uid rồi chạy phần "map user" ở cuối 0002_seed.sql
# 5. Chạy
npm run dev   # http://localhost:3000  → /dashboard
```

### Cách B — Docker (self-host trọn gói)

```bash
cp .env.example .env   # điền giá trị
docker compose up --build
# app: http://localhost:3000 ; postgres: localhost:5432
# migrations tự chạy từ ./supabase/migrations khi khởi tạo DB lần đầu
```

Test cron thủ công:
```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/crawl
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/generate
```

---

## 12. Deploy lên VPS

```bash
# Trên VPS (Ubuntu) đã có Docker + Docker Compose
git clone <repo> && cd hai-quang-ai
cp .env.example .env && nano .env        # điền secrets
docker compose up -d --build

# Reverse proxy + HTTPS bằng Caddy (đơn giản nhất):
#   yourdomain.com {
#       reverse_proxy localhost:3000
#   }
```

- Cron khi self-host: container `cron` trong `docker-compose.yml` gọi `/api/cron/*` định kỳ.
- Backup DB: `docker exec <db> pg_dump -U haiquang haiquang > backup.sql` (đặt cronjob hệ thống).
- Theo dõi log: `docker compose logs -f app` (log JSON-line dễ đẩy sang Loki/Datadog).

> Nếu deploy **Vercel** thay vì VPS: chỉ cần `vercel deploy`. `vercel.json` đã khai báo 3 cron job.
> Đặt biến môi trường trong Vercel Project Settings.

---

## 13. Tích hợp AI (Claude / OpenAI / Gemini)

3 provider, đổi không sửa code — chỉ đổi `settings.ai_provider`:

| Provider | Khi nào dùng | Lấy key tại |
|---|---|---|
| `gemini` (mặc định) | Bản miễn phí — Flash-Lite 1000 req/ngày | https://aistudio.google.com/apikey |
| `claude` | Chất lượng cao nhất, có phí | https://console.anthropic.com |
| `openai` | Thay thế nếu đã có credit | https://platform.openai.com |

Cách thêm key: mở màn **Settings** trên app, dán key, lưu. Hoặc qua SQL:
```sql
insert into settings values
  ('<tenant_id>', 'ai_provider', 'gemini', false),
  ('<tenant_id>', 'gemini_api_key', '<key>', true);
```

Tuỳ biến văn phong: sửa `SYSTEM_PROMPT` và `TEMPLATE_GUIDE` trong `src/lib/ai/templates/prompts.ts`.
Toàn bộ 3 provider chia sẻ chung interface `AiProvider` (`src/lib/ai/provider.ts`) — thêm provider mới chỉ ~50 dòng (xem mẫu `providers/gemini.ts`).

---

## 14. Tích hợp Facebook Publisher

Provider Pattern — interface chung `FacebookPublisher` với `publishPost / schedulePost / uploadImage`.

**Provider 1 — Graph API** (`providers/graph-api.ts`):
- Tạo Facebook App, lấy **Page Access Token** dài hạn → lưu `settings.fb_page_token`, `settings.fb_target_id`.
- Lưu ý: Graph API hạn chế đăng vào **Group** với app thường (chính sách từ 2024+). Khuyến nghị dùng mô hình **Page** cho cộng đồng, hoặc xin quyền group nếu đủ điều kiện.

**Provider 2 — Playwright** (`providers/playwright.ts`):
- Dự phòng khi cần đăng vào Group. Đăng nhập sẵn → xuất `storageState` (cookie) → lưu `settings.fb_storage_state`.
- ⚠️ Tự động hoá UI có thể vi phạm ToS Facebook và dễ bị chặn; dùng thận trọng, ưu tiên Graph API.

Đổi provider: đặt `publishing_schedule.provider = 'graph_api' | 'playwright'` (chọn ngay khi duyệt bài).

---

## 15. Seed data demo

`supabase/migrations/0002_seed.sql`: tenant **Xã Hải Quang**, 4 nguồn mẫu, 1 tin demo, 1 bài AI chờ duyệt.

---

## Cron lịch mặc định

Trên **Vercel Free (Hobby)**, sub-daily cron không chạy được → đã chuyển sang **GitHub Actions** (xem `.github/workflows/cron.yml`):

| Job | Lịch | Ý nghĩa |
|---|---|---|
| crawl | mỗi giờ | thu tin mới |
| generate | T2/T4/T5/T7 lúc 13:30 VN | sinh ~3–5 bài/tuần |
| publish | mỗi 10 phút | đăng các bài tới giờ |

Trên Vercel Pro hoặc self-host VPS, có thể dùng `vercel.json` hoặc container `cron` trong `docker-compose.yml` — đều đã sẵn.

---

## Trạng thái hoàn thiện

| Hạng mục | Trạng thái |
|---|---|
| DB schema + ERD + seed + RLS | ✅ Hoàn chỉnh |
| Crawler (RSS + HTML config-driven) + dedup | ✅ Hoàn chỉnh |
| AI generator + moderation + 5 template + provider pattern | ✅ Hoàn chỉnh |
| Facebook Graph API provider | ✅ Hoàn chỉnh |
| Facebook Playwright provider | 🟡 Khung + luồng chính (selector FB cần kiểm thử thực tế) |
| Cron jobs (crawl/generate/publish) | ✅ Hoàn chỉnh |
| API: sources CRUD, drafts approve/reject | ✅ Hoàn chỉnh |
| UI: Dashboard + Drafts | ✅ 2 màn mẫu hoàn chỉnh |
| UI: Sources / News / Calendar / Settings | 🟡 Có cấu trúc + wireframe, cần dựng theo mẫu Drafts |
| Supabase Auth (login + middleware bảo vệ route) | 🟡 Hướng dẫn có sẵn, cần thêm `@supabase/ssr` + middleware |
| Mã hoá secret trong `settings` | 🟡 Cột `is_secret` sẵn sàng; cần thêm `lib/crypto.ts` (AES-GCM với `SETTINGS_ENCRYPTION_KEY`) |

### Việc nên làm tiếp (gợi ý thứ tự)
1. Thêm `@supabase/ssr` + `middleware.ts` để bảo vệ `(dashboard)` và thay `defaultTenantId()` bằng tenant của user đăng nhập.
2. Dựng nốt 4 màn hình UI còn lại theo khuôn `drafts/page.tsx`.
3. Thêm `lib/crypto.ts` mã hoá API key trước khi lưu `settings`.
4. Hoàn thiện selector Playwright nếu bắt buộc đăng Group.
5. Khi lên SaaS: cron lặp qua tất cả `tenants` thay vì `DEFAULT_TENANT_ID`.
