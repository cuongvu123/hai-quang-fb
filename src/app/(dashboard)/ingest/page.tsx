'use client';

import { useState } from 'react';

interface IngestResult { inserted: number; skipped: number; received: number; message?: string }

export default function IngestPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<IngestResult | null>(null);
  const [error, setError] = useState('');

  async function submit() {
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append('files', f));
      if (note.trim()) fd.append('note', note.trim());

      const res = await fetch('/api/ingest/media', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || 'Lỗi không xác định');
      setResult(json as IngestResult);
      setFiles([]);
      setNote('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = (files.length > 0 || note.trim().length > 0) && !busy;

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 text-2xl font-semibold">Nạp tin nhanh</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Tải lên <strong>ảnh chụp thông báo</strong>, <strong>file PDF</strong>, hoặc dán nội dung.
        AI sẽ đọc và tạo bài nháp chờ bạn duyệt. Không cần biết kỹ thuật.
      </p>

      <div className="space-y-5 rounded-xl border border-neutral-200 bg-white p-5">
        <div>
          <label className="mb-2 block text-sm font-medium">Ảnh / PDF (chụp từ điện thoại được)</label>
          <input
            type="file"
            multiple
            accept="image/*,application/pdf"
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            className="block w-full text-sm text-neutral-600 file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-900 file:px-4 file:py-2 file:text-sm file:text-white hover:file:bg-neutral-700"
          />
          {files.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-neutral-500">
              {files.map((f) => <li key={f.name}>📎 {f.name} ({Math.round(f.size / 1024)} KB)</li>)}
            </ul>
          )}
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">Ghi chú / nội dung (tuỳ chọn)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={5}
            placeholder="Dán nội dung thông báo, hoặc ghi chú thêm cho ảnh ở trên…"
            className="w-full rounded-lg border border-neutral-300 p-3 text-sm focus:border-neutral-500 focus:outline-none"
          />
        </div>

        <button
          onClick={submit}
          disabled={!canSubmit}
          className="rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-40"
        >
          {busy ? 'Đang xử lý…' : 'Nạp tin'}
        </button>

        {result && (
          <div className="rounded-lg bg-green-50 p-3 text-sm text-green-800">
            ✅ Đã nhận {result.received} mục — thêm mới {result.inserted}, trùng/bỏ qua {result.skipped}.
            {result.message && <> {result.message}</>}{' '}
            <a href="/drafts" className="font-medium underline">Xem bài chờ duyệt →</a>
          </div>
        )}
        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">⚠️ {error}</div>
        )}
      </div>

      <p className="mt-4 text-xs text-neutral-400">
        Mẹo: cần đăng đều đặn nhiều tin? Dùng <strong>Google Sheet</strong> — xem hướng dẫn trong
        {' '}docs/INGEST_GUIDE.md, hoặc forward tin nhắn vào <strong>bot Telegram</strong> của xã.
      </p>
    </div>
  );
}
