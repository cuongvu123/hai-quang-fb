import type { ParsedItem, SourceType } from '@/types';
import { dedupHash } from '../crawler/dedup';
import { ensureSource, insertNewsIfNew } from '../db/repositories';
import { logger } from '../logger';

export interface IngestReport {
  sourceId: string;
  received: number;
  inserted: number;
  skipped: number;
}

/** Nguồn "hệ thống" cho mỗi kênh nạp thủ công (mỗi tenant một nguồn/loại). */
const CHANNEL_META: Record<string, { name: string; url: string }> = {
  manual_upload: { name: 'Tải lên thủ công (ảnh/PDF)', url: 'manual://upload' },
  telegram: { name: 'Nạp tin qua Telegram', url: 'manual://telegram' },
};

/** Lấy/tạo nguồn hệ thống cho 1 kênh đẩy (upload, telegram). */
export async function systemSourceId(
  tenantId: string,
  channel: 'manual_upload' | 'telegram',
): Promise<string> {
  const meta = CHANNEL_META[channel];
  return ensureSource({ tenantId, name: meta.name, url: meta.url, type: channel });
}

/**
 * Nạp một loạt tin đã chuẩn hoá vào `crawled_news` (tái dùng dedup + pipeline
 * generate/duyệt/đăng có sẵn). originUrl rỗng sẽ được thay bằng url nguồn
 * + hash nội dung để vẫn chống trùng và thoả ràng buộc NOT NULL.
 */
export async function ingestItems(
  tenantId: string,
  sourceId: string,
  fallbackOriginUrl: string,
  items: ParsedItem[],
): Promise<IngestReport> {
  const report: IngestReport = { sourceId, received: items.length, inserted: 0, skipped: 0 };

  for (const item of items) {
    const title = item.title.trim();
    const content = (item.content || title).trim(); // content NOT NULL
    if (!title && !content) {
      report.skipped++;
      continue;
    }
    // originUrl NOT NULL: tin tải lên không có URL → dùng url nguồn + chuỗi nội dung
    const originUrl = item.originUrl?.trim()
      || `${fallbackOriginUrl}#${(title || content).slice(0, 80)}`;
    const hash = dedupHash(originUrl, title || content.slice(0, 80));

    const inserted = await insertNewsIfNew({
      tenantId,
      sourceId,
      title: title || content.slice(0, 80),
      content,
      publishedAt: item.publishedAt,
      originUrl,
      imageUrl: item.imageUrl,
      dedupHash: hash,
    });
    inserted ? report.inserted++ : report.skipped++;
  }

  logger.info('ingest.done', report);
  return report;
}

/** Đoán mimeType từ phần mở rộng/tên tệp (fallback khi client không gửi). */
export function guessMime(name: string, fallback = 'application/octet-stream'): string {
  const ext = name.toLowerCase().split('.').pop() ?? '';
  const map: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    webp: 'image/webp', gif: 'image/gif', pdf: 'application/pdf',
  };
  return map[ext] ?? fallback;
}

/** Các SourceType được nạp bằng kênh push (không crawl tự động). */
export const PUSH_SOURCE_TYPES: SourceType[] = ['manual_upload', 'telegram'];
