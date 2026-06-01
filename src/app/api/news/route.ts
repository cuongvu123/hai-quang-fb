import { NextResponse } from 'next/server';
import { listNews } from '@/lib/db/repositories';
import { defaultTenantId } from '@/lib/cron-auth';

export async function GET() {
  const data = await listNews(defaultTenantId());
  return NextResponse.json({ data });
}
