import { NextRequest, NextResponse } from 'next/server';
import { assertCron, defaultTenantId } from '@/lib/cron-auth';
import {
  unusedNews, getSettings, recentPublishedBodies, insertDraft,
} from '@/lib/db/repositories';
import { aiConfigFromSettings, createAiProvider, generateDraft, moderate } from '@/lib/ai';
import { pickTemplate } from '@/lib/ai/schedule';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const maxDuration = 120;

/** GET /api/cron/generate — sinh bài nháp từ tin mới, đẩy vào hàng chờ duyệt. */
export async function GET(req: NextRequest) {
  try {
    assertCron(req);
  } catch (r) {
    return r as Response;
  }

  const tenantId = defaultTenantId();
  const settings = await getSettings(tenantId);
  const news = await unusedNews(tenantId, 7);

  if (news.length === 0) {
    return NextResponse.json({ ok: true, message: 'Không có tin mới.' });
  }

  const ai = createAiProvider(aiConfigFromSettings(settings));

  const template = pickTemplate(new Date());
  const recent = await recentPublishedBodies(tenantId);

  try {
    const post = await generateDraft(ai, template, news.slice(0, 5));
    const mod = moderate({
      body: post.body,
      sourceNews: news.slice(0, 5),
      recentBodies: recent,
    });

    const id = await insertDraft({
      tenantId,
      title: post.title,
      body: post.body,
      category: post.category,
      template,
      status: mod.passed ? 'pending' : 'generated', // chỉ 'pending' mới vào danh sách duyệt
      sourceNewsIds: news.slice(0, 5).map((n) => n.id),
      moderation: mod,
      aiProvider: ai.name,
      aiModel: ai.model,
    });

    logger.info('generate.done', { id, template, passed: mod.passed, flags: mod.flags });
    return NextResponse.json({ ok: true, draftId: id, moderation: mod });
  } catch (e) {
    logger.error('generate.failed', { error: (e as Error).message });
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
