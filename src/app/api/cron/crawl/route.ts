import { NextRequest, NextResponse } from 'next/server';
import { assertCron, defaultTenantId } from '@/lib/cron-auth';
import { listActiveSources } from '@/lib/db/repositories';
import { crawlSource, isDue } from '@/lib/crawler';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** GET /api/cron/crawl — chạy theo lịch (vd mỗi giờ). */
export async function GET(req: NextRequest) {
  try {
    assertCron(req);
  } catch (r) {
    return r as Response;
  }

  const tenantId = defaultTenantId();
  const sources = (await listActiveSources(tenantId)).filter((s) => isDue(s));
  logger.info('crawl.start', { tenantId, due: sources.length });

  const reports = [];
  for (const s of sources) {
    const r = await crawlSource(s);
    reports.push(r);
    if (r.error) logger.error('crawl.source_failed', { source: s.name, error: r.error });
  }

  const inserted = reports.reduce((a, r) => a + r.inserted, 0);
  logger.info('crawl.done', { inserted });
  return NextResponse.json({ ok: true, inserted, reports });
}
