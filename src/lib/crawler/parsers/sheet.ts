import type { ParsedItem } from '@/types';

/**
 * Parser cho Google Sheet — cách nạp tin dễ nhất cho người non-tech:
 * người dùng gõ tin vào một Google Sheet đã "Publish to web", mỗi dòng = 1 tin.
 *
 * Hỗ trợ cả 3 dạng URL:
 *   - .../spreadsheets/d/<ID>/edit            (link chia sẻ thường)
 *   - .../spreadsheets/d/e/<KEY>/pub?output=csv (publish to web)
 *   - .../spreadsheets/d/<ID>/gviz/tq?tqx=out:csv
 *
 * Cột (hàng đầu là tiêu đề cột, không phân biệt hoa thường, có/không dấu):
 *   title|tiêu đề   · content|nội dung   · date|ngày
 *   image|ảnh|image_url   · link|url|nguồn   (2 cột cuối tuỳ chọn)
 */
export async function parseSheet(sheetUrl: string): Promise<ParsedItem[]> {
  const csvUrl = toCsvUrl(sheetUrl);
  const res = await fetch(csvUrl, { redirect: 'follow' });
  if (!res.ok) {
    throw new Error(`Google Sheet ${res.status}: kiểm tra đã "Publish to web" và để công khai chưa`);
  }
  const rows = parseCsv(await res.text());
  if (rows.length < 2) return [];

  const header = rows[0].map((h) => normalizeKey(h));
  const col = (keys: string[]) => header.findIndex((h) => keys.includes(h));
  const iTitle = col(['title', 'tieu de', 'tieude']);
  const iContent = col(['content', 'noi dung', 'noidung', 'tom tat', 'mo ta']);
  const iDate = col(['date', 'ngay', 'published', 'ngay dang']);
  const iImage = col(['image', 'anh', 'image url', 'imageurl', 'hinh']);
  const iLink = col(['link', 'url', 'nguon', 'origin']);

  const items: ParsedItem[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const at = (i: number) => (i >= 0 && i < row.length ? row[i].trim() : '');
    const title = at(iTitle);
    const content = at(iContent);
    if (!title && !content) continue; // bỏ dòng trống
    const dateStr = at(iDate);
    const parsedDate = dateStr ? new Date(dateStr) : null;
    items.push({
      title: title || content.slice(0, 80),
      content: content || title,
      publishedAt: parsedDate && !isNaN(parsedDate.getTime()) ? parsedDate : null,
      originUrl: at(iLink),
      imageUrl: at(iImage) || null,
    });
  }
  return items;
}

/** Chuẩn hoá link Google Sheet về dạng xuất CSV. */
function toCsvUrl(url: string): string {
  const u = url.trim();
  if (/output=csv|out:csv/i.test(u)) return u; // đã là CSV
  const idMatch = u.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (idMatch) {
    const gid = u.match(/[#&?]gid=(\d+)/)?.[1] ?? '0';
    return `https://docs.google.com/spreadsheets/d/${idMatch[1]}/gviz/tq?tqx=out:csv&gid=${gid}`;
  }
  return u; // để fetch thử, sẽ báo lỗi rõ nếu sai
}

/** Bỏ dấu tiếng Việt + hạ chữ + gộp khoảng trắng (để khớp tên cột linh hoạt). */
function normalizeKey(s: string): string {
  return s.normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

/** CSV parser tối giản: hỗ trợ trường có dấu ngoặc kép, dấu phẩy & xuống dòng bên trong. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  const src = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; } // "" -> "
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n') {
      row.push(field); rows.push(row); field = ''; row = [];
    } else field += c;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}
