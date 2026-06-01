'use client';

import { useEffect, useState } from 'react';

interface SettingItem { key: string; value: string; isSecret: boolean; hasValue: boolean }

// Gợi ý các key thường dùng cho người non-tech.
const KNOWN_KEYS: { key: string; secret: boolean; hint: string }[] = [
  { key: 'ai_provider', secret: false, hint: 'gemini | claude | openai' },
  { key: 'gemini_api_key', secret: true, hint: 'Khoá Gemini (aistudio.google.com)' },
  { key: 'gemini_model', secret: false, hint: 'vd gemini-2.5-flash-lite' },
  { key: 'claude_api_key', secret: true, hint: 'Khoá Claude' },
  { key: 'openai_api_key', secret: true, hint: 'Khoá OpenAI' },
  { key: 'fb_page_token', secret: true, hint: 'Page Access Token (đăng FB)' },
  { key: 'fb_target_id', secret: false, hint: 'ID Page/Group đích' },
];

export default function SettingsPage() {
  const [items, setItems] = useState<SettingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [isSecret, setIsSecret] = useState(false);
  const [msg, setMsg] = useState('');

  async function load() {
    setLoading(true);
    const res = await fetch('/api/settings');
    const json = await res.json();
    setItems(json.data ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  // Tự tick "bí mật" khi chọn key đã biết là secret.
  function onKeyChange(k: string) {
    setKey(k);
    const known = KNOWN_KEYS.find((x) => x.key === k);
    if (known) setIsSecret(known.secret);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    const res = await fetch('/api/settings', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key, value, isSecret }),
    });
    if (res.ok) {
      setKey(''); setValue(''); setIsSecret(false);
      setMsg('Đã lưu ✓');
      load();
    } else {
      setMsg('Lưu thất bại');
    }
  }

  async function remove(k: string) {
    if (!confirm(`Xoá cài đặt "${k}"?`)) return;
    await fetch(`/api/settings?key=${encodeURIComponent(k)}`, { method: 'DELETE' });
    load();
  }

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 text-2xl font-semibold">Cài đặt</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Khoá AI, token Facebook… Giá trị bí mật chỉ lưu, không hiển thị lại.
      </p>

      <form onSubmit={save} className="mb-8 space-y-3 rounded-xl border border-neutral-200 bg-white p-5">
        <p className="text-sm font-medium">Thêm / cập nhật</p>
        <input list="known-keys" required placeholder="Tên khoá (key)" value={key}
          onChange={(e) => onKeyChange(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 p-2.5 text-sm" />
        <datalist id="known-keys">
          {KNOWN_KEYS.map((k) => <option key={k.key} value={k.key}>{k.hint}</option>)}
        </datalist>
        <input required type={isSecret ? 'password' : 'text'} placeholder="Giá trị" value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 p-2.5 text-sm" />
        <label className="flex items-center gap-2 text-sm text-neutral-600">
          <input type="checkbox" checked={isSecret} onChange={(e) => setIsSecret(e.target.checked)} />
          Đánh dấu là bí mật (secret)
        </label>
        <div className="flex items-center gap-3">
          <button className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700">
            Lưu
          </button>
          {msg && <span className="text-sm text-green-700">{msg}</span>}
        </div>
      </form>

      {loading ? <p className="text-neutral-500">Đang tải…</p> : (
        <div className="space-y-2">
          {items.length === 0 && <p className="text-neutral-500">Chưa có cài đặt nào.</p>}
          {items.map((s) => (
            <div key={s.key} className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white px-4 py-3">
              <div className="min-w-0">
                <span className="font-mono text-sm">{s.key}</span>
                <span className="ml-2 text-sm text-neutral-500">
                  {s.isSecret ? (s.hasValue ? '•••••• (đã đặt)' : '(trống)') : s.value || '(trống)'}
                </span>
              </div>
              <button onClick={() => remove(s.key)}
                className="shrink-0 rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50">
                Xoá
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
