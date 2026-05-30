# Hướng dẫn deploy hoàn toàn miễn phí (0đ/tháng)

Stack: **Vercel Hobby + Supabase Free + Gemini Free + GitHub Actions Cron**.

## 0. Yêu cầu

- Tài khoản: GitHub, Vercel (đăng nhập GitHub), Supabase, Google AI Studio, Facebook (Page).
- Không cần thẻ tín dụng.

## 1. Tạo Supabase project

1. Vào https://supabase.com → **New project** → đặt mật khẩu DB.
2. Mở **SQL Editor**, chạy lần lượt 2 file: `supabase/migrations/0001_init.sql` rồi `0002_seed.sql`.
3. **Authentication > Users > Add user** → tạo email/password admin. Copy `uid`.
4. Chạy ô SQL:
   ```sql
   insert into users (id, tenant_id, email, full_name, role)
   values ('<uid-vừa-copy>', '11111111-1111-1111-1111-111111111111',
           'admin@haiquang.local', 'Quản trị viên', 'owner');
   ```
5. **Project Settings > API** → copy 3 giá trị: `URL`, `anon key`, `service_role key`.
6. **Project Settings > Database > Connection string (URI)** → copy để dùng cho backup workflow.

## 2. Lấy Gemini API key (miễn phí, không thẻ)

1. Vào https://aistudio.google.com/apikey → **Create API key** → copy.
2. Sau khi deploy xong, mở `/settings` trên app và dán vào ô **Gemini API Key**, hoặc chạy SQL:
   ```sql
   insert into settings values
     ('11111111-1111-1111-1111-111111111111', 'gemini_api_key', '<key>', true);
   ```

## 3. Push code lên GitHub

```bash
cd hai-quang-ai
git init && git add . && git commit -m "init"
gh repo create hai-quang-ai --public --source=. --push
```

> Để repo **public** để GitHub Actions miễn phí không giới hạn phút.
> Nếu muốn private cũng được — job cron rất nhẹ, tốn ~360 phút/tháng (free 2000).

## 4. Deploy Vercel

1. Vào https://vercel.com/new → chọn repo `hai-quang-ai` → **Import**.
2. **Environment Variables**, thêm:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `DEFAULT_TENANT_ID = 11111111-1111-1111-1111-111111111111`
   - `CRON_SECRET = <chuỗi ngẫu nhiên dài>` (`openssl rand -hex 32`)
3. **Deploy**. Ghi nhớ URL kết quả, ví dụ `https://hai-quang-ai.vercel.app`.

## 5. Bật GitHub Actions cron

Repo → **Settings > Secrets and variables > Actions > New repository secret**, thêm:

| Tên | Giá trị |
|---|---|
| `APP_URL` | `https://hai-quang-ai.vercel.app` (không có `/` cuối) |
| `CRON_SECRET` | Đúng chuỗi đã đặt trên Vercel |
| `DATABASE_URL` | Connection string Supabase (cho backup) |

Workflow `cron-pinger` tự kích hoạt theo lịch:
- Crawl: mỗi giờ
- Generate: 13:30 VN, T2/T4/T5/T7 (3–5 bài/tuần)
- Publish: mỗi 10 phút

Test thủ công: tab **Actions** → chọn workflow → **Run workflow**.

## 6. Cấu hình Facebook (Page, không phải Group)

> Graph API hiện không cho app thường đăng vào Group. Khuyến nghị dùng **Page**:
> tạo 1 Page cho xã, ghim ở mô tả Group cộng đồng, đăng tự động trên Page,
> share thủ công sang Group (hoặc autoshare bằng tính năng Page-to-Group của FB).

1. https://developers.facebook.com → **My Apps > Create App** → loại "Business".
2. Thêm **Facebook Login** + **Pages API**.
3. **Graph API Explorer** → chọn app → permissions: `pages_manage_posts`, `pages_read_engagement` → **Generate Access Token**.
4. Đổi sang **long-lived Page token** (60 ngày): https://developers.facebook.com/tools/debug/accesstoken/
5. Lấy **Page ID** ở trang About của Page.
6. Mở `/settings` trên app, điền:
   - `fb_target_id` = Page ID
   - `fb_page_token` = long-lived token
   - `provider` mặc định: `graph_api`

## 7. Backup DB hàng tuần

Workflow `db-backup` chạy 01:00 sáng CN giờ VN, dump `.sql.gz` vào artifact GitHub (giữ 90 ngày).
Vào **Actions > db-backup > <latest run> > Artifacts** để tải về.

## Tổng kết chi phí

| Hạng mục | Mỗi tháng |
|---|---|
| Vercel Hobby | 0đ |
| Supabase Free | 0đ |
| Gemini Flash-Lite | 0đ |
| GitHub Actions (public repo) | 0đ |
| Facebook Graph API | 0đ |
| Domain (tuỳ chọn .vn) | ~20k/tháng nếu muốn |
| **Tổng** | **0đ** (hoặc ~20k nếu muốn tên miền riêng) |

## Khi nào cần nâng cấp?

- Gemini đạt > 1000 req/ngày → trả phí Gemini (~$0.075/1M input) hoặc đổi Claude.
- Supabase DB > 500MB hoặc bandwidth > 5GB → Pro $25/tháng.
- Muốn cron < 5 phút hoặc latency tốt hơn → Vercel Pro $20/tháng (hoặc VPS).
- Muốn nhiều xã/phường → kích hoạt sẵn `tenant_id` đa tenant, vẫn miễn phí cho đến khi đụng limit.
