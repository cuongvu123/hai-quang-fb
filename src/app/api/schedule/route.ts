import { NextResponse } from 'next/server';
import { listSchedules } from '@/lib/db/repositories';
import { defaultTenantId } from '@/lib/cron-auth';

export async function GET() {
  const data = await listSchedules(defaultTenantId());
  return NextResponse.json({ data });
}
