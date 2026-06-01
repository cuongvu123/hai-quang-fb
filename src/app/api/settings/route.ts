import { NextRequest, NextResponse } from 'next/server';
import { listSettings, upsertSetting, deleteSetting } from '@/lib/db/repositories';
import { defaultTenantId } from '@/lib/cron-auth';
import { z } from 'zod';

/** GET /api/settings — giá trị secret bị che, chỉ trả cờ hasValue. */
export async function GET() {
  const rows = await listSettings(defaultTenantId());
  const data = rows.map((r) => ({
    key: r.key,
    isSecret: r.isSecret,
    value: r.isSecret ? '' : r.value,
    hasValue: r.value.length > 0,
  }));
  return NextResponse.json({ data });
}

const UpsertSchema = z.object({
  key: z.string().min(1),
  value: z.string().default(''),
  isSecret: z.boolean().default(false),
});

/** POST /api/settings — thêm/cập nhật một key. */
export async function POST(req: NextRequest) {
  const parsed = UpsertSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { key, value, isSecret } = parsed.data;
  await upsertSetting(defaultTenantId(), key, value, isSecret);
  return NextResponse.json({ ok: true });
}

/** DELETE /api/settings?key=... */
export async function DELETE(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key');
  if (!key) return NextResponse.json({ error: 'Thiếu key' }, { status: 400 });
  await deleteSetting(defaultTenantId(), key);
  return NextResponse.json({ ok: true });
}
