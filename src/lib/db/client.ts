import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/** Client phía server/cron — service role, BYPASS RLS. Chỉ dùng ở server. */
export function adminDb(): SupabaseClient {
  return createClient(url, service, { auth: { persistSession: false } });
}

/** Client công khai (anon) — tôn trọng RLS. Dùng khi đã có session user. */
export function publicDb(): SupabaseClient {
  return createClient(url, anon);
}
