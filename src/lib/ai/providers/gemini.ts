import type { AiProvider, AiSourceNews, GenerateArgs } from '../provider';
import type { ExtractedItem, GeneratedPost, MediaFile, NewsCategory } from '@/types';
import { buildClassifyPrompt, SYSTEM_PROMPT } from '../templates/prompts';
import { extractJson, extractJsonArray, safeCategory } from '../parse';

const EXTRACT_PROMPT = `Bạn là trợ lý số hoá thông báo của chính quyền cấp xã.
Hãy ĐỌC kỹ các tệp ảnh/PDF (và ghi chú nếu có) rồi trích xuất các MẨU TIN riêng biệt.
Chỉ dùng thông tin THỰC SỰ có trong tệp, KHÔNG bịa.
Trả về DUY NHẤT một mảng JSON, mỗi phần tử:
{ "title": "tiêu đề ngắn gọn", "content": "toàn bộ nội dung đọc được, giữ số liệu/ngày giờ/địa điểm", "publishedAt": "YYYY-MM-DD hoặc null" }
Nếu tệp chỉ chứa 1 thông báo, trả mảng 1 phần tử. Không thêm chữ nào ngoài JSON.`;

/**
 * Gemini provider — free tier của Google AI Studio.
 * Mặc định dùng `gemini-2.5-flash-lite`: 15 RPM / 1000 RPD / 1M token context.
 * Lấy API key tại https://aistudio.google.com/apikey (không cần thẻ).
 */
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export class GeminiProvider implements AiProvider {
  readonly name = 'gemini';
  constructor(
    private apiKey: string,
    readonly model = 'gemini-2.5-flash-lite',
  ) {}

  async complete({ systemPrompt, userPrompt }: GenerateArgs): Promise<string> {
    const url = `${GEMINI_BASE}/${this.model}:generateContent?key=${this.apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 1500 },
      }),
    });
    if (!res.ok) {
      throw new Error(`Gemini API ${res.status}: ${await res.text()}`);
    }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p.text ?? '')
      .join('\n') ?? '';
    return text.trim();
  }

  async classify(news: AiSourceNews): Promise<NewsCategory> {
    const raw = await this.complete({
      systemPrompt: 'Bạn là bộ phân loại tin tức. Chỉ trả về một nhãn.',
      userPrompt: buildClassifyPrompt(news),
    });
    return safeCategory(raw);
  }

  async generatePost(args: GenerateArgs): Promise<GeneratedPost> {
    const raw = await this.complete({
      systemPrompt: args.systemPrompt || SYSTEM_PROMPT,
      userPrompt: args.userPrompt,
    });
    const json = extractJson<GeneratedPost>(raw);
    return { ...json, category: safeCategory(json.category) };
  }

  /** Đọc ảnh/PDF bằng Gemini multimodal → mảng tin chuẩn hoá. */
  async extractFromMedia({ files, note }: { files: MediaFile[]; note?: string }): Promise<ExtractedItem[]> {
    const url = `${GEMINI_BASE}/${this.model}:generateContent?key=${this.apiKey}`;
    const parts: Array<Record<string, unknown>> = files.map((f) => ({
      inline_data: { mime_type: f.mimeType, data: f.dataBase64 },
    }));
    if (note?.trim()) parts.push({ text: `Ghi chú kèm theo: ${note.trim()}` });

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: EXTRACT_PROMPT }] },
        contents: [{ role: 'user', parts }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 4000 },
      }),
    });
    if (!res.ok) {
      throw new Error(`Gemini API ${res.status}: ${await res.text()}`);
    }
    const data = await res.json();
    const text: string = data?.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p.text ?? '').join('\n') ?? '';

    return extractJsonArray<ExtractedItem>(text)
      .map((it) => ({
        title: (it.title ?? '').trim(),
        content: (it.content ?? '').trim(),
        publishedAt: normalizeDate(it.publishedAt),
      }))
      .filter((it) => it.title || it.content);
  }
}

/** Đưa chuỗi ngày về ISO (hoặc null nếu không hợp lệ / 'null'). */
function normalizeDate(v: unknown): string | null {
  if (!v || typeof v !== 'string' || v.trim().toLowerCase() === 'null') return null;
  const d = new Date(v.trim());
  return isNaN(d.getTime()) ? null : d.toISOString();
}
