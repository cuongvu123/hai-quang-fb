# Wireframe · Danh sách màn hình · User flow

## Danh sách màn hình (6)

| # | Màn hình | Route | Vai trò |
|---|---|---|---|
| 1 | Dashboard | `/dashboard` | KPI: số nguồn, tin đã crawl, bài chờ duyệt, bài đã đăng |
| 2 | Sources | `/sources` | CRUD nguồn dữ liệu (6 loại) |
| 3 | News | `/news` | Danh sách tin đã thu thập, lọc theo nguồn/ngày |
| 4 | AI Drafts | `/drafts` | Xem · sửa · duyệt · từ chối bài AI |
| 5 | Calendar | `/calendar` | Lịch đăng bài (ngày/giờ/trạng thái) |
| 6 | Settings | `/settings` | Claude key · OpenAI key · Facebook · prompt template |

## Wireframe (ASCII)

### Dashboard
```
┌───────────────────────────────────────────────┐
│ Tổng quan                                       │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐            │
│ │Nguồn │ │ Tin  │ │Chờ   │ │ Đã   │            │
│ │  4   │ │ 128  │ │duyệt3│ │đăng42│            │
│ └──────┘ └──────┘ └──────┘ └──────┘            │
│ [Biểu đồ bài đăng theo tuần]                    │
└───────────────────────────────────────────────┘
```

### AI Drafts (màn quan trọng nhất)
```
┌───────────────────────────────────────────────┐
│ Bài AI chờ duyệt                                │
│ ┌─────────────────────────────────────────┐    │
│ │ [utilities][urgent]  điểm: 96%           │    │
│ │ ⚡ Thông báo lịch cắt điện...            │    │
│ │ Bà con xã Hải Quang lưu ý nhé...         │    │
│ │ [ Duyệt & lên lịch ]  [ Từ chối ]        │    │
│ └─────────────────────────────────────────┘    │
└───────────────────────────────────────────────┘
```

### Sources
```
┌───────────────────────────────────────────────┐
│ Nguồn dữ liệu              [ + Thêm nguồn ]     │
│ Tên                Loại        Hoạt động  Crawl │
│ Báo Ninh Bình      local_news    ●       3h    │
│ RSS Ninh Bình      rss           ●       3h    │
│ ...                          [sửa] [xoá]        │
└───────────────────────────────────────────────┘
```

### Settings
```
┌───────────────────────────────────────────────┐
│ Cài đặt                                         │
│ AI Provider:  ( ) Claude  ( ) OpenAI            │
│ Claude API Key:   [••••••••]                    │
│ OpenAI API Key:   [••••••••]                    │
│ Facebook target:  [page/group id]               │
│ FB provider:  ( ) Graph API ( ) Playwright      │
│ Prompt template:  [textarea SYSTEM_PROMPT]      │
│                                   [ Lưu ]       │
└───────────────────────────────────────────────┘
```

## User flow chính (admin)

```
Đăng nhập (Supabase Auth)
   │
   ▼
Dashboard ── thấy "3 bài chờ duyệt"
   │
   ▼
Mở AI Drafts → đọc bài → (tuỳ chọn) Sửa nội dung
   │
   ├─ Từ chối → nhập lý do → draft.status = rejected
   │
   └─ Duyệt → chọn ngày/giờ + provider
              → draft.status = scheduled
              → tạo bản ghi publishing_schedule
   │
   ▼ (cron/publish mỗi 5 phút)
Tới giờ → Facebook Publisher đăng → ghi publishing_logs
   │
   ▼
draft.status = published  (hoặc failed nếu lỗi, tự retry tối đa 3 lần)
```

## Flow tự động (hệ thống, không cần người)

```
cron/crawl   (mỗi giờ)      → thu tin mới, chống trùng → crawled_news
cron/generate(theo lịch)    → AI sinh bài + moderation  → ai_drafts(pending)
                                                          (dừng, chờ người duyệt)
```
