// Đăng nhập Facebook một lần, lưu cookie (storageState) + group id vào bảng settings.
// Chạy: npm run fb:login   (mở trình duyệt thật để bạn tự đăng nhập)
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'fs';
import readline from 'readline';

// --- nạp .env thủ công (không phụ thuộc Node version) ---
function loadEnv() {
  let txt = '';
  try { txt = readFileSync('.env', 'utf8'); } catch { console.error('Không tìm thấy .env'); process.exit(1); }
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
loadEnv();

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TENANT = process.env.DEFAULT_TENANT_ID;
if (!URL || !SERVICE || !TENANT) {
  console.error('Thiếu NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / DEFAULT_TENANT_ID trong .env');
  process.exit(1);
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((res) => rl.question(q, res));

async function upsert(key, value, isSecret) {
  const db = createClient(URL, SERVICE, { auth: { persistSession: false } });
  const { error } = await db.from('settings').upsert(
    { tenant_id: TENANT, key, value, is_secret: isSecret, updated_at: new Date().toISOString() },
    { onConflict: 'tenant_id,key' },
  );
  if (error) throw error;
}

console.log('\n→ Mở trình duyệt. Hãy ĐĂNG NHẬP Facebook (nên dùng tài khoản phụ là thành viên group).');
const browser = await chromium.launch({ headless: false, slowMo: 100 });
const ctx = await browser.newContext({ locale: 'vi-VN' });
const page = await ctx.newPage();
await page.goto('https://www.facebook.com/');

await ask('\n✋ Đăng nhập xong (thấy News Feed) thì quay lại đây, gõ Enter để lưu cookie... ');

const state = await ctx.storageState();
const hasSession = state.cookies?.some((c) => c.name === 'c_user');
if (!hasSession) {
  console.warn('⚠️ Chưa thấy cookie đăng nhập (c_user). Bạn đã đăng nhập chưa? Vẫn sẽ lưu thử.');
}

writeFileSync('fb-state.json', JSON.stringify(state, null, 2));
await upsert('fb_storage_state', JSON.stringify(state), true);
await upsert('publish_provider', 'playwright', false);
console.log('✓ Đã lưu cookie vào settings.fb_storage_state và đặt publish_provider=playwright.');

const gid = (await ask('\nNhập ID hoặc slug của Group đích (vd 123456789 hoặc ten-group), bỏ trống để set sau: ')).trim();
if (gid) {
  await upsert('fb_target_id', gid, false);
  console.log(`✓ Đã đặt fb_target_id = ${gid}`);
}

await browser.close();
rl.close();
console.log('\n🎉 Xong. Giờ vào app: Drafts → "Đăng ngay", rồi gọi cron/publish để đăng thử.');
process.exit(0);
