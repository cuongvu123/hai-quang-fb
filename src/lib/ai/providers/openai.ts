import type { AiProvider, AiSourceNews, GenerateArgs } from '../provider';
import type { GeneratedPost, NewsCategory } from '@/types';
import { buildClassifyPrompt, SYSTEM_PROMPT } from '../templates/prompts';
import { extractJson, safeCategory } from '../parse';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

export class OpenAiProvider implements AiProvider {
  readonly name = 'openai';
  constructor(
    private apiKey: string,
    readonly model = 'gpt-4o',
  ) {}

  async complete({ systemPrompt, userPrompt }: GenerateArgs): Promise<string> {
    const res = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 1500,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });
    if (!res.ok) {
      throw new Error(`OpenAI API ${res.status}: ${await res.text()}`);
    }
    const data = await res.json();
    return (data.choices?.[0]?.message?.content ?? '').trim();
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
