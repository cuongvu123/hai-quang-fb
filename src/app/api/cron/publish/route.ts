import { NextRequest, NextResponse } from 'next/server';
import { assertCron, defaultTenantId } from '@/lib/cron-auth';
import {
  dueSchedules, setScheduleStatus, logPublish, setDraftStatus, getSettings,
} from '@/lib/db/repositories';
import { createPublisher } from '@/lib/facebook';
import type { PublishProvider } from '@/types';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const maxDuration = 120;

/** GET /api/cron/publish — đăng các bài đã tới giờ trong publishing_schedule. */
export async function GET(req: NextRequest) {
  try {
    assertCron(req);
  } catch (r) {
    return r as Response;
  }

  const tenantId = defaultTenantId();
  const settings = await getSettings(tenantId);
  const rows = await dueSchedules();
  logger.info('publish.start', { due: rows.length });

  const results = [];
  for (const row of rows as any[]) {
    const draft = row.ai_drafts;
    await setScheduleStatus(row.id, 'publishing', row.attempts + 1);

    const publisher = createPublisher({
      provider: row.provider as PublishProvider,
      graphAccessToken: settings.fb_page_token,
      playwrightStorageState: settings.fb_storage_state,
    });

    const result = await publisher.publishPost({
      message: `${draft.title}\n\n${draft.body}`,
      imageUrls: draft.image_urls ?? [],
      targetId: settings.fb_target_id, // group/page id
    });

    await logPublish({
      tenantId, scheduleId: row.id, draftId: draft.id, provider: row.provider,
      success: result.success, fbPostId: result.fbPostId, message: result.message,
      payload: result.raw,
    });

    if (result.success) {
      await setScheduleStatus(row.id, 'done');
      await setDraftStatus(draft.id, 'published');
    } else {
      await setScheduleStatus(row.id, row.attempts + 1 >= 3 ? 'error' : 'queued');
      await setDraftStatus(draft.id, 'failed');
      logger.error('publish.failed', { draftId: draft.id, message: result.message });
    }
    results.push({ scheduleId: row.id, success: result.success });
  }

  return NextResponse.json({ ok: true, results });
}
