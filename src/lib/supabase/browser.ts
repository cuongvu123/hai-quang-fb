import { createBrowserClient } from '@supabase/ssr';

/** Supabase client phía trình duyệt (dùng cho login/logout ở client component). */
export function browserDb() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
