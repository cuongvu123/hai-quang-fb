'use client';

import { useEffect, useState } from 'react';

interface Schedule {
  id: string;
  scheduled_at: string;
  provider: string;
  status: string;
  attempts: number;
  ai_drafts: { title: string; status: string } | null;
}

const STATUS_STYLE: Record<string, string> = {
  queued: 'bg-blue-50 text-blue-700',
  publishing: 'bg-amber-50 text-amber-700',
  done: 'bg-green-50 text-green-700',
  error: 'bg-red-50 text-red-700',
  canceled: 'bg-neutral-100 text-neutral-500',
};

const STATUS_LABEL: Record<string, string> = {
  queued: 'Chờ đăng', publishing: 'Đang đăng', done: 'Đã đăng',
  error: 'Lỗi', canceled: 'Đã huỷ',
};

export default function CalendarPage() {
  const [items, setItems] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/schedule').then((r) => r.json()).then((j) => {
      setItems(j.data ?? []);
      setLoading(false);
    });
  }, []);

  if (loading) return <p className="text-neutral-500">Đang tải…</p>;

  return (
    <div className="max-w-3xl">
      <h1 className="mb-1 text-2xl font-semibold">Lịch đăng bài</h1>
      <p className="mb-6 text-sm text-neutral-500">Các bài đã duyệt và được lên lịch đăng lên Facebook.</p>
      {items.length === 0 && (
        <p className="text-neutral-500">
          Chưa có bài nào được lên lịch. Vào <a href="/drafts" className="underline">Bài AI chờ duyệt</a> để duyệt & lên lịch.
        </p>
      )}
      <div className="space-y-3">
        {items.map((s) => (
          <div key={s.id} className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-4">
            <div className="min-w-0">
              <p className="truncate font-medium">{s.ai_drafts?.title ?? '(bài đã xoá)'}</p>
              <p className="mt-1 text-xs text-neutral-500">
                🕗 {new Date(s.scheduled_at).toLocaleString('vi-VN')} · {s.provider === 'graph_api' ? 'Graph API' : 'Playwright'}
                {s.attempts > 0 && ` · ${s.attempts} lần thử`}
              </p>
            </div>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs ${STATUS_STYLE[s.status] ?? 'bg-neutral-100'}`}>
              {STATUS_LABEL[s.status] ?? s.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
