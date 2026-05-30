import { NextRequest, NextResponse } from 'next/server';
import { listDrafts } from '@/lib/db/repositories';
import { defaultTenantId } from '@/lib/cron-auth';
import type { DraftStatus } from '@/types';

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get('status') as DraftStatus | null;
  const data = await listDrafts(defaultTenantId(), status ?? undefined);
  return NextResponse.json({ data });
}
