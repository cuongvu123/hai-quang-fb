import type { PostTemplate, NewsCategory } from '@/types';
import type { AiSourceNews } from '../provider';

export const CATEGORY_LABELS_VI: Record<NewsCategory, string> = {
  admin_notice: 'Thông báo hành chính',
  education: 'Giáo dục',
  health: 'Y tế',
  culture: 'Văn hóa',
  sports: 'Thể thao',
  traffic: 'Giao thông',
  utilities: 'Điện nước',
  security: 'An ninh trật tự',
  recruitment: 'Tuyển dụng',
  community: 'Hoạt động cộng đồng',
  uncategorized: 'Chưa phân loại',
};

const TEMPLATE_GUIDE: Record<PostTemplate, string> = {
  weekly_open:
    'BẢN TIN ĐẦU TUẦN: mở đầu chào tuần mới, tổng hợp 3-5 tin nổi bật sắp tới trong tuần, giọng tích cực.',
  midweek:
    'ĐIỂM TIN GIỮA TUẦN: cập nhật nhanh 2-4 tin đáng chú ý, ngắn gọn, đi thẳng vào việc.',
  weekend:
    'TỔNG HỢP CUỐI TUẦN: nhìn lại các sự kiện/thông báo trong tuần, giọng ấm áp, gợi mở cuối tuần.',
  urgent:
    'THÔNG BÁO KHẨN: 1 sự việc cần chú ý ngay (cắt điện/nước, thời tiết, an ninh...). Rõ ràng, nhấn mạnh thời gian & khu vực, kêu gọi hành động cụ thể.',
  event:
    'SỰ KIỆN SẮP DIỄN RA: giới thiệu 1 sự kiện sắp tới, nêu rõ thời gian, địa điểm, đối tượng tham gia.',
};

/** System prompt chung — đặt rào chắn về phong cách & sự thật. */
export const SYSTEM_PROMPT = `Bạn là biên tập viên cho trang thông tin cộng đồng của một xã ở Việt Nam.
Nhiệm vụ: viết bài đăng Facebook cho nhóm cộng đồng địa phương dựa trên các bản tin được cung cấp.

QUY TẮC BẮT BUỘC:
- Độ dài 300–500 từ.
- Văn phong thân thiện, gần gũi, dễ đọc với mọi lứa tuổi ở nông thôn/đô thị nhỏ.
- KHÔNG giật tít, không phóng đại, không câu view.
- TUYỆT ĐỐI KHÔNG thêm thông tin không có trong nguồn. Nếu nguồn thiếu thời gian/địa điểm, không được bịa.
- Dùng emoji vừa phải (3–6 emoji liên quan), không lạm dụng.
- Luôn có tiêu đề ngắn gọn ở đầu.
- Không bình luận chính trị, không nội dung nhạy cảm, không thông tin cá nhân.
- Viết hoàn toàn bằng tiếng Việt có dấu.`;

export function buildPostPrompt(
  template: PostTemplate,
  news: AiSourceNews[],
): string {
  const items = news
    .map(
      (n, i) =>
        `[Tin ${i + 1}] ${n.title}\nNgày: ${n.publishedAt ?? 'không rõ'}\nNguồn: ${n.originUrl}\nNội dung: ${n.content.slice(0, 1500)}`,
    )
    .join('\n\n');

  return `Loại bài: ${TEMPLATE_GUIDE[template]}

Dưới đây là các tin nguồn (chỉ được dùng thông tin trong đây):

${items}

Hãy viết bài đăng Facebook theo đúng quy tắc.
Trả về DUY NHẤT một object JSON (không markdown, không giải thích) dạng:
{"title": "...", "body": "...", "category": "<một trong: ${Object.keys(CATEGORY_LABELS_VI).join(', ')}>"}`;
}

export function buildClassifyPrompt(news: AiSourceNews): string {
  return `Phân loại tin sau vào ĐÚNG MỘT danh mục.
Danh mục hợp lệ: ${Object.keys(CATEGORY_LABELS_VI).join(', ')}.

Tiêu đề: ${news.title}
Nội dung: ${news.content.slice(0, 1200)}

Chỉ trả về tên danh mục (snake_case), không thêm gì khác.`;
}
