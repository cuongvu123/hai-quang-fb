import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/db/client';
import { setDraftStatus, getSettings } from '@/lib/db/repositories';
import { defaultTenantId } from '@/lib/cron-auth';

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/drafts/:id/approve  body: { scheduledAt, provider? } */
export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const tenantId = defaultTenantId();
  const { scheduledAt, provider } = await req.json();

  await setDraftStatus(id, scheduledAt ? 'scheduled' : 'approved');

  if (scheduledAt) {
    // provider: ưu tiên body, sau đó setting publish_provider, mặc định graph_api
    const settings = await getSettings(tenantId);
    const prov = provider || settings.publish_provider || 'graph_api';
    const { error } = await adminDb().from('publishing_schedule').insert({
      tenant_id: tenantId,
      draft_id: id,
      scheduled_at: scheduledAt,
      provider: prov,
      status: 'queued',
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Đăng ngay + dùng Playwright: kích GitHub Actions chạy liền (nếu đã cấu hình),
    // thay vì đợi lịch quét 15 phút. Lỗi ở đây không chặn việc duyệt.
    const immediate = new Date(scheduledAt).getTime() <= Date.now() + 60_000;
    if (immediate && prov === 'playwright') {
      await triggerPublishWorkflow().catch(() => {});
    }
  }
  return NextResponse.json({ ok: true });
}

/** Gọi repository_dispatch để GitHub Actions đăng ngay (tuỳ chọn). */
async function triggerPublishWorkflow(): Promise<void> {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  const repo = process.env.GITHUB_REPO; // vd "cuongvu123/hai-quang-fb"
  if (!token || !repo) return;
  await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
    },
    body: JSON.stringify({ event_type: 'publish' }),
  });
}
