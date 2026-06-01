import { NextRequest, NextResponse } from 'next/server';
import { defaultTenantId } from '@/lib/cron-auth';
import { getSettings } from '@/lib/db/repositories';
import { aiConfigFromSettings, createAiProvider } from '@/lib/ai';
import { guessMime, ingestItems, systemSourceId } from '@/lib/ingest';
import { logger } from '@/lib/logger';
import type { MediaFile, ParsedItem } from '@/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

const API = 'https://api.telegram.org';

/**
 * POST /api/ingest/telegram — Webhook nhận update từ bot Telegram.
 * Người dùng forward tin nhắn / ảnh / PDF vào bot → tự động nạp vào crawled_news.
 *
 * Cấu hình webhook (1 lần):
 *   https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<domain>/api/ingest/telegram&secret_token=<SECRET>
 * Bảo vệ: Telegram gửi kèm header X-Telegram-Bot-Api-Secret-Token = TELEGRAM_WEBHOOK_SECRET.
 */
export async function POST(req: NextRequest) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!token) {
    return NextResponse.json({ error: 'Thiếu TELEGRAM_BOT_TOKEN' }, { status: 500 });
  }
  if (secret && req.headers.get('x-telegram-bot-api-secret-token') !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let update: TgUpdate;
  try {
    update = await req.json();
  } catch {
    return NextResponse.json({ ok: true }); // bỏ qua payload lạ, vẫn trả 200
  }

  const msg = update.message ?? update.channel_post;
  const chatId = msg?.chat?.id;
  if (!msg || chatId == null) return NextResponse.json({ ok: true });

  try {
    const tenantId = defaultTenantId();
    const text = (msg.text ?? msg.caption ?? '').trim();

    // Gom các tệp đính kèm: ảnh lớn nhất + document (pdf/ảnh).
    const fileIds: string[] = [];
    if (msg.photo?.length) fileIds.push(msg.photo[msg.photo.length - 1].file_id);
    if (msg.document?.file_id) fileIds.push(msg.document.file_id);

    let items: ParsedItem[] = [];

    if (fileIds.length > 0) {
      // Có ảnh/PDF → dùng Gemini đọc nội dung.
      const ai = createAiProvider(aiConfigFromSettings(await getSettings(tenantId)));
      if (!ai.extractFromMedia) {
        await reply(token, chatId, '⚠️ Provider AI hiện không đọc được ảnh/PDF. Hãy đặt ai_provider = gemini.');
        return NextResponse.json({ ok: true });
      }
      const files = await downloadFiles(token, fileIds);
      const extracted = await ai.extractFromMedia({ files, note: text });
      items = extracted.map((e) => ({
        title: e.title,
        content: e.content,
        publishedAt: e.publishedAt ? new Date(e.publishedAt) : null,
        originUrl: '',
        imageUrl: null,
      }));
    } else if (text) {
      // Chỉ có chữ → tạo tin trực tiếp (dòng đầu = tiêu đề).
      const [first, ...rest] = text.split('\n');
      items = [{
        title: first.slice(0, 200),
        content: rest.join('\n').trim() || first,
        publishedAt: msg.date ? new Date(msg.date * 1000) : null,
        originUrl: '',
        imageUrl: null,
      }];
    } else {
      await reply(token, chatId, 'Gửi cho tôi đoạn tin (chữ) hoặc ảnh/PDF thông báo để nạp nhé.');
      return NextResponse.json({ ok: true });
    }

    const sourceId = await systemSourceId(tenantId, 'telegram');
    const report = await ingestItems(tenantId, sourceId, 'manual://telegram', items);
    await reply(
      token, chatId,
      report.inserted > 0
        ? `✅ Đã nhận ${report.inserted} tin. Bài sẽ được AI soạn và chờ admin duyệt.`
        : '↩️ Tin này đã có rồi (trùng), bỏ qua.',
    );
  } catch (e) {
    logger.error('ingest.telegram.failed', { error: (e as Error).message });
    if (chatId != null) await reply(token, chatId, '❌ Có lỗi khi xử lý, thử lại sau nhé.').catch(() => {});
  }

  return NextResponse.json({ ok: true });
}

/** Tải các tệp Telegram về dạng base64 cho Gemini. */
async function downloadFiles(token: string, fileIds: string[]): Promise<MediaFile[]> {
  const out: MediaFile[] = [];
  for (const id of fileIds) {
    const meta = await fetch(`${API}/bot${token}/getFile?file_id=${id}`).then((r) => r.json());
    const path: string | undefined = meta?.result?.file_path;
    if (!path) continue;
    const ab = await fetch(`${API}/file/bot${token}/${path}`).then((r) => r.arrayBuffer());
    const buf = Buffer.from(new Uint8Array(ab));
    out.push({ mimeType: guessMime(path, 'image/jpeg'), dataBase64: buf.toString('base64') });
  }
  return out;
}

/** Gửi tin nhắn phản hồi lại người dùng. */
async function reply(token: string, chatId: number, text: string): Promise<void> {
  await fetch(`${API}/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

// --- kiểu tối giản cho Telegram Update ---
interface TgFile { file_id: string }
interface TgMessage {
  chat?: { id: number };
  date?: number;
  text?: string;
  caption?: string;
  photo?: TgFile[];
  document?: { file_id?: string };
}
interface TgUpdate { message?: TgMessage; channel_post?: TgMessage }
