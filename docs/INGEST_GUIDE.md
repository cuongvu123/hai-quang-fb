# Hướng dẫn nạp tin (cho người không rành kỹ thuật)

Ngoài việc crawler tự thu tin từ RSS/website, hệ thống có **3 kênh nạp tin thủ công**.
Tin nạp vào đều đi tiếp qua đúng quy trình cũ: **AI soạn bài → kiểm duyệt → admin duyệt → đăng**.
AI **không bao giờ** tự đăng khi chưa duyệt.

| Kênh | Hợp với ai | Đọc được gì |
|---|---|---|
| 📥 **Tải lên ảnh/PDF** | Có sẵn ảnh chụp thông báo, file văn bản | Ảnh, PDF + ghi chú |
| 📊 **Google Sheet** | Muốn gõ nhiều tin đều đặn, không cần đăng nhập app | Văn bản theo dòng |
| 💬 **Bot Telegram** | Thao tác nhanh trên điện thoại | Tin nhắn chữ + ảnh/PDF |

> Các kênh đọc ảnh/PDF dùng **Gemini** (model đa phương thức). Hãy đảm bảo trong
> màn **Cài đặt**, `ai_provider = gemini` và đã nhập `gemini_api_key`.

---

## 1. 📥 Tải lên ảnh/PDF (dễ nhất)

1. Mở app → menu **Nạp tin nhanh** (`/ingest`).
2. Chọn ảnh chụp thông báo / file PDF (chụp thẳng từ điện thoại được).
3. (Tuỳ chọn) gõ thêm ghi chú.
4. Bấm **Nạp tin** → AI đọc nội dung → vào **Bài AI chờ duyệt**.

Giới hạn: tối đa 10 tệp, tổng ~18MB mỗi lần.

---

## 2. 📊 Google Sheet làm "sổ tin"

**Bước A — tạo Sheet:** một Google Sheet với hàng đầu là tên cột (đặt tên cột linh hoạt,
có dấu hay không đều được):

| title (tiêu đề) | content (nội dung) | date (ngày) | image (ảnh) | link (nguồn) |
|---|---|---|---|---|
| Lịch cắt điện 12/6 | Từ 8h–11h khu vực thôn Đông… | 2026-06-10 | https://…/anh.jpg | https://… |

- **Bắt buộc**: có `title` *hoặc* `content`. Các cột còn lại tuỳ chọn.
- Mỗi dòng = 1 tin. Dòng trống sẽ bị bỏ qua.

**Bước B — công khai Sheet:** trong Google Sheets:
`File → Share → Publish to web → Publish`. (Hoặc đặt quyền "Anyone with the link – Viewer".)

**Bước C — thêm vào app:** mở menu **Nguồn dữ liệu**, thêm nguồn mới:
- **Loại**: `google_sheet`
- **URL**: dán link Sheet (link `/edit` bình thường cũng được — hệ thống tự đổi sang dạng CSV).

Sau đó crawler chạy theo lịch (mỗi giờ) sẽ tự đọc các dòng mới. Muốn chạy ngay, gọi thủ công:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<domain>/api/cron/crawl
```

> Tin trùng (cùng tiêu đề + link) sẽ tự bỏ qua, nên cứ để nguyên dòng cũ trong Sheet.

---

## 3. 💬 Bot Telegram (nhanh trên điện thoại)

**Bước A — tạo bot:** nhắn [@BotFather](https://t.me/BotFather) → `/newbot` → lấy **token**.

**Bước B — đặt biến môi trường** (Vercel Project Settings hoặc `.env`):

```
TELEGRAM_BOT_TOKEN=123456:ABC...        # token từ BotFather
TELEGRAM_WEBHOOK_SECRET=chuoi-ngau-nhien-bạn-tự-đặt
```

**Bước C — đăng ký webhook (chạy 1 lần):**

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<domain>/api/ingest/telegram&secret_token=<SECRET>"
```

**Dùng:** mở bot trong Telegram rồi:
- Gửi **đoạn chữ** (dòng đầu = tiêu đề, phần sau = nội dung), hoặc
- Gửi/forward **ảnh** hoặc **file PDF** (có thể kèm caption).

Bot trả lời xác nhận đã nhận. Tin vào thẳng **Bài AI chờ duyệt**.

> **Zalo OA**: làm tương tự (webhook của Zalo Official Account trỏ vào một route mới
> `/api/ingest/zalo` theo đúng khuôn Telegram). Do Zalo yêu cầu duyệt OA nên chưa bật sẵn;
> khi cần có thể sao chép `telegram/route.ts` và đổi phần đọc payload.

---

## Tin nạp vào rồi đi đâu?

```
Nạp tin (3 kênh) ─► crawled_news ─► (cron/generate) AI soạn bài ─► moderation
        ─► Bài AI chờ duyệt ─► admin duyệt + lên lịch ─► đăng Facebook
```

Mỗi kênh tạo một "nguồn hệ thống" riêng trong **Nguồn dữ liệu**
(`Tải lên thủ công`, `Nạp tin qua Telegram`) để bạn tiện theo dõi, các nguồn này
không tự crawl.
