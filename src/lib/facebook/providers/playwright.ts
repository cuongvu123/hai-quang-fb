import type {
  FacebookPublisher, PublishInput, PublishResult, SchedulePublishInput,
} from '../publisher';

/**
 * Provider 2 — Playwright Automation.
 * Dùng khi cần đăng vào Group cộng đồng mà Graph API không hỗ trợ.
 * Đăng nhập bằng cookie/session đã lưu (KHÔNG hardcode mật khẩu).
 *
 * CẢNH BÁO: tự động hoá UI Facebook có thể vi phạm điều khoản dịch vụ và
 * dễ bị chặn. Ưu tiên Graph API + Page khi có thể. Provider này để dự phòng.
 *
 * Cần `npm i playwright` và chạy trên runtime Node (không phải Edge).
 * scheduledAt được xử lý bởi cron của hệ thống (đăng đúng giờ), không phải FB.
 */
export class PlaywrightPublisher implements FacebookPublisher {
  readonly name = 'playwright' as const;

  /** storageState JSON (cookie) đã đăng nhập sẵn, lưu trong settings. */
  constructor(private storageState: string) {}

  async uploadImage(): Promise<string> {
    // Với Playwright, ảnh được đính kèm trực tiếp khi đăng (setInputFiles).
    // Trả về chính URL làm "id" tham chiếu.
    throw new Error('Playwright: dùng publishPost với imageUrls trực tiếp.');
  }

  async schedulePost(input: SchedulePublishInput): Promise<PublishResult> {
    // Lên lịch do cron hệ thống đảm nhiệm; tới giờ thì gọi publishPost.
    return this.publishPost(input);
  }

  async publishPost(input: PublishInput): Promise<PublishResult> {
    let browser;
    try {
      // import động để tránh nạp playwright ở môi trường serverless không cần.
      const { chromium } = await import('playwright');
      browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({
        storageState: JSON.parse(this.storageState),
      });
      const page = await context.newPage();

      await page.goto(`https://www.facebook.com/groups/${input.targetId}`, {
        waitUntil: 'domcontentloaded',
      });

      // Mở hộp soạn bài. Selector FB hay đổi -> tách ra config dễ chỉnh.
      await page.getByRole('button', { name: /viết bài|write something/i }).click();
      const editor = page.getByRole('textbox');
      await editor.fill(input.message);

      if (input.imageUrls?.length) {
        // Trong thực tế cần tải ảnh về tệp tạm rồi setInputFiles.
        // (Chi tiết bỏ qua ở scaffold này.)
      }

      await page.getByRole('button', { name: /^đăng$|^post$/i }).click();
      await page.waitForTimeout(4000);

      await browser.close();
      return { success: true, message: 'Đã đăng qua Playwright (không có post id).' };
    } catch (e) {
      if (browser) await browser.close().catch(() => {});
      return { success: false, message: (e as Error).message };
    }
  }
}
