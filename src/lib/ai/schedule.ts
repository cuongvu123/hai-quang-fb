import type { PostTemplate } from '@/types';

/** Chọn template theo thứ trong tuần (giờ VN). */
export function pickTemplate(now: Date): PostTemplate {
  const day = now.getDay(); // 0=CN ... 1=T2
  if (day === 1) return 'weekly_open';   // đầu tuần
  if (day === 3 || day === 4) return 'midweek'; // giữa tuần
  if (day === 6 || day === 0) return 'weekend';  // cuối tuần
  return 'midweek';
}
