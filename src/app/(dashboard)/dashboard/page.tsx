import { adminDb } from '@/lib/db/client';
import { defaultTenantId } from '@/lib/cron-auth';

// Số liệu realtime — luôn render động, không prerender lúc build.
export const dynamic = 'force-dynamic';

async function count(table: string, filters: Record<string, string> = {}) {
  let q = adminDb().from(table).select('*', { count: 'exact', head: true })
    .eq('tenant_id', defaultTenantId());
  for (const [k, v] of Object.entries(filters)) q = q.eq(k, v);
  const { count } = await q;
  return count ?? 0;
}

export default async function DashboardPage() {
  const [sources, news, pending, published] = await Promise.all([
    count('sources', { is_active: 'true' }),
    count('crawled_news'),
    count('ai_drafts', { status: 'pending' }),
    count('ai_drafts', { status: 'published' }),
  ]);

  const cards = [
    { label: 'Nguồn đang hoạt động', value: sources },
    { label: 'Tin đã thu thập', value: news },
    { label: 'Bài chờ duyệt', value: pending },
    { label: 'Bài đã đăng', value: published },
  ];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Tổng quan</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-neutral-200 bg-white p-5">
            <p className="text-sm text-neutral-500">{c.label}</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">{c.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
