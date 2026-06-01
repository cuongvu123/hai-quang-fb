import type { NewsCategory } from '@/types';

const VALID_CATEGORIES: NewsCategory[] = [
  'admin_notice', 'education', 'health', 'culture', 'sports',
  'traffic', 'utilities', 'security', 'recruitment', 'community',
  'uncategorized',
];

/** Trích JSON object đầu tiên trong chuỗi (model đôi khi kèm markdown). */
export function extractJson<T>(raw: string): T {
  const cleaned = raw.replace(/```json|```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error(`Không tìm thấy JSON trong phản hồi AI: ${raw.slice(0, 200)}`);
  }
  return JSON.parse(cleaned.slice(start, end + 1)) as T;
}

/** Trích mảng JSON đầu tiên trong chuỗi (model có thể kèm markdown/giải thích). */
export function extractJsonArray<T>(raw: string): T[] {
  const cleaned = raw.replace(/```json|```/g, '').trim();
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start === -1 || end === -1) {
    // Có thể model trả 1 object lẻ — bọc thành mảng.
    const obj = cleaned.indexOf('{');
    if (obj !== -1) return [extractJson<T>(cleaned)];
    return [];
  }
  return JSON.parse(cleaned.slice(start, end + 1)) as T[];
}

/** Chuẩn hoá nhãn danh mục về enum hợp lệ. */
export function safeCategory(value: string | undefined): NewsCategory {
  const v = (value ?? '').trim().toLowerCase() as NewsCategory;
  return VALID_CATEGORIES.includes(v) ? v : 'uncategorized';
}
