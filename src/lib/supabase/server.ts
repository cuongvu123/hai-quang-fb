import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Supabase client phía server (Server Component / Route Handler), đọc session
 * từ cookie. Dùng khi cần biết user hiện tại (vd kiểm tra quyền, lấy tenant).
 */
export async function serverDb() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Gọi từ Server Component (read-only) — middleware đã refresh cookie.
          }
        },
      },
    },
  );
}

/** Trả về user hiện tại hoặc null. */
export async function currentUser() {
  const db = await serverDb();
  const { data } = await db.auth.getUser();
  return data.user ?? null;
}
