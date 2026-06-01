import type { ExtractedItem, GeneratedPost, MediaFile, NewsCategory } from '@/types';

/** Tin đầu vào tối giản truyền cho AI. */
export interface AiSourceNews {
  title: string;
  content: string;
  originUrl: string;
  publishedAt: string | null;
}

export interface GenerateArgs {
  systemPrompt: string;
  userPrompt: string;
}

/**
 * Hợp đồng chung cho mọi nhà cung cấp AI.
 * Đổi Claude <-> OpenAI chỉ bằng cách thay đổi factory ở `index.ts`.
 */
export interface AiProvider {
  readonly name: string;       // 'claude' | 'openai'
  readonly model: string;

  /** Sinh văn bản thô từ prompt. */
  complete(args: GenerateArgs): Promise<string>;

  /** Phân loại 1 tin vào danh mục. Trả về 'uncategorized' nếu không chắc. */
  classify(news: AiSourceNews): Promise<NewsCategory>;

  /** Sinh bài Facebook hoàn chỉnh (parse JSON từ model). */
  generatePost(args: GenerateArgs): Promise<GeneratedPost>;

  /**
   * (Tuỳ chọn) Trích xuất tin từ ảnh/PDF + ghi chú văn bản — cần model
   * đa phương thức (hiện chỉ Gemini hỗ trợ). Trả mảng tin chuẩn hoá.
   */
  extractFromMedia?(input: { files: MediaFile[]; note?: string }): Promise<ExtractedItem[]>;
}
