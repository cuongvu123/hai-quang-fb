import type {
  FacebookPublisher, PublishInput, PublishResult, SchedulePublishInput,
} from '../publisher';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeFile, unlink } from 'fs/promises';

/**
 * Provider 2 — Playwright Automation (đăng vào Group mà Graph API không hỗ trợ).
 * Đăng nhập bằng cookie/session đã lưu (storageState) — KHÔNG hardcode mật khẩu.
 *
 * CẢNH BÁO: tự động hoá UI Facebook có thể vi phạm ToS và dễ bị chặn. Dùng tài
 * khoản phụ. Chỉ chạy trên runtime Node có Chromium (self-host, KHÔNG phải Vercel).
 *
 * Debug: đặt FB_HEADFUL=1 để mở trình duyệt hiện hình; lỗi sẽ lưu ảnh fb-debug.png.
 */
export class PlaywrightPublisher implements FacebookPublisher {
  readonly name = 'playwright' as const;

  constructor(private storageState: string) {}

  async uploadImage(): Promise<string> {
    throw new Error('Playwright: ảnh được đính kèm trực tiếp trong publishPost.');
  }

  async schedulePost(input: SchedulePublishInput): Promise<PublishResult> {
    return this.publishPost(input);
  }

  async publishPost(input: PublishInput): Promise<PublishResult> {
    const headful = process.env.FB_HEADFUL === '1';
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({
      headless: !headful,
      slowMo: headful ? 300 : 0,
    });
    const tmpFiles: string[] = [];
    let page;
    try {
      const context = await browser.newContext({
        storageState: JSON.parse(this.storageState),
        locale: 'vi-VN',
        viewport: { width: 1280, height: 900 },
      });
      page = await context.newPage();

      // 1) Vào trang group
      await page.goto(`https://www.facebook.com/groups/${input.targetId}`, {
        waitUntil: 'domcontentloaded',
        timeout: 60_000,
      });
      // Kiểm tra còn đăng nhập không (nếu thấy form login -> cookie hết hạn)
      if (page.url().includes('/login') || await page.locator('input[name="email"]').count() > 0) {
        throw new Error('Cookie hết hạn — chạy lại script đăng nhập (npm run fb:login).');
      }

      // 2) Mở hộp soạn bài: thử nhiều cách (FB đổi UI theo phiên bản/ngôn ngữ)
      const triggerNames = [
        /bạn viết gì/i, /viết bài/i, /tạo bài viết/i,
        /write something/i, /create post|what's on your mind/i,
      ];
      let opened = false;
      for (const name of triggerNames) {
        const el = page.getByText(name).first();
        if (await el.count() > 0) {
          await el.click().catch(() => {});
          opened = true;
          break;
        }
      }
      if (!opened) {
        // fallback: nút theo role
        await page.getByRole('button', { name: /viết|post|tạo|write/i }).first().click({ timeout: 10_000 });
      }

      // 3) Điền nội dung vào ô soạn thảo (dialog)
      const dialog = page.getByRole('dialog');
      const editor = (await dialog.count() > 0 ? dialog : page)
        .getByRole('textbox').first();
      await editor.waitFor({ state: 'visible', timeout: 15_000 });
      await editor.click();
      await editor.fill(input.message);

      // 4) Đính kèm ảnh (nếu có): tải về tệp tạm rồi setInputFiles
      if (input.imageUrls?.length) {
        for (const url of input.imageUrls) {
          const path = await downloadToTmp(url, tmpFiles);
          if (path) {
            const fileInput = page.locator('input[type="file"][accept*="image"], input[type="file"]').first();
            await fileInput.setInputFiles(path).catch(() => {});
            await page.waitForTimeout(2500);
          }
        }
      }

      // 5) Bấm Đăng
      const postBtn = (await dialog.count() > 0 ? dialog : page)
        .getByRole('button', { name: /^đăng$|^post$/i }).first();
      await postBtn.click({ timeout: 15_000 });

      // 6) Chờ dialog đóng (coi như đăng xong)
      await page.waitForTimeout(6000);

      await browser.close();
      return { success: true, message: 'Đã đăng vào group qua Playwright.' };
    } catch (e) {
      // Lưu ảnh màn hình để debug selector
      try { if (page) await page.screenshot({ path: 'fb-debug.png', fullPage: false }); } catch {}
      await browser.close().catch(() => {});
      return { success: false, message: (e as Error).message };
    } finally {
      await Promise.all(tmpFiles.map((f) => unlink(f).catch(() => {})));
    }
  }
}

/** Tải ảnh từ URL về tệp tạm, trả đường dẫn (null nếu lỗi). */
async function downloadToTmp(url: string, track: string[]): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const ext = url.split('?')[0].split('.').pop()?.slice(0, 4) || 'jpg';
    const path = join(tmpdir(), `fbimg_${track.length}_${buf.byteLength}.${ext}`);
    await writeFile(path, buf);
    track.push(path);
    return path;
  } catch {
    return null;
  }
}
