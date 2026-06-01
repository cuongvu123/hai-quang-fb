'use client';

import { useEffect, useState } from 'react';

interface Source {
  id: string; name: string; url: string; type: string;
  is_active: boolean; crawl_interval_min: number;
}

const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'rss', label: 'RSS Feed' },
  { value: 'google_sheet', label: 'Google Sheet' },
  { value: 'local_news', label: 'Báo điện tử' },
  { value: 'province_website', label: 'Website tỉnh' },
  { value: 'gov_website', label: 'Website cơ quan' },
  { value: 'local_website', label: 'Website xã' },
];

const TYPE_LABEL: Record<string, string> = {
  ...Object.fromEntries(TYPE_OPTIONS.map((t) => [t.value, t.label])),
  manual_upload: 'Tải lên thủ công', telegram: 'Telegram', facebook_page: 'Fanpage FB',
};

export default function SourcesPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [type, setType] = useState('rss');
  const [interval, setIntervalMin] = useState(360);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    const res = await fetch('/api/sources');
    const json = await res.json();
    setSources(json.data ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const res = await fetch('/api/sources', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, url, type, crawlIntervalMin: interval }),
    });
    if (!res.ok) {
      const j = await res.json();
      setError(typeof j.error === 'string' ? j.error : 'Dữ liệu chưa hợp lệ (kiểm tra URL).');
      return;
    }
    setName(''); setUrl(''); setType('rss'); setIntervalMin(360);
    load();
  }

  async function toggle(s: Source) {
    await fetch(`/api/sources/${s.id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ isActive: !s.is_active }),
    });
    load();
  }

  async function remove(id: string) {
    if (!confirm('Xoá nguồn này?')) return;
    await fetch(`/api/sources/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div className="max-w-3xl">
      <h1 className="mb-6 text-2xl font-semibold">Nguồn dữ liệu</h1>

      <form onSubmit={add} className="mb-8 space-y-3 rounded-xl border border-neutral-200 bg-white p-5">
        <p className="text-sm font-medium">Thêm nguồn mới</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input required placeholder="Tên nguồn" value={name} onChange={(e) => setName(e.target.value)}
            className="rounded-lg border border-neutral-300 p-2.5 text-sm" />
          <select value={type} onChange={(e) => setType(e.target.value)}
            className="rounded-lg border border-neutral-300 p-2.5 text-sm">
            {TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <input required type="url" placeholder="URL (link RSS / Google Sheet / website)" value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 p-2.5 text-sm" />
        <div className="flex items-center gap-2">
          <label className="text-sm text-neutral-600">Chu kỳ crawl (phút):</label>
          <input type="number" min={30} value={interval} onChange={(e) => setIntervalMin(Number(e.target.value))}
            className="w-28 rounded-lg border border-neutral-300 p-2 text-sm" />
        </div>
        {error && <p className="text-sm text-red-600">⚠️ {error}</p>}
        <button className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700">
          Thêm nguồn
        </button>
      </form>

      {loading ? <p className="text-neutral-500">Đang tải…</p> : (
        <div className="space-y-3">
          {sources.length === 0 && <p className="text-neutral-500">Chưa có nguồn nào.</p>}
          {sources.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{s.name}</span>
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs">{TYPE_LABEL[s.type] ?? s.type}</span>
                  {!s.is_active && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">tạm tắt</span>}
                </div>
                <p className="mt-1 truncate text-xs text-neutral-500">{s.url}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button onClick={() => toggle(s)}
                  className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs hover:bg-neutral-50">
                  {s.is_active ? 'Tắt' : 'Bật'}
                </button>
                <button onClick={() => remove(s.id)}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50">
                  Xoá
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
