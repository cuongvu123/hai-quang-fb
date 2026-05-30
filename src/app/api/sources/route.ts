import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/db/client';
import { defaultTenantId } from '@/lib/cron-auth';
import { z } from 'zod';

const SourceSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  type: z.enum([
    'local_website', 'province_website', 'gov_website',
    'rss', 'facebook_page', 'local_news',
  ]),
  isActive: z.boolean().default(true),
  config: z.record(z.string()).default({}),
  crawlIntervalMin: z.number().int().positive().default(360),
});

export async function GET() {
  const { data, error } = await adminDb()
    .from('sources').select('*')
    .eq('tenant_id', defaultTenantId())
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const parsed = SourceSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const s = parsed.data;
  const { data, error } = await adminDb().from('sources').insert({
    tenant_id: defaultTenantId(),
    name: s.name, url: s.url, type: s.type, is_active: s.isActive,
    config: s.config, crawl_interval_min: s.crawlIntervalMin,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
