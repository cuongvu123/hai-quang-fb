import type { Source, ParsedItem } from '@/types';
import { parseRss } from './parsers/rss';
import { parseHtml } from './parsers/html';
import { parseSheet } from './parsers/sheet';
import { dedupHash } from './dedup';
import { insertNewsIfNew, markSourceCrawled } from '../db/repositories';

export interface CrawlReport {
  sourceId: string;
  found: number;
  inserted: number;
  skipped: number;
  error?: string;
}

/** Crawl một nguồn, lưu tin mới (bỏ tin trùng theo dedup_hash). */
export async function crawlSource(source: Source): Promise<CrawlReport> {
  const report: CrawlReport = { sourceId: source.id, found: 0, inserted: 0, skipped: 0 };
  try {
    const items = await fetchItems(source);
    report.found = items.length;

    for (const item of items) {
      const hash = dedupHash(item.originUrl, item.title);
      const inserted = await insertNewsIfNew({
        tenantId: source.tenantId,
        sourceId: source.id,
        title: item.title,
        content: item.content,
        publishedAt: item.publishedAt,
        originUrl: item.originUrl,
        imageUrl: item.imageUrl,
        dedupHash: hash,
      });
      inserted ? report.inserted++ : report.skipped++;
    }
    await markSourceCrawled(source.id);
  } catch (e) {
    report.error = (e as Error).message;
  }
  return report;
}

async function fetchItems(source: Source): Promise<ParsedItem[]> {
  switch (source.type) {
    case 'rss':
      return parseRss(source.url);
    case 'google_sheet':
      return parseSheet(source.url);
    case 'facebook_page':
      // Fanpage công khai: cần Graph API page feed (token) — để mở rộng sau.
      return [];
    case 'manual_upload':
    case 'telegram':
      // Kênh push (đẩy qua /api/ingest/*) — không crawl tự động.
      return [];
    default:
      return parseHtml(source.url, source.config);
  }
}

/** Lọc các nguồn tới hạn crawl (dựa vào last_crawled_at + interval). */
export function isDue(source: Source, now = Date.now()): boolean {
  if (!source.isActive) return false;
  if (!source.lastCrawledAt) return true;
  const next = new Date(source.lastCrawledAt).getTime() + source.crawlIntervalMin * 60_000;
  return now >= next;
}
