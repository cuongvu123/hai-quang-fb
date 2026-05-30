import * as cheerio from 'cheerio';
import type { ParsedItem, SourceConfig } from '@/types';

/**
 * Parser HTML cấu hình được bằng CSS selector (lưu trong sources.config).
 * Crawl trang danh sách -> lấy link bài -> (tuỳ chọn) fetch trang chi tiết.
 */
export async function parseHtml(
  pageUrl: string,
  config: SourceConfig,
  opts: { fetchDetail?: boolean } = { fetchDetail: true },
): Promise<ParsedItem[]> {
  const html = await fetchText(pageUrl);
  const $ = cheerio.load(html);
  const base = new URL(pageUrl);

  const list = config.listSelector ? $(config.listSelector) : $('article');
  const items: ParsedItem[] = [];

  for (const el of list.toArray()) {
    const node = $(el);
    const titleEl = config.titleSelector ? node.find(config.titleSelector) : node.find('a').first();
    const title = titleEl.text().trim();
    const href = (config.linkSelector ? node.find(config.linkSelector) : titleEl).attr('href');
    if (!title || !href) continue;

    const originUrl = new URL(href, base).toString();
    const imageUrl = config.imageSelector
      ? absolutize(node.find(config.imageSelector).attr('src'), base)
      : absolutize(node.find('img').first().attr('src'), base);
    const dateText = config.dateSelector ? node.find(config.dateSelector).text().trim() : '';

    let content = node.text().trim();
    if (opts.fetchDetail && config.contentSelector) {
      content = (await fetchDetail(originUrl, config.contentSelector)) || content;
    }

    items.push({
      title,
      content,
      publishedAt: parseVnDate(dateText),
      originUrl,
      imageUrl,
    });
  }
  return items;
}

async function fetchDetail(url: string, selector: string): Promise<string | null> {
  try {
    const $ = cheerio.load(await fetchText(url));
    const text = $(selector).text().replace(/\s+\n/g, '\n').trim();
    return text || null;
  } catch {
    return null;
  }
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'user-agent': 'HaiQuangBot/1.0 (+community info aggregator)' },
  });
  if (!res.ok) throw new Error(`fetch ${url} -> ${res.status}`);
  return res.text();
}

function absolutize(src: string | undefined, base: URL): string | null {
  if (!src) return null;
  try { return new URL(src, base).toString(); } catch { return null; }
}

/** Cố gắng đọc ngày dạng dd/mm/yyyy hoặc ISO. */
function parseVnDate(text: string): Date | null {
  if (!text) return null;
  const dmy = text.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (dmy) return new Date(+dmy[3], +dmy[2] - 1, +dmy[1]);
  const d = new Date(text);
  return isNaN(d.getTime()) ? null : d;
}
