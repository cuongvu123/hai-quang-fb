import { createHash } from 'crypto';

/** Chuẩn hoá tiêu đề: bỏ dấu phụ, hạ chữ, gộp khoảng trắng. */
export function normalizeTitle(title: string): string {
  return title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Hash chống trùng = sha256(originUrl + '|' + normalizedTitle). */
export function dedupHash(originUrl: string, title: string): string {
  return createHash('sha256')
    .update(`${originUrl.trim()}|${normalizeTitle(title)}`)
    .digest('hex');
}
