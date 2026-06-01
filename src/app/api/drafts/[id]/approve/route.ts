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
  }
  return NextResponse.json({ ok: true });
}
