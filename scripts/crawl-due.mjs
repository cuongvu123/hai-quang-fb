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

// User-Agent trình duyệt thật — vài site/WAF chặn UA lạ.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const FETCH_TIMEOUT_MS = 25_000;

const db = createClient(SUPA_URL, SERVICE, { auth: { persistSession: false } });
const rss = new Parser({
  headers: { 'user-agent': UA },
  timeout: FETCH_TIMEOUT_MS,
  customFields: { item: [['media:content', 'media'], ['enclosure', 'enclosure'], ['img', 'img']] },
});

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
  const tag = r.error ? `LỖI: ${r.error}` : `found=${r.found} new=${r.inserted} skip=${r.skipped}`;
  console.log(`  • ${s.name}: ${tag}`);
}
console.log(`Hoàn tất. Tổng tin mới: ${totalInserted}`);
process.exit(0);

// ---------- crawl 1 nguồn --------------------------------------------
async function crawlSource(s) {
  const report = { found: 0, inserted: 0, skipped: 0, error: undefined };
  try {
    const items = await fetchItems(s);
    report.found = items.length;
    for (const it of items) {
      const ok = await insertNewsIfNew(s, it);
      ok ? report.inserted++ : report.skipped++;
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
    title: (it.title ?? '').trim(),
    content: (it.contentSnippet ?? it.content ?? '').trim(),
    publishedAt: it.isoDate ? new Date(it.isoDate) : null,
    originUrl: (it.link ?? '').trim(),
    imageUrl: it.media?.$?.url ?? it.enclosure?.url ?? (typeof it.img === 'string' ? it.img.trim() : null) ?? null,
  })).filter((i) => i.title && i.originUrl);
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
    const title = (titleEl.first().text().trim()
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
      if (statusCode >= 300 && statusCode < 400 && headers.location && redirects > 0) {
        res.resume();
        return resolve(fetchText(new URL(headers.location, url).toString(), redirects - 1));
      }
      if (statusCode < 200 || statusCode >= 300) { res.resume(); return reject(new Error(`HTTP ${statusCode}`)); }
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

async function insertNewsIfNew(source, it) {
  const { error } = await db.from('crawled_news').insert({
    tenant_id: TENANT, source_id: source.id, title: it.title, content: it.content,
    published_at: it.publishedAt ? it.publishedAt.toISOString() : null,
    origin_url: it.originUrl, image_url: it.imageUrl, dedup_hash: dedupHash(it.originUrl, it.title),
  });
  if (error) {
    if (error.code === '23505') return false; // trùng (unique tenant_id+dedup_hash)
    throw error;
  }
  return true;
}

// ---------- isDue (khớp src/lib/crawler) ------------------------------
function isDue(s, now = Date.now()) {
  if (!s.is_active) return false;
  if (!s.last_crawled_at) return true;
  return now >= new Date(s.last_crawled_at).getTime() + (s.crawl_interval_min ?? 360) * 60_000;
}
