// Domain types — phản chiếu schema DB, dùng chung toàn app.

export type SourceType =
  | 'local_website' | 'province_website' | 'gov_website'
  | 'rss' | 'facebook_page' | 'local_news'
  // Kênh nạp tin thủ công (non-tech friendly)
  | 'google_sheet' | 'manual_upload' | 'telegram';

export type NewsCategory =
  | 'admin_notice' | 'education' | 'health' | 'culture' | 'sports'
  | 'traffic' | 'utilities' | 'security' | 'recruitment'
  | 'community' | 'uncategorized';

export type DraftStatus =
  | 'generated' | 'pending' | 'approved' | 'rejected'
  | 'scheduled' | 'published' | 'failed';

export type PostTemplate =
  | 'weekly_open' | 'midweek' | 'weekend' | 'urgent' | 'event';

export type ScheduleStatus = 'queued' | 'publishing' | 'done' | 'error' | 'canceled';
export type PublishProvider = 'graph_api' | 'playwright';

export interface Source {
  id: string;
  tenantId: string;
  name: string;
  url: string;
  type: SourceType;
  isActive: boolean;
  config: SourceConfig;
  crawlIntervalMin: number;
  lastCrawledAt: string | null;
}

/** CSS selector config cho website thường (rss bỏ trống). */
export interface SourceConfig {
  listSelector?: string;
  titleSelector?: string;
  linkSelector?: string;
  contentSelector?: string;
  imageSelector?: string;
  dateSelector?: string;
}

export interface CrawledNews {
  id: string;
  tenantId: string;
  sourceId: string;
  title: string;
  content: string;
  summary: string | null;
  publishedAt: string | null;
  originUrl: string;
  imageUrl: string | null;
  dedupHash: string;
}

export interface ModerationResult {
  passed: boolean;
  flags: ModerationFlag[];
  score: number; // 0..1, càng cao càng an toàn/chất lượng
}

export type ModerationFlag =
  | 'duplicate' | 'unclear_source' | 'too_old'
  | 'inappropriate_language' | 'sensitive_content';

export interface AiDraft {
  id: string;
  tenantId: string;
  title: string;
  body: string;
  category: NewsCategory;
  template: PostTemplate;
  status: DraftStatus;
  sourceNewsIds: string[];
  imageUrls: string[];
  moderation: ModerationResult;
  aiProvider: string | null;
  aiModel: string | null;
}

/** Tin chuẩn hoá trả về từ mọi parser của crawler. */
export interface ParsedItem {
  title: string;
  content: string;
  publishedAt: Date | null;
  originUrl: string;
  imageUrl: string | null;
}

/** Kết quả sinh nội dung từ AI provider. */
export interface GeneratedPost {
  title: string;
  body: string;
  category: NewsCategory;
}

/** Một tệp đa phương thức (ảnh/PDF) gửi cho AI trích xuất. */
export interface MediaFile {
  mimeType: string;   // 'image/jpeg' | 'image/png' | 'application/pdf' ...
  dataBase64: string; // nội dung tệp đã mã hoá base64 (không kèm tiền tố data:)
}

/** Tin trích xuất được từ ảnh/PDF/văn bản tự do (chuẩn hoá như ParsedItem). */
export interface ExtractedItem {
  title: string;
  content: string;
  publishedAt: string | null; // ISO date nếu nhận diện được, ngược lại null
}
