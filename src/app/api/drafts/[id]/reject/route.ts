import { NextRequest, NextResponse } from 'next/server';
import { setDraftStatus } from '@/lib/db/repositories';

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/drafts/:id/reject  body: { reason } */
export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const { reason } = await req.json().catch(() => ({ reason: undefined }));
  await setDraftStatus(id, 'rejected', undefined, reason);
  return NextResponse.json({ ok: true });
}
