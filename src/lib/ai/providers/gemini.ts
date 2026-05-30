import type { AiProvider, AiSourceNews, GenerateArgs } from '../provider';
import type { GeneratedPost, NewsCategory } from '@/types';
import { buildClassifyPrompt, SYSTEM_PROMPT } from '../templates/prompts';
import { extractJson, safeCategory } from '../parse';

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
}
