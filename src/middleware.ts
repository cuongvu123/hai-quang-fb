import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Bảo vệ dashboard + API quản trị bằng session Supabase.
 * - Chưa đăng nhập + truy cập trang  -> chuyển tới /login?redirect=...
 * - Chưa đăng nhập + gọi API         -> 401 JSON
 * KHÔNG áp dụng cho /api/cron/* (bảo vệ bằng CRON_SECRET) và
 * /api/ingest/telegram (bảo vệ bằng secret_token của Telegram) — xem `matcher`.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (user) return response;

  const path = request.nextUrl.pathname;
  if (path.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = '/login';
  loginUrl.searchParams.set('redirect', path);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    // Trang quản trị
    '/dashboard', '/dashboard/:path*',
    '/sources', '/sources/:path*',
    '/ingest', '/ingest/:path*',
    '/news', '/news/:path*',
    '/drafts', '/drafts/:path*',
    '/calendar', '/calendar/:path*',
    '/settings', '/settings/:path*',
    // API quản trị (cron & telegram tự bảo vệ nên không liệt kê)
    '/api/sources/:path*',
    '/api/drafts/:path*',
    '/api/news/:path*',
    '/api/settings/:path*',
    '/api/schedule/:path*',
    '/api/ingest/media',
  ],
};
