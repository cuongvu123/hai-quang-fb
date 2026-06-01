import { adminDb } from './client';
import type {
  Source, CrawledNews, AiDraft, DraftStatus, PostTemplate,
  ModerationResult, NewsCategory,
} from '@/types';

// ----------------------------- SOURCES ------------------------------
export async function listActiveSources(tenantId: string): Promise<Source[]> {
  const { data, error } = await adminDb()
    .from('sources').select('*')
    .eq('tenant_id', tenantId).eq('is_active', true);
  if (error) throw error;
  return (data ?? []).map(mapSource);
}

/**
 * Tìm (hoặc tạo) một nguồn "hệ thống" cho kênh nạp tin thủ công.
 * Dedup theo (tenant_id, url) — trùng unique constraint của bảng sources.
 * Trả về id của nguồn để gắn cho crawled_news.
 */
export async function ensureSource(s: {
  tenantId: string; name: string; url: string; type: string;
}): Promise<string> {
  const existing = await adminDb()
    .from('sources').select('id')
    .eq('tenant_id', s.tenantId).eq('url', s.url).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data.id as string;

  const { data, error } = await adminDb().from('sources').insert({
    tenant_id: s.tenantId, name: s.name, url: s.url, type: s.type,
    is_active: true, config: {}, crawl_interval_min: 525600, // ~1 năm: không crawl tự động
  }).select('id').single();
  if (error) throw error;
  return data!.id as string;
}

export async function markSourceCrawled(sourceId: string): Promise<void> {
  const { error } = await adminDb()
    .from('sources').update({ last_crawled_at: new Date().toISOString() })
    .eq('id', sourceId);
  if (error) throw error;
}

// --------------------------- CRAWLED NEWS ---------------------------
export interface NewNews {
  tenantId: string; sourceId: string; title: string; content: string;
  publishedAt: Date | null; originUrl: string; imageUrl: string | null;
  dedupHash: string;
}

/** Insert nếu chưa tồn tại (unique tenant_id+dedup_hash). true nếu đã thêm. */
export async function insertNewsIfNew(n: NewNews): Promise<boolean> {
  const { error } = await adminDb().from('crawled_news').insert({
    tenant_id: n.tenantId, source_id: n.sourceId, title: n.title,
    content: n.content, published_at: n.publishedAt?.toISOString() ?? null,
    origin_url: n.originUrl, image_url: n.imageUrl, dedup_hash: n.dedupHash,
  });
  if (error) {
    if (error.code === '23505') return false; // unique violation = trùng
    throw error;
  }
  return true;
}

/**
 * Tin gần đây (N ngày) để đưa vào AI sinh bài.
 * Đơn giản hoá: chưa loại trừ tin đã dùng trong draft trước.
 * Khi cần, thêm cột `used_at` trên crawled_news rồi filter ở đây.
 */
export async function unusedNews(tenantId: string, days = 7): Promise<CrawledNews[]> {
  const since = new Date(Date.now() - days * 864e5).toISOString();
  const { data, error } = await adminDb()
    .from('crawled_news').select('*')
    .eq('tenant_id', tenantId).gte('crawled_at', since)
    .order('published_at', { ascending: false }).limit(20);
  if (error) throw error;
  return (data ?? []).map(mapNews);
}

/** Danh sách tin đã thu thập (mới nhất trước) — cho màn Tin đã thu thập. */
export async function listNews(tenantId: string, limit = 100): Promise<CrawledNews[]> {
  const { data, error } = await adminDb()
    .from('crawled_news').select('*')
    .eq('tenant_id', tenantId)
    .order('crawled_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return (data ?? []).map(mapNews);
}

// ------------------------------ DRAFTS ------------------------------
export interface NewDraft {
  tenantId: string; title: string; body: string; category: NewsCategory;
  template: PostTemplate; status: DraftStatus; sourceNewsIds: string[];
  moderation: ModerationResult; aiProvider: string; aiModel: string;
}

export async function insertDraft(d: NewDraft): Promise<string> {
  const { data, error } = await adminDb().from('ai_drafts').insert({
    tenant_id: d.tenantId, title: d.title, body: d.body, category: d.category,
    template: d.template, status: d.status, source_news_ids: d.sourceNewsIds,
    moderation: d.moderation, ai_provider: d.aiProvider, ai_model: d.aiModel,
  }).select('id').single();
  if (error) throw error;
  return data!.id;
}

export async function listDrafts(tenantId: string, status?: DraftStatus): Promise<AiDraft[]> {
  let q = adminDb().from('ai_drafts').select('*').eq('tenant_id', tenantId);
  if (status) q = q.eq('status', status);
  const { data, error } = await q.order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapDraft);
}

export async function setDraftStatus(
  id: string, status: DraftStatus, reviewedBy?: string, rejectReason?: string,
): Promise<void> {
  const { error } = await adminDb().from('ai_drafts').update({
    status, reviewed_by: reviewedBy ?? null,
    reviewed_at: new Date().toISOString(), reject_reason: rejectReason ?? null,
  }).eq('id', id);
  if (error) throw error;
}

export async function recentPublishedBodies(tenantId: string, limit = 20): Promise<string[]> {
  const { data, error } = await adminDb()
    .from('ai_drafts').select('body')
    .eq('tenant_id', tenantId).eq('status', 'published')
    .order('updated_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return (data ?? []).map((r) => r.body as string);
}

// ---------------------------- SCHEDULE ------------------------------
export async function dueSchedules(now = new Date()) {
  const { data, error } = await adminDb()
    .from('publishing_schedule').select('*, ai_drafts(*)')
    .eq('status', 'queued').lte('scheduled_at', now.toISOString()).limit(10);
  if (error) throw error;
  return data ?? [];
}

/** Danh sách lịch đăng (kèm tiêu đề bài) — cho màn Lịch đăng bài. */
export async function listSchedules(tenantId: string, limit = 100) {
  const { data, error } = await adminDb()
    .from('publishing_schedule')
    .select('id, scheduled_at, provider, status, attempts, ai_drafts(title, status)')
    .eq('tenant_id', tenantId)
    .order('scheduled_at', { ascending: true }).limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function setScheduleStatus(id: string, status: string, attempts?: number) {
  const patch: Record<string, unknown> = { status };
  if (attempts !== undefined) patch.attempts = attempts;
  const { error } = await adminDb().from('publishing_schedule').update(patch).eq('id', id);
  if (error) throw error;
}

export async function logPublish(row: {
  tenantId: string; scheduleId?: string; draftId?: string; provider: string;
  success: boolean; fbPostId?: string; message?: string; payload?: unknown;
}) {
  await adminDb().from('publishing_logs').insert({
    tenant_id: row.tenantId, schedule_id: row.scheduleId ?? null,
    draft_id: row.draftId ?? null, provider: row.provider, success: row.success,
    fb_post_id: row.fbPostId ?? null, message: row.message ?? null,
    payload: row.payload ?? {},
  });
}

// ---------------------------- SETTINGS ------------------------------
export async function getSettings(tenantId: string): Promise<Record<string, string>> {
  const { data, error } = await adminDb()
    .from('settings').select('key, value').eq('tenant_id', tenantId);
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((r) => [r.key, r.value ?? '']));
}

export interface SettingRow { key: string; value: string; isSecret: boolean }

/** Liệt kê tất cả setting (kèm cờ is_secret) — cho màn Cài đặt. */
export async function listSettings(tenantId: string): Promise<SettingRow[]> {
  const { data, error } = await adminDb()
    .from('settings').select('key, value, is_secret')
    .eq('tenant_id', tenantId).order('key');
  if (error) throw error;
  return (data ?? []).map((r) => ({ key: r.key, value: r.value ?? '', isSecret: r.is_secret }));
}

/** Thêm/cập nhật một setting theo key. */
export async function upsertSetting(
  tenantId: string, key: string, value: string, isSecret: boolean,
): Promise<void> {
  const { error } = await adminDb().from('settings').upsert(
    { tenant_id: tenantId, key, value, is_secret: isSecret, updated_at: new Date().toISOString() },
    { onConflict: 'tenant_id,key' },
  );
  if (error) throw error;
}

/** Xoá một setting theo key. */
export async function deleteSetting(tenantId: string, key: string): Promise<void> {
  const { error } = await adminDb().from('settings')
    .delete().eq('tenant_id', tenantId).eq('key', key);
  if (error) throw error;
}

// ----------------------------- MAPPERS ------------------------------
/* eslint-disable @typescript-eslint/no-explicit-any */
function mapSource(r: any): Source {
  return {
    id: r.id, tenantId: r.tenant_id, name: r.name, url: r.url, type: r.type,
    isActive: r.is_active, config: r.config ?? {},
    crawlIntervalMin: r.crawl_interval_min, lastCrawledAt: r.last_crawled_at,
  };
}
function mapNews(r: any): CrawledNews {
  return {
    id: r.id, tenantId: r.tenant_id, sourceId: r.source_id, title: r.title,
    content: r.content, summary: r.summary, publishedAt: r.published_at,
    originUrl: r.origin_url, imageUrl: r.image_url, dedupHash: r.dedup_hash,
  };
}
function mapDraft(r: any): AiDraft {
  return {
    id: r.id, tenantId: r.tenant_id, title: r.title, body: r.body,
    category: r.category, template: r.template, status: r.status,
    sourceNewsIds: r.source_news_ids ?? [], imageUrls: r.image_urls ?? [],
    moderation: r.moderation ?? { passed: false, flags: [], score: 0 },
    aiProvider: r.ai_provider, aiModel: r.ai_model,
  };
}
