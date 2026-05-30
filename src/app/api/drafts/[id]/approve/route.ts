import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/db/client';
import { setDraftStatus } from '@/lib/db/repositories';
import { defaultTenantId } from '@/lib/cron-auth';

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/drafts/:id/approve  body: { scheduledAt, provider } */
export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const { scheduledAt, provider = 'graph_api' } = await req.json();

  await setDraftStatus(id, scheduledAt ? 'scheduled' : 'approved');

  if (scheduledAt) {
    const { error } = await adminDb().from('publishing_schedule').insert({
      tenant_id: defaultTenantId(),
      draft_id: id,
      scheduled_at: scheduledAt,
      provider,
      status: 'queued',
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
