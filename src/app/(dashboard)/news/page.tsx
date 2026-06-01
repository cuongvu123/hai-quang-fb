'use client';

import { useEffect, useState } from 'react';
import type { CrawledNews } from '@/types';

export default function NewsPage() {
  const [news, setNews] = useState<CrawledNews[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/news').then((r) => r.json()).then((j) => {
      setNews(j.data ?? []);
      setLoading(false);
    });
  }, []);

  if (loading) return <p className="text-neutral-500">Đang tải…</p>;

  return (
    <div className="max-w-3xl">
      <h1 className="mb-1 text-2xl font-semibold">Tin đã thu thập</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Tin từ crawler và các kênh nạp thủ công. Đây là nguyên liệu để AI soạn bài.
      </p>
      {news.length === 0 && <p className="text-neutral-500">Chưa có tin nào.</p>}
      <div className="space-y-3">
        {news.map((n) => (
          <article key={n.id} className="rounded-xl border border-neutral-200 bg-white p-4">
            <h2 className="font-medium">{n.title}</h2>
            <p className="mt-1 line-clamp-3 text-sm text-neutral-600">{n.content}</p>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-neutral-400">
              {n.publishedAt && <span>📅 {new Date(n.publishedAt).toLocaleDateString('vi-VN')}</span>}
              {n.originUrl && !n.originUrl.startsWith('manual://') && (
                <a href={n.originUrl} target="_blank" rel="noreferrer" className="underline hover:text-neutral-600">
                  Nguồn gốc ↗
                </a>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
