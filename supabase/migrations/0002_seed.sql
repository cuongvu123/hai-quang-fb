-- =====================================================================
-- Seed data demo cho Xã Hải Quang
-- Chạy SAU 0001_init.sql. Tạo user qua Supabase Auth rồi map ở bước cuối.
-- =====================================================================

-- 1) Tenant
insert into tenants (id, name, slug, province, fb_group_id, timezone) values
  ('11111111-1111-1111-1111-111111111111',
   'Xã Hải Quang', 'hai-quang', 'Ninh Bình', '0000000000000000', 'Asia/Ho_Chi_Minh');

-- 2) Sources mẫu
insert into sources (tenant_id, name, url, type, config, crawl_interval_min) values
  ('11111111-1111-1111-1111-111111111111', 'Cổng TTĐT tỉnh Ninh Bình',
   'https://ninhbinh.gov.vn', 'province_website',
   '{"listSelector":".news-item","titleSelector":"h3 a","linkSelector":"h3 a","contentSelector":".detail-content"}', 720),

  ('11111111-1111-1111-1111-111111111111', 'Báo Ninh Bình điện tử',
   'https://baoninhbinh.org.vn', 'local_news',
   '{"listSelector":"article","titleSelector":"h2 a","linkSelector":"h2 a","contentSelector":".article-body"}', 360),

  ('11111111-1111-1111-1111-111111111111', 'RSS Báo Ninh Bình',
   'https://baoninhbinh.org.vn/rss/home.rss', 'rss', '{}', 180),

  ('11111111-1111-1111-1111-111111111111', 'RSS Cổng TTĐT xã Hải Quang',
   'https://haiquang.ninhbinh.gov.vn/rss.aspx', 'rss', '{}', 180),

  ('11111111-1111-1111-1111-111111111111', 'UBND huyện (website xã)',
   'https://example-xa-haiquang.gov.vn', 'gov_website',
   '{"listSelector":".post","titleSelector":".post-title a","linkSelector":".post-title a","contentSelector":".post-content"}', 720);

-- 3) Tin demo (đã crawl)
insert into crawled_news (tenant_id, source_id, title, content, summary, published_at, origin_url, image_url, dedup_hash)
select
  '11111111-1111-1111-1111-111111111111', s.id,
  'Lịch cắt điện luân phiên khu vực xã Hải Quang tuần này',
  'Điện lực thông báo lịch tạm ngừng cấp điện để bảo trì lưới điện tại một số thôn thuộc xã Hải Quang từ 8h00 đến 11h00 các ngày trong tuần...',
  'Thông báo lịch cắt điện bảo trì tại xã Hải Quang.',
  now() - interval '1 day',
  'https://example-xa-haiquang.gov.vn/thong-bao/cat-dien-tuan',
  null,
  encode(digest('https://example-xa-haiquang.gov.vn/thong-bao/cat-dien-tuan' || '|lich cat dien luan phien khu vuc xa hai quang tuan nay', 'sha256'), 'hex')
from sources s
where s.tenant_id = '11111111-1111-1111-1111-111111111111' and s.type = 'gov_website'
limit 1;

-- 4) Draft demo do AI sinh (đã qua moderation, chờ duyệt)
insert into ai_drafts (tenant_id, title, body, category, template, status, moderation, ai_provider, ai_model)
values (
  '11111111-1111-1111-1111-111111111111',
  '⚡ Thông báo lịch cắt điện bảo trì tuần này',
  E'Bà con xã Hải Quang lưu ý nhé! ⚡\n\nĐiện lực vừa thông báo lịch tạm ngừng cấp điện để bảo trì lưới điện tại một số thôn trong xã.\n\n🕗 Thời gian: 8h00 – 11h00 các ngày trong tuần\n📍 Khu vực: một số thôn thuộc xã Hải Quang\n\nMong bà con chủ động sắp xếp công việc và sinh hoạt. Mọi thắc mắc xin liên hệ điện lực địa phương để được hỗ trợ. 🙏',
  'utilities', 'urgent', 'pending',
  '{"passed":true,"flags":[],"score":0.96}',
  'gemini', 'gemini-2.5-flash-lite'
);

-- 4b) Cấu hình AI mặc định: dùng Gemini free tier.
insert into settings (tenant_id, key, value, is_secret) values
  ('11111111-1111-1111-1111-111111111111', 'ai_provider', 'gemini', false),
  ('11111111-1111-1111-1111-111111111111', 'gemini_model', 'gemini-2.5-flash-lite', false);
-- Lưu ý: gemini_api_key đặt qua màn Settings (is_secret=true) hoặc:
-- insert into settings values (..., 'gemini_api_key', '<paste-key>', true);

-- 5) GHI CHÚ map user:
-- Sau khi tạo tài khoản qua Supabase Auth (Dashboard > Authentication),
-- lấy uid rồi chạy:
-- insert into users (id, tenant_id, email, full_name, role)
-- values ('<auth-uid>', '11111111-1111-1111-1111-111111111111',
--         'admin@haiquang.local', 'Quản trị viên', 'owner');
