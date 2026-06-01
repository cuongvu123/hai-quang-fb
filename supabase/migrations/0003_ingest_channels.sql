-- =====================================================================
-- 0003 — Kênh nạp tin thủ công (non-tech friendly)
-- Thêm 3 loại nguồn mới để nạp tin ngoài crawler RSS/HTML:
--   google_sheet  : đọc Google Sheet "publish to web" (CSV) — gõ tin trực tiếp
--   manual_upload : tải ảnh/PDF lên, Gemini trích xuất nội dung
--   telegram      : forward tin nhắn/ảnh vào bot Telegram
-- =====================================================================
-- LƯU Ý: `alter type ... add value` KHÔNG chạy được trong transaction cùng
-- lúc với câu dùng giá trị mới. Supabase SQL Editor chạy từng câu nên OK.
-- Chạy file này SAU 0001/0002.

alter type source_type add value if not exists 'google_sheet';
alter type source_type add value if not exists 'manual_upload';
alter type source_type add value if not exists 'telegram';
