// Crawl các nguồn "tới hạn" rồi ghi tin mới vào Supabase — CHẠY TRÊN MÁY ĐẶT TẠI VN.
// Lý do: nhiều site .gov.vn (haiquang.ninhbinh.gov.vn, ninhbinh.gov.vn) chặn IP nước
// ngoài nên crawl từ Vercel (Hong Kong) bị ETIMEDOUT. Chạy từ IP Việt Nam thì vào được.
//
// Bản sao logic của /api/cron/crawl + src/lib/crawler (parseRss/parseHtml/dedup),
// nhưng độc lập với Next.js để chạy bằng `node`.
//
// Env cần: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DEFAULT_TENANT_ID
//   (tự đọc file .env cùng thư mục gốc nếu biến chưa có sẵn trong môi trường).
//
// Cách chạy:
//   node scripts/crawl-due.mjs            # chỉ crawl nguồn đã tới hạn (theo crawl_interval_min)
//   node scripts/crawl-due.mjs --force    # bỏ qua kiểm tra "tới hạn", crawl tất cả nguồn active
//   node scripts/crawl-due.mjs --source <uuid>   # chỉ crawl 1 nguồn
import { createClient } from '@supabase/supabase-js';
import Parser from 'rss-parser';
import * as cheerio from 'cheerio';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import http from 'node:http';
import https from 'node:https';
import { gunzipSync, inflateSync, brotliDecompressSync } from 'node:zlib';

// ---------- nạp .env (không cần dotenv) -------------------------------
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
function loadEnv() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  try {
    for (const line of readFileSync(join(ROOT, '.env'), 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch { /* không có .env thì dùng biến môi trường */ }
}
loadEnv();

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TENANT = process.env.DEFAULT_TENANT_ID;
if (!SUPA_URL || !SERVICE || !TENANT) {
  console.error('Thiếu NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / DEFAULT_TENANT_ID');
  process.exit(1);
}

const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const ONLY_SOURCE = args.includes('--source') ? args[args.indexOf('--source') + 1] : null;
const RESUMMARIZE = args.includes('--resummarize'); // tóm tắt lại tin đã có (không crawl)

// User-Agent trình duyệt thật — vài site/WAF chặn UA lạ.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const FETCH_TIMEOUT_MS = 25_000;

// Chỉ giữ tin có ngày trong khoảng này (ngày) — bỏ tin cũ. Tin KHÔNG có ngày vẫn giữ
// (trang danh sách thường chỉ hiện tin mới). Sửa số này để nới/thu phạm vi "tuần này".
const MAX_AGE_DAYS = 7;
const AGE_CUTOFF = Date.now() - MAX_AGE_DAYS * 864e5;

const db = createClient(SUPA_URL, SERVICE, { auth: { persistSession: false } });
const rss = new Parser({
  headers: { 'user-agent': UA },
  timeout: FETCH_TIMEOUT_MS,
  customFields: { item: [['media:content', 'media'], ['enclosure', 'enclosure'], ['img', 'img']] },
});

// ---------- Tóm tắt bằng Gemini --------------------------------------
// Đọc key/model từ bảng settings (giống app). Tóm tắt CHỈ cho tin MỚI để tiết kiệm quota.
const { data: setRows } = await db.from('settings').select('key,value').eq('tenant_id', TENANT);
const SET = Object.fromEntries((setRows ?? []).map((r) => [r.key, r.value]));
const GEMINI_KEY = (!SET.ai_provider || SET.ai_provider === 'gemini') ? SET.gemini_api_key : null;
const GEMINI_MODEL = SET.gemini_model || 'gemini-2.5-flash-lite';
const SUMMARIZE = !!GEMINI_KEY;
const SUMMARY_DELAY_MS = 4500; // ~13 req/phút, dưới giới hạn free 15 RPM
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`;
const SUMMARY_SYS = `Bạn là biên tập viên bản tin cộng đồng xã Hải Quang. Hãy tóm tắt bài dưới đây thành MỘT đoạn 200–500 ký tự, nêu bật ý chính (ai, việc gì, khi nào, ở đâu, kết quả/ý nghĩa). Văn phong phải PHÙ HỢP với loại tin: thông báo/văn bản hành chính → rõ ràng, trang trọng; sự kiện → mời gọi, gần gũi; tin hoạt động/thời sự → súc tích, khách quan. Viết tiếng Việt có dấu, KHÔNG mở đầu bằng "Tóm tắt", chỉ trả về đúng đoạn văn tóm tắt.`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function summarize(title, content, retries = 3) {
  const userText = `Tiêu đề: ${title}\n\nNội dung:\n${content.slice(0, 6000)}`;
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(GEMINI_URL, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SUMMARY_SYS }] },
        contents: [{ role: 'user', parts: [{ text: userText }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 400 },
      }),
    });
    if (res.status === 429 && attempt < retries) {
      // RESOURCE_EXHAUSTED: chờ theo RetryInfo nếu có, mặc định backoff tăng dần.
      let wait = 20_000 * (attempt + 1);
      try {
        const j = await res.json();
        const d = j?.error?.details?.find((x) => String(x['@type']).includes('RetryInfo'))?.retryDelay;
        if (d) wait = Math.max(wait, (parseFloat(d) || 0) * 1000 + 1000);
      } catch { /* dùng backoff mặc định */ }
      console.log(`    (429, chờ ${Math.round(wait / 1000)}s rồi thử lại…)`);
      await sleep(wait);
      continue;
    }
    if (!res.ok) throw new Error(`Gemini ${res.status}`);
    const data = await res.json();
    const out = (data?.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join(' ');
    return out.replace(/\s+/g, ' ').trim();
  }
}

/** Tóm tắt dự phòng khi không có/AI lỗi: cắt ~280 ký tự ở ranh giới từ. */
function fallbackSummary(text) {
  const s = (text || '').replace(/\s+/g, ' ').trim();
  return s.length <= 500 ? s : s.slice(0, 280).replace(/\s+\S*$/, '') + '…';
}

// ---------- chế độ tóm tắt lại (không crawl) -------------------------
if (RESUMMARIZE) {
  if (!SUMMARIZE) { console.error('Chưa cấu hình gemini_api_key trong settings.'); process.exit(1); }
  let q = db.from('crawled_news').select('id,title,content,summary').eq('tenant_id', TENANT);
  if (ONLY_SOURCE) q = q.eq('source_id', ONLY_SOURCE);
  const { data: rs, error: e } = await q;
  if (e) { console.error(e); process.exit(1); }
  // Tóm tắt lại tin có nội dung đủ dài VÀ summary đang là fallback (kết thúc bằng …) hoặc rỗng.
  const todo = (rs ?? []).filter((r) => r.content && r.content.length > 200
    && (!r.summary || r.summary.endsWith('…')));
  console.log(`Tóm tắt lại ${todo.length}/${(rs ?? []).length} tin…`);
  let n = 0;
  for (const r of todo) {
    try {
      const sm = await summarize(r.title, r.content);
      if (sm) { await db.from('crawled_news').update({ summary: sm }).eq('id', r.id); n++; }
    } catch (err) { console.log('  bỏ qua:', r.title.slice(0, 40), '—', err.message); }
    await sleep(SUMMARY_DELAY_MS);
  }
  console.log(`Xong: ${n}/${todo.length} tin đã tóm tắt lại.`);
  process.exit(0);
}

// ---------- main ------------------------------------------------------
const { data: rows, error } = await db
  .from('sources').select('*')
  .eq('tenant_id', TENANT).eq('is_active', true);
if (error) { console.error(error); process.exit(1); }

let sources = rows ?? [];
if (ONLY_SOURCE) sources = sources.filter((s) => s.id === ONLY_SOURCE);
else if (!FORCE) sources = sources.filter(isDue);

console.log(`Crawl ${sources.length}/${(rows ?? []).length} nguồn` + (FORCE ? ' (--force)' : '') + '…');

let totalInserted = 0;
for (const s of sources) {
  const r = await crawlSource(s);
  totalInserted += r.inserted;
  const tag = r.error ? `LỖI: ${r.error}` : `found=${r.found} new=${r.inserted} skip=${r.skipped} cũ=${r.old} tóm tắt=${r.summarized}`;
  console.log(`  • ${s.name}: ${tag}`);
}
console.log(`Hoàn tất. Tổng tin mới: ${totalInserted}`);
process.exit(0);

// ---------- crawl 1 nguồn --------------------------------------------
async function crawlSource(s) {
  const report = { found: 0, inserted: 0, skipped: 0, old: 0, summarized: 0, error: undefined };
  try {
    const items = await fetchItems(s);
    report.found = items.length;
    for (const it of items) {
      // Bỏ tin cũ (chỉ khi xác định được ngày). Tin không ngày -> vẫn nạp.
      if (it.publishedAt && it.publishedAt.getTime() < AGE_CUTOFF) { report.old++; continue; }
      const id = await insertNewsIfNew(s, it);
      if (!id) { report.skipped++; continue; }
      report.inserted++;
      // Chỉ tóm tắt tin MỚI (tránh tốn quota cho tin trùng).
      let summary = null;
      if (SUMMARIZE && it.content && it.content.length > 200) {
        try { summary = await summarize(it.title, it.content); report.summarized++; }
        catch { summary = null; }
        await sleep(SUMMARY_DELAY_MS);
      }
      await db.from('crawled_news').update({ summary: summary || fallbackSummary(it.content || it.title) }).eq('id', id);
    }
    await db.from('sources').update({ last_crawled_at: new Date().toISOString() }).eq('id', s.id);
  } catch (e) {
    report.error = e?.message ?? String(e);
  }
  return report;
}

function fetchItems(s) {
  switch (s.type) {
    case 'rss':
      return parseRss(s.url);
    case 'facebook_page':
    case 'manual_upload':
    case 'telegram':
    case 'google_sheet':
      return Promise.resolve([]); // không crawl tự động ở script này
    default:
      return parseHtml(s.url, s.config ?? {});
  }
}

// ---------- parser RSS ------------------------------------------------
async function parseRss(feedUrl) {
  // Tự fetch rồi parseString thay vì parseURL: một số server (ASP.NET .gov.vn) trả
  // header không hợp lệ làm HTTP client của rss-parser chết ("Invalid header value char").
  const xml = await fetchText(feedUrl);
  const feed = await rss.parseString(xml);
  return (feed.items ?? []).map((it) => ({
    title: decodeEntities((it.title ?? '').trim()),
    content: decodeEntities((it.contentSnippet ?? it.content ?? '').trim()),
    publishedAt: it.isoDate ? new Date(it.isoDate) : null,
    originUrl: (it.link ?? '').trim(),
    imageUrl: it.media?.$?.url ?? it.enclosure?.url ?? (typeof it.img === 'string' ? it.img.trim() : null) ?? null,
  })).filter((i) => i.title && i.originUrl);
}

const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  ndash: '–', mdash: '—', hellip: '…', laquo: '«', raquo: '»', rsquo: '’', lsquo: '‘',
  ldquo: '“', rdquo: '”', copy: '©', reg: '®', deg: '°',
};
/** Giải mã HTML entity (gồm cả double-encoded của feed .gov.vn): &#244; → ô, &amp;#225; → á. */
function decodeEntities(s) {
  if (!s || !s.includes('&')) return s;
  let prev;
  // Lặp tối đa 2 vòng để xử lý double-encoding (&amp;#225; → &#225; → á).
  for (let i = 0; i < 2 && s !== prev; i++) {
    prev = s;
    s = s
      .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => safeCodePoint(parseInt(h, 16)))
      .replace(/&#(\d+);/g, (_, d) => safeCodePoint(parseInt(d, 10)))
      .replace(/&([a-zA-Z]+);/g, (m, name) => NAMED_ENTITIES[name] ?? m);
  }
  return s;
}
function safeCodePoint(cp) {
  try { return String.fromCodePoint(cp); } catch { return ''; }
}

// ---------- parser HTML (cheerio) ------------------------------------
async function parseHtml(pageUrl, config, fetchDetail = true) {
  const $ = cheerio.load(await fetchText(pageUrl));
  const base = new URL(pageUrl);
  const list = config.listSelector ? $(config.listSelector) : $('article');
  const items = [];

  for (const el of list.toArray()) {
    const node = $(el);
    const titleEl = config.titleSelector ? node.find(config.titleSelector) : node.find('a').first();
    // Fallback: nhiều site (Next.js SPA) đặt tiêu đề trong attr title= / alt= chứ không phải text.
    const title = decodeEntities(titleEl.first().text().trim()
      || titleEl.first().attr('title')?.trim()
      || node.find('img').first().attr('alt')?.trim()
      || '');
    const href = (config.linkSelector ? node.find(config.linkSelector) : titleEl).first().attr('href');
    if (!title || !href) continue;

    let originUrl;
    try { originUrl = new URL(href, base).toString(); } catch { continue; }

    const imageUrl = config.imageSelector
      ? absolutize(node.find(config.imageSelector).attr('src'), base)
      : absolutize(node.find('img').first().attr('src'), base);
    const dateText = config.dateSelector ? node.find(config.dateSelector).text().trim() : '';

    let content = node.text().replace(/\s+/g, ' ').trim();
    if (fetchDetail && config.contentSelector) {
      content = (await fetchDetailText(originUrl, config.contentSelector)) || content;
    }
    items.push({ title, content, publishedAt: parseVnDate(dateText), originUrl, imageUrl });
  }
  // Khử trùng nội bộ theo originUrl (trang chủ thường lặp link ở nhiều block).
  const seen = new Set();
  return items.filter((i) => (seen.has(i.originUrl) ? false : seen.add(i.originUrl)));
}

async function fetchDetailText(url, selector) {
  try {
    const $ = cheerio.load(await fetchText(url));
    const text = $(selector).text().replace(/\s+\n/g, '\n').replace(/\s{2,}/g, ' ').trim();
    return text || null;
  } catch { return null; }
}

// Tải HTML/XML bằng module http(s) core. Dùng insecureHTTPParser vì một số server
// .gov.vn (ASP.NET) trả header sai chuẩn khiến fetch()/undici chết. Theo tối đa 4 redirect.
function fetchText(url, redirects = 4) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('http://') ? http : https;
    const req = lib.get(url, {
      insecureHTTPParser: true,
      headers: { 'user-agent': UA, 'accept-encoding': 'gzip, deflate, br', accept: '*/*' },
    }, (res) => {
      const { statusCode = 0, headers } = res;
      if (statusCode >= 500 && statusCode < 400 && headers.location && redirects > 0) {
        res.resume();
        return resolve(fetchText(new URL(headers.location, url).toString(), redirects - 1));
      }
      if (statusCode < 200 || statusCode >= 500) { res.resume(); return reject(new Error(`HTTP ${statusCode}`)); }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        try {
          let buf = Buffer.concat(chunks);
          const enc = (headers['content-encoding'] || '').toLowerCase();
          if (enc.includes('br')) buf = brotliDecompressSync(buf);
          else if (enc.includes('gzip')) buf = gunzipSync(buf);
          else if (enc.includes('deflate')) buf = inflateSync(buf);
          resolve(buf.toString('utf8'));
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.setTimeout(FETCH_TIMEOUT_MS, () => { req.destroy(new Error('timeout')); });
  });
}

function absolutize(src, base) {
  if (!src) return null;
  try { return new URL(src, base).toString(); } catch { return null; }
}

function parseVnDate(text) {
  if (!text) return null;
  const dmy = text.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (dmy) return new Date(+dmy[3], +dmy[2] - 1, +dmy[1]);
  const d = new Date(text);
  return isNaN(d.getTime()) ? null : d;
}

// ---------- dedup + insert (khớp src/lib) -----------------------------
function normalizeTitle(title) {
  return title.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}
function dedupHash(originUrl, title) {
  return createHash('sha256').update(`${originUrl.trim()}|${normalizeTitle(title)}`).digest('hex');
}

/** Insert nếu chưa có. Trả id (string) nếu là tin mới, null nếu trùng. */
async function insertNewsIfNew(source, it) {
  const { data, error } = await db.from('crawled_news').insert({
    tenant_id: TENANT, source_id: source.id, title: it.title, content: it.content,
    published_at: it.publishedAt ? it.publishedAt.toISOString() : null,
    origin_url: it.originUrl, image_url: it.imageUrl, dedup_hash: dedupHash(it.originUrl, it.title),
  }).select('id').single();
  if (error) {
    if (error.code === '23505') return null; // trùng (unique tenant_id+dedup_hash)
    throw error;
  }
  return data.id;
}

// ---------- isDue (khớp src/lib/crawler) ------------------------------
function isDue(s, now = Date.now()) {
  if (!s.is_active) return false;
  if (!s.last_crawled_at) return true;
  return now >= new Date(s.last_crawled_at).getTime() + (s.crawl_interval_min ?? 360) * 60_000;
}
