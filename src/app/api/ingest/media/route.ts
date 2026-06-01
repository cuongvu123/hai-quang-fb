import { NextRequest, NextResponse } from 'next/server';
import { defaultTenantId } from '@/lib/cron-auth';
import { getSettings } from '@/lib/db/repositories';
import { aiConfigFromSettings, createAiProvider } from '@/lib/ai';
import { guessMime, ingestItems, systemSourceId } from '@/lib/ingest';
import { logger } from '@/lib/logger';
import type { MediaFile, ParsedItem } from '@/types';

export const runtime = 'nodejs';
export const maxDuration = 120;

const MAX_FILES = 10;
const MAX_TOTAL_BYTES = 18 * 1024 * 1024; // ~18MB: giới hạn 1 request inline của Gemini

/**
 * POST /api/ingest/media — multipart/form-data
 *   files: 1..N ảnh/PDF   ·   note: ghi chú văn bản (tuỳ chọn)
 * Gemini đọc tệp → trích xuất tin → lưu vào crawled_news (chờ AI sinh bài & duyệt).
 *
 * Bảo vệ: nên đặt sau middleware Auth admin (xem README mục Auth).
 */
export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Cần gửi multipart/form-data' }, { status: 400 });
  }

  const note = (form.get('note') as string | null)?.toString() ?? '';
  const uploaded = form.getAll('files').filter((f): f is File => f instanceof File);
  if (uploaded.length === 0 && !note.trim()) {
    return NextResponse.json({ error: 'Hãy đính kèm ít nhất 1 ảnh/PDF hoặc nhập ghi chú' }, { status: 400 });
  }
  if (uploaded.length > MAX_FILES) {
    return NextResponse.json({ error: `Tối đa ${MAX_FILES} tệp mỗi lần` }, { status: 400 });
  }

  const files: MediaFile[] = [];
  let total = 0;
  for (const f of uploaded) {
    const buf = Buffer.from(await f.arrayBuffer());
    total += buf.byteLength;
    if (total > MAX_TOTAL_BYTES) {
      return NextResponse.json({ error: 'Tổng dung lượng tệp vượt ~18MB, hãy chia nhỏ' }, { status: 400 });
    }
    files.push({
      mimeType: f.type || guessMime(f.name),
      dataBase64: buf.toString('base64'),
    });
  }

  const tenantId = defaultTenantId();
  const ai = createAiProvider(aiConfigFromSettings(await getSettings(tenantId)));
  if (!ai.extractFromMedia) {
    return NextResponse.json(
      { error: `Provider "${ai.name}" chưa hỗ trợ đọc ảnh/PDF. Hãy chọn ai_provider = gemini trong Cài đặt.` },
      { status: 400 },
    );
  }

  try {
    const extracted = await ai.extractFromMedia({ files, note });
    if (extracted.length === 0) {
      return NextResponse.json({ ok: true, inserted: 0, message: 'Không trích xuất được tin nào từ tệp.' });
    }
    const items: ParsedItem[] = extracted.map((e) => ({
      title: e.title,
      content: e.content,
      publishedAt: e.publishedAt ? new Date(e.publishedAt) : null,
      originUrl: '',
      imageUrl: null,
    }));

    const sourceId = await systemSourceId(tenantId, 'manual_upload');
    const report = await ingestItems(tenantId, sourceId, 'manual://upload', items);
    return NextResponse.json({ ok: true, ...report });
  } catch (e) {
    logger.error('ingest.media.failed', { error: (e as Error).message });
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
