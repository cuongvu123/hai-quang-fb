'use client';

import { useEffect, useState } from 'react';
import type { AiDraft } from '@/types';

export default function DraftsPage() {
  const [drafts, setDrafts] = useState<AiDraft[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/drafts?status=pending');
    const json = await res.json();
    setDrafts(json.data ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function approve(id: string) {
    // mặc định lên lịch đăng sau 1 giờ
    const scheduledAt = new Date(Date.now() + 3600_000).toISOString();
    await fetch(`/api/drafts/${id}/approve`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ scheduledAt, provider: 'graph_api' }),
    });
    load();
  }
  async function reject(id: string) {
    const reason = prompt('Lý do từ chối?') ?? '';
    await fetch(`/api/drafts/${id}/reject`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    load();
  }

  if (loading) return <p className="text-neutral-500">Đang tải…</p>;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Bài AI chờ duyệt</h1>
      {drafts.length === 0 && <p className="text-neutral-500">Chưa có bài nào chờ duyệt.</p>}
      <div className="space-y-4">
        {drafts.map((d) => (
          <article key={d.id} className="rounded-xl border border-neutral-200 bg-white p-5">
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs">{d.category}</span>
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">{d.template}</span>
              <span className="text-xs text-neutral-400">điểm: {(d.moderation.score * 100).toFixed(0)}%</span>
            </div>
            <h2 className="font-semibold">{d.title}</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-700">{d.body}</p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => approve(d.id)}
                className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
              >
                Duyệt & lên lịch (sau 1h)
              </button>
              <button
                onClick={() => reject(d.id)}
                className="rounded-lg border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50"
              >
                Từ chối
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
