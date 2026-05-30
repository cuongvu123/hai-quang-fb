import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/db/client';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const body = await req.json();
  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) patch.name = body.name;
  if (body.url !== undefined) patch.url = body.url;
  if (body.type !== undefined) patch.type = body.type;
  if (body.isActive !== undefined) patch.is_active = body.isActive;
  if (body.config !== undefined) patch.config = body.config;
  if (body.crawlIntervalMin !== undefined) patch.crawl_interval_min = body.crawlIntervalMin;

  const { data, error } = await adminDb()
    .from('sources').update(patch).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const { error } = await adminDb().from('sources').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
