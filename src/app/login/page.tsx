'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { browserDb } from '@/lib/supabase/browser';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const redirect = params.get('redirect') || '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { error } = await browserDb().auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push(redirect);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-xl border border-neutral-200 bg-white p-6">
      <div>
        <p className="text-lg font-semibold">Hải Quang</p>
        <p className="text-xs text-neutral-500">Đăng nhập quản trị</p>
      </div>
      <input
        type="email"
        required
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded-lg border border-neutral-300 p-2.5 text-sm focus:border-neutral-500 focus:outline-none"
      />
      <input
        type="password"
        required
        placeholder="Mật khẩu"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full rounded-lg border border-neutral-300 p-2.5 text-sm focus:border-neutral-500 focus:outline-none"
      />
      {error && <p className="text-sm text-red-600">⚠️ {error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-40"
      >
        {busy ? 'Đang đăng nhập…' : 'Đăng nhập'}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <Suspense fallback={<p className="text-sm text-neutral-500">Đang tải…</p>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
