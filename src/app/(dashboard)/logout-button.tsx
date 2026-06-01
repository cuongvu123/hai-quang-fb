'use client';

import { useRouter } from 'next/navigation';
import { browserDb } from '@/lib/supabase/browser';

export function LogoutButton() {
  const router = useRouter();
  async function logout() {
    await browserDb().auth.signOut();
    router.push('/login');
    router.refresh();
  }
  return (
    <button
      onClick={logout}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-neutral-500 transition hover:bg-neutral-100"
    >
      <span aria-hidden>🚪</span>
      Đăng xuất
    </button>
  );
}
