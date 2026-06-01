// Đăng các bài "tới giờ" vào Group FB bằng Playwright — chạy trên GitHub Actions (free).
// Đọc cookie + group id + bài chờ từ Supabase; cập nhật trạng thái sau khi đăng.
// Env cần (đặt ở GitHub Secrets): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DEFAULT_TENANT_ID
import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeFile, unlink } from 'fs/promises';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TENANT = process.env.DEFAULT_TENANT_ID;
if (!URL || !SERVICE || !TENANT) {
  console.error('Thiếu NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / DEFAULT_TENANT_ID');
  process.exit(1);
}

const db = createClient(URL, SERVICE, { auth: { persistSession: false } });

// 1) Cấu hình từ settings
const { data: srows, error: sErr } = await db.from('settings').select('key, value').eq('tenant_id', TENANT);
if (sErr) { console.error(sErr); process.exit(1); }
const settings = Object.fromEntries((srows ?? []).map((r) => [r.key, r.value]));
const cookie = settings.fb_storage_state;
const targetId = settings.fb_target_id;
if (!cookie || !targetId) {
  console.log('⚠️ Chưa có fb_storage_state / fb_target_id trong settings — chạy "npm run fb:login" trước. Bỏ qua.');
  process.exit(0);
}

// 2) Bài tới giờ (queued + scheduled_at <= now)
const now = new Date().toISOString();
const { data: rows, error: rErr } = await db
  .from('publishing_schedule')
  .select('id, attempts, draft_id, ai_drafts(title, body, image_urls)')
  .eq('tenant_id', TENANT).eq('status', 'queued').lte('scheduled_at', now).limit(10);
if (rErr) { console.error(rErr); process.exit(1); }
if (!rows?.length) { console.log('Không có bài nào tới giờ.'); process.exit(0); }

console.log(`Có ${rows.length} bài tới giờ. Bắt đầu đăng…`);

for (const row of rows) {
  const draft = row.ai_drafts;
  await db.from('publishing_schedule').update({ status: 'publishing', attempts: row.attempts + 1 }).eq('id', row.id);

  const result = await postToGroup({
    cookie, targetId,
    message: `${draft.title}\n\n${draft.body}`,
    imageUrls: draft.image_urls ?? [],
  });

  await db.from('publishing_logs').insert({
    tenant_id: TENANT, schedule_id: row.id, draft_id: row.draft_id,
    provider: 'playwright', success: result.success, message: result.message ?? null,
  });

  if (result.success) {
    await db.from('publishing_schedule').update({ status: 'done' }).eq('id', row.id);
    await db.from('ai_drafts').update({ status: 'published' }).eq('id', row.draft_id);
    console.log(`✓ Đăng xong: ${draft.title}`);
  } else {
    const failed = row.attempts + 1 >= 3;
    await db.from('publishing_schedule').update({ status: failed ? 'error' : 'queued' }).eq('id', row.id);
    await db.from('ai_drafts').update({ status: failed ? 'failed' : 'scheduled' }).eq('id', row.draft_id);
    console.error(`✗ Lỗi: ${draft.title} — ${result.message}`);
  }
}

console.log('Hoàn tất.');
process.exit(0);

/** Đăng 1 bài vào group bằng Playwright (cookie đã đăng nhập sẵn). */
async function postToGroup({ cookie, targetId, message, imageUrls }) {
  const browser = await chromium.launch({ headless: true });
  const tmpFiles = [];
  let page;
  try {
    const context = await browser.newContext({
      storageState: JSON.parse(cookie),
      locale: 'vi-VN',
      viewport: { width: 1280, height: 900 },
    });
    page = await context.newPage();
    await page.goto(`https://www.facebook.com/groups/${targetId}`, {
      waitUntil: 'domcontentloaded', timeout: 60_000,
    });
    if (page.url().includes('/login') || (await page.locator('input[name="email"]').count()) > 0) {
      throw new Error('Cookie hết hạn — chạy lại npm run fb:login.');
    }

    const triggers = [/bạn viết gì/i, /viết bài/i, /tạo bài viết/i, /write something/i, /create post|what's on your mind/i];
    let opened = false;
    for (const name of triggers) {
      const el = page.getByText(name).first();
      if ((await el.count()) > 0) { await el.click().catch(() => {}); opened = true; break; }
    }
    if (!opened) await page.getByRole('button', { name: /viết|post|tạo|write/i }).first().click({ timeout: 10_000 });

    const dialog = page.getByRole('dialog');
    const scope = (await dialog.count()) > 0 ? dialog : page;
    const editor = scope.getByRole('textbox').first();
    await editor.waitFor({ state: 'visible', timeout: 15_000 });
    await editor.click();
    await editor.fill(message);

    for (const url of imageUrls) {
      const path = await downloadToTmp(url, tmpFiles);
      if (path) {
        await page.locator('input[type="file"]').first().setInputFiles(path).catch(() => {});
        await page.waitForTimeout(2500);
      }
    }

    await scope.getByRole('button', { name: /^đăng$|^post$/i }).first().click({ timeout: 15_000 });
    await page.waitForTimeout(6000);
    await browser.close();
    return { success: true, message: 'Đã đăng vào group.' };
  } catch (e) {
    try { if (page) await page.screenshot({ path: 'fb-debug.png' }); } catch {}
    await browser.close().catch(() => {});
    return { success: false, message: e.message };
  } finally {
    await Promise.all(tmpFiles.map((f) => unlink(f).catch(() => {})));
  }
}

async function downloadToTmp(url, track) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const ext = url.split('?')[0].split('.').pop()?.slice(0, 4) || 'jpg';
    const path = join(tmpdir(), `fbimg_${track.length}.${ext}`);
    await writeFile(path, buf);
    track.push(path);
    return path;
  } catch { return null; }
}
