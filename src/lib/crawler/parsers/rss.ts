import Parser from 'rss-parser';
import type { ParsedItem } from '@/types';

const parser = new Parser({
  customFields: { item: [['media:content', 'media'], ['enclosure', 'enclosure']] },
});

export async function parseRss(feedUrl: string): Promise<ParsedItem[]> {
  const feed = await parser.parseURL(feedUrl);
  return (feed.items ?? []).map((it) => ({
    title: (it.title ?? '').trim(),
    content: (it.contentSnippet ?? it.content ?? '').trim(),
    publishedAt: it.isoDate ? new Date(it.isoDate) : null,
    originUrl: (it.link ?? '').trim(),
    imageUrl:
      (it as { media?: { $?: { url?: string } } }).media?.$?.url ??
      (it as { enclosure?: { url?: string } }).enclosure?.url ??
      null,
  })).filter((i) => i.title && i.originUrl);
}
