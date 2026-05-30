# Cài đặt từ máy tính → vận hành trên điện thoại

Hướng dẫn tất tần tật từ A đến Z. Mỗi bước có **Kết quả mong đợi** để bạn biết đã làm đúng.

**Thời gian**: ~90 phút lần đầu. Sau đó chỉ dùng điện thoại.
**Yêu cầu**: 1 máy tính bất kỳ (Mac / Windows / Linux), kết nối Internet.

---

## Phần 0 · Chuẩn bị tài khoản (5 phút, làm trên điện thoại trước cũng được)

Tạo trước 5 tài khoản (đều miễn phí, không cần thẻ):

| Dịch vụ | URL | Đăng ký bằng |
|---|---|---|
| GitHub | github.com/signup | Email |
| Vercel | vercel.com/signup | Login bằng GitHub |
| Supabase | supabase.com → "Start your project" | Login bằng GitHub |
| Google AI Studio | aistudio.google.com | Tài khoản Google |
| Facebook Developers | developers.facebook.com | Tài khoản Facebook |

---

## Phần 1 · Cài Node.js + Git trên máy (10 phút, lần đầu)

### Mac
```bash
# Mở Terminal (Cmd+Space → gõ "Terminal")
# Cài Homebrew nếu chưa có:
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Cài Git + Node:
brew install git node@20
```

### Windows
1. Tải Node.js LTS tại https://nodejs.org → bấm "Recommended For Most Users" → cài (next next finish)
2. Tải Git tại https://git-scm.com/download/win → cài (giữ tất cả tuỳ chọn mặc định)
3. Mở **PowerShell** (Start menu → gõ "powershell")

### Linux
```bash
sudo apt update && sudo apt install -y git nodejs npm
```

### Kiểm tra
```bash
node --version   # phải >= v20
git --version
```
**Kết quả mong đợi**: Hiển thị số version. Nếu báo "command not found" → cài lại.

---

## Phần 2 · Lấy code và đẩy lên GitHub (15 phút)

### 2.1 Tải project
- Trong cuộc chat này, tải file `hai-quang-ai.zip` về máy
- Giải nén ra thư mục (vd: `~/Documents/hai-quang-ai`)

### 2.2 Mở terminal trong thư mục project
```bash
cd ~/Documents/hai-quang-ai     # Mac/Linux
# Windows: cd C:\Users\<bạn>\Documents\hai-quang-ai
```

### 2.3 Khởi tạo Git
```bash
git init
git add .
git commit -m "Initial: Hai Quang community AI"
```
**Kết quả mong đợi**: Hiện "X files changed, Y insertions" (X khoảng 50+).

### 2.4 Tạo repo trên GitHub (mở trình duyệt)
- Vào https://github.com/new
- **Repository name**: `hai-quang-ai`
- Chọn **Public** *(để GitHub Actions miễn phí không giới hạn phút — khuyên nên Public)*
- **KHÔNG** tick "Add a README file" (project đã có README rồi)
- Bấm **Create repository**

### 2.5 Push code lên
GitHub sẽ hiện block "...or push an existing repository". Copy 3 lệnh đó, ví dụ:
```bash
git remote add origin https://github.com/<username>/hai-quang-ai.git
git branch -M main
git push -u origin main
```
Có thể GitHub hỏi đăng nhập — dùng **Personal Access Token** thay password:
- github.com/settings/tokens → "Generate new token (classic)" → tick `repo` → tạo → copy → dán vào terminal khi hỏi password.

**Kết quả mong đợi**: Vào URL repo trên GitHub thấy đầy đủ file (README, src/, supabase/, .github/, v.v.).

---

## Phần 3 · Tạo Supabase project (15 phút)

### 3.1 Tạo project
- https://supabase.com/dashboard → **New project**
- **Name**: `hai-quang`
- **Database password**: tự đặt mạnh, **GHI LẠI** vào Notes (sẽ không thấy lại)
- **Region**: `Southeast Asia (Singapore)` ← chọn cái này cho latency tốt tại VN
- **Pricing plan**: `Free`
- Bấm **Create new project** → đợi ~2 phút

### 3.2 Chạy schema (tạo bảng)
- Sidebar trái → **SQL Editor** → **New query**
- Mở file `supabase/migrations/0001_init.sql` trên máy (mở bằng Notepad / TextEdit / VSCode)
- **Copy toàn bộ** nội dung file
- Paste vào ô SQL Editor → bấm **Run** (góc dưới phải) hoặc `Cmd/Ctrl + Enter`

**Kết quả mong đợi**: Dòng xanh "Success. No rows returned".

### 3.3 Chạy seed (dữ liệu mẫu)
- **New query** → mở `0002_seed.sql` → copy → paste → **Run**
- **Kết quả mong đợi**: "Success. No rows returned"

### 3.4 Tạo tài khoản admin
- Sidebar → **Authentication** → **Users** → **Add user** → **Create new user**
- **Email**: email thật bạn dùng (để đăng nhập admin sau này)
- **Password**: tự đặt, ghi lại
- ⚠️ **Auto Confirm User**: bật ON (để không phải xác nhận qua email)
- Bấm **Create user**
- Sau khi tạo, click vào user vừa tạo → **copy UID** (chuỗi dài kiểu `a1b2c3d4-...`)

### 3.5 Gắn admin vào tenant
- **SQL Editor** → **New query**:
```sql
insert into users (id, tenant_id, email, full_name, role)
values ('<DÁN-UID-VỪA-COPY>',
        '11111111-1111-1111-1111-111111111111',
        '<email-vừa-tạo>',
        'Quản trị viên',
        'owner');
```
- Run. **Kết quả**: "Success. No rows returned".

### 3.6 Copy 4 thông tin Supabase (cần cho bước sau)
- Sidebar → **Project Settings** (icon răng cưa) → **API**
- Lưu vào Notes tạm 3 dòng:
  - **Project URL**: `https://xxxxx.supabase.co`
  - **anon public** key: `eyJhbG...` (dài)
  - **service_role secret** key: `eyJhbG...` (KHÔNG BAO GIỜ để lộ ra client)
- **Project Settings** → **Database** → kéo xuống **Connection string** → tab **URI** → copy:
  - **DATABASE URL**: `postgresql://postgres.xxx:[YOUR-PASSWORD]@aws...` — thay `[YOUR-PASSWORD]` bằng password đã ghi ở 3.1

---

## Phần 4 · Lấy Gemini API key miễn phí (3 phút)

- https://aistudio.google.com/apikey
- Đăng nhập Google
- **Create API key** → chọn "Create API key in new project"
- Copy key (bắt đầu `AIzaSy...`) → lưu vào Notes

---

## Phần 5 · Deploy lên Vercel (10 phút)

### 5.1 Import từ GitHub
- https://vercel.com/new
- Tab **Import Git Repository** → tìm `hai-quang-ai` → **Import**

### 5.2 Cấu hình environment variables
- Mở phần **Environment Variables**, thêm 5 biến (copy từ Notes ở Phần 3.6):

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public key |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role secret key |
| `DEFAULT_TENANT_ID` | `11111111-1111-1111-1111-111111111111` |
| `CRON_SECRET` | Tự tạo, vd: chạy `openssl rand -hex 32` trong terminal |

### 5.3 Deploy
- Bấm **Deploy** → đợi ~2-3 phút
- Khi build xong: copy URL kết quả (vd `https://hai-quang-ai-abc123.vercel.app`)

### 5.4 Verify
- Mở URL vừa deploy trên trình duyệt
- Tự redirect đến `/dashboard`
- **Kết quả mong đợi**: thấy "Tổng quan" + 4 thẻ thống kê (số 0 hoặc 1)
- ❌ Nếu thấy lỗi → vào Vercel project → **Deployments** → click deployment mới nhất → **View Function Logs** xem chi tiết. Thường do thiếu env var → set lại rồi **Redeploy**.

---

## Phần 6 · Bật cron miễn phí qua GitHub Actions (5 phút)

### 6.1 Thêm GitHub Secrets
- Vào repo GitHub → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**
- Thêm 3 secret:

| Name | Value |
|---|---|
| `APP_URL` | URL Vercel (không có `/` cuối, vd `https://hai-quang-ai-abc.vercel.app`) |
| `CRON_SECRET` | Đúng chuỗi đã đặt ở 5.2 |
| `DATABASE_URL` | URI Supabase ở 3.6 |

### 6.2 Bật và test workflow
- Tab **Actions** trên GitHub repo
- Nếu hỏi enable workflows: chọn **"I understand my workflows, go ahead and enable them"**
- Trong list bên trái: chọn **cron-pinger** → bấm **Run workflow** (nút xám bên phải) → **Run workflow** (nút xanh)
- Đợi ~10 giây, refresh → bấm vào run mới → mở job **ping**
- Mở step **Call endpoint**
- **Kết quả mong đợi**: hiện JSON kiểu `{"ok":true,"inserted":0,...}` hoặc `{"ok":true,"reports":[...]}`

---

## Phần 7 · Lưu Gemini key vào DB (2 phút)

Quay lại Supabase **SQL Editor**:
```sql
insert into settings values
  ('11111111-1111-1111-1111-111111111111', 'gemini_api_key', '<DÁN-GEMINI-KEY>', true)
on conflict (tenant_id, key) do update set value = excluded.value;
```
Run. Xong.

---

## Phần 8 · Cấu hình Facebook Page (20 phút — bước dài nhất)

> Lý do dùng **Page** không phải **Group**: từ 2024+ Facebook không cho app thường đăng tự động vào Group. Page có thể đăng tự động qua Graph API, và bạn ghim Page lên Group cộng đồng, hoặc dùng tính năng auto-share Page-to-Group của FB.

### 8.1 Tạo Page (bỏ qua nếu đã có)
- facebook.com (web hoặc app) → menu ☰ → **Pages** → **Create new Page**
- **Tên**: ví dụ "Cổng tin xã Hải Quang"
- **Phân loại**: "Tổ chức cộng đồng" hoặc "Cơ quan chính phủ"
- Hoàn tất → vào Page mới
- Tab **About** → cuối trang → **Page transparency** → copy **Page ID** (chuỗi số dài)

### 8.2 Tạo Facebook App
- https://developers.facebook.com/apps → **Create App**
- Use case: **Other** → tiếp → **Business** → tiếp
- App name: "Hai Quang Bot" → email → Business account: bỏ trống được → **Create app**
- Trong dashboard app, thêm sản phẩm: **Facebook Login for Business** (chỉ cần "Set up" nó là được, không cần config)

### 8.3 Lấy Page Access Token
- https://developers.facebook.com/tools/explorer/
- **Meta App** (trên cùng): chọn app vừa tạo
- **User or Page**: dropdown chọn **Get Page Access Token** → chọn Page vừa tạo
- **Permissions** (bấm + bên cạnh): thêm 3 quyền:
  - `pages_show_list`
  - `pages_read_engagement`
  - `pages_manage_posts`
- **Generate Access Token** → cho phép (hộp thoại popup)
- Copy token hiển thị (rất dài)

### 8.4 Đổi sang long-lived token (60 ngày)
Token vừa tạo chỉ sống 1-2 giờ. Phải đổi:
- https://developers.facebook.com/tools/debug/accesstoken/
- Paste token → **Debug**
- Kéo xuống cuối → **Extend Access Token** → đăng nhập lại nếu hỏi
- Copy **token mới** (long-lived, sống 60 ngày)

### 8.5 Lưu vào DB
Supabase SQL Editor:
```sql
insert into settings values
  ('11111111-1111-1111-1111-111111111111', 'fb_page_token', '<DÁN-LONG-LIVED-TOKEN>', true),
  ('11111111-1111-1111-1111-111111111111', 'fb_target_id', '<DÁN-PAGE-ID>', false)
on conflict (tenant_id, key) do update set value = excluded.value;
```

---

## Phần 9 · Test toàn bộ luồng end-to-end (10 phút)

### 9.1 Crawl thử
GitHub Actions → cron-pinger → **Run workflow** → để mặc định → Run.
*(Hoặc chạy trên máy:)*
```bash
curl -H "Authorization: Bearer <CRON_SECRET>" https://<your>.vercel.app/api/cron/crawl
```
Vào dashboard → "Tin đã thu thập" → có tin mới (hoặc seed sẵn).

### 9.2 Sinh bài thử
```bash
curl -H "Authorization: Bearer <CRON_SECRET>" https://<your>.vercel.app/api/cron/generate
```
Vào "Bài AI chờ duyệt" → có bài mới do Gemini sinh.

### 9.3 Duyệt + đăng thử
- Mở `/drafts` → bấm **Duyệt & lên lịch (sau 1h)** cho 1 bài
- Để test ngay không đợi 1h, vào Supabase SQL:
```sql
update publishing_schedule
set scheduled_at = now() - interval '1 minute'
where status = 'queued';
```
- Chạy publish cron:
```bash
curl -H "Authorization: Bearer <CRON_SECRET>" https://<your>.vercel.app/api/cron/publish
```
- Mở Facebook Page → **thấy bài đã đăng** 🎉

---

## ✅ Phần 10 · Dùng hệ thống hoàn toàn trên điện thoại

Sau khi cài xong, tắt máy tính, mọi việc làm trên điện thoại.

### Mỗi ngày (~3 phút)
1. Mở Safari/Chrome → vào `https://hai-quang-ai-xxx.vercel.app/login`
2. Đăng nhập (email + password ở Phần 3.4)
3. **Add to Home Screen** (Safari: ⤴️ Share → "Thêm vào màn hình chính") để có icon như app
4. Mở app → **Bài AI chờ duyệt**:
   - Đọc bài AI sinh
   - Sửa nhẹ trên ô textarea (nếu muốn)
   - Bấm **Duyệt & lên lịch** (mặc định đăng sau 1h)
   - Hoặc **Từ chối** với lý do
5. Xong. Tới giờ schedule → tự đăng FB.

### Tự động chạy nền (bạn không cần làm gì)
- ⏰ Mỗi giờ: crawler thu tin mới từ các nguồn
- 📝 T2/T4/T5/T7 lúc 13:30 VN: AI sinh bài mới
- 📤 Mỗi 10 phút: scan + đăng các bài tới giờ
- 💾 Tối CN: backup DB tự động lưu artifact GitHub

### Thao tác phổ biến trên điện thoại
| Việc | Đi đâu |
|---|---|
| Xem tổng quan | `/dashboard` |
| Duyệt bài AI | `/drafts` |
| Thêm/xoá nguồn | `/sources` *(chưa có UI, dùng Supabase Table Editor tạm)* |
| Cài đặt key | `/settings` *(chưa có UI, dùng Supabase SQL tạm)* |
| Xem tin đã đăng | Facebook Page hoặc `/calendar` |

> 🟡 *Note: 4 màn `/sources`, `/news`, `/calendar`, `/settings` chưa dựng UI đầy đủ (như đã ghi trong README "Trạng thái hoàn thiện"). Tạm thời mọi thao tác CRUD nguồn/setting làm qua Supabase Dashboard trên điện thoại — vẫn được, chỉ là chưa đẹp.*

---

## 🛠 Troubleshooting

### Dashboard báo lỗi 500
→ Vercel **Deployments > Logs**: thường là sai env var. Sửa rồi **Redeploy**.

### Cron không chạy tự động
→ GitHub: workflow chỉ chạy nếu repo có activity trong 60 ngày. Push commit gì cũng được để reset.
→ Verify trong tab **Actions** xem run gần nhất có lỗi không.

### AI không sinh được bài
- Check `gemini_api_key` trong bảng `settings` có đúng không
- Curl trực tiếp `/api/cron/generate` xem JSON lỗi trả về
- Quota Gemini Free: 1000 req/ngày → đủ thừa cho use case này

### Facebook đăng lỗi 190 / OAuthException
→ Token hết hạn (60 ngày) → lấy lại long-lived token ở Phần 8.4 → update DB
→ Cân nhắc viết cron tự refresh token (chưa có, có thể bổ sung)

### Supabase project bị pause
→ Free tier pause sau 7 ngày inactive. Cron của bạn đẩy traffic liên tục → không bị
→ Nếu lỡ pause: Supabase dashboard → **Resume project**

### Bài đăng FB sai format
→ Sửa `SYSTEM_PROMPT` trong `src/lib/ai/templates/prompts.ts` → commit → push → Vercel auto redeploy

---

## Khi nào cần làm gì trên máy tính lại?

Sau setup đầu, bạn chỉ cần dùng máy tính khi:
- Sửa prompt/code → push lên GitHub
- Thêm nguồn dữ liệu mới phức tạp (selector custom) — hoặc làm qua Supabase Table Editor trên phone
- Refresh Facebook token mỗi 60 ngày (làm trên phone cũng được, chỉ paste/copy)
- Dựng nốt 4 màn UI còn thiếu

Mọi việc hằng ngày: chỉ điện thoại.
