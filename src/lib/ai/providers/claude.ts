import type { AiProvider, AiSourceNews, GenerateArgs } from '../provider';
import type { GeneratedPost, NewsCategory } from '@/types';
import { buildClassifyPrompt, SYSTEM_PROMPT } from '../templates/prompts';
import { extractJson, safeCategory } from '../parse';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

export class ClaudeProvider implements AiProvider {
  readonly name = 'claude';
  constructor(
    private apiKey: string,
    readonly model = 'claude-opus-4-8',
  ) {}

  async complete({ systemPrompt, userPrompt }: GenerateArgs): Promise<string> {
    const res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 1500,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
    if (!res.ok) {
      throw new Error(`Claude API ${res.status}: ${await res.text()}`);
    }
    const data = await res.json();
    return (data.content ?? [])
      .filter((b: { type: string }) => b.type === 'text')
      .map((b: { text: string }) => b.text)
      .join('\n')
      .trim();
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
