import type { AiProvider, AiSourceNews } from './provider';
import { ClaudeProvider } from './providers/claude';
import { OpenAiProvider } from './providers/openai';
import { GeminiProvider } from './providers/gemini';
import { buildPostPrompt, SYSTEM_PROMPT } from './templates/prompts';
import type { CrawledNews, GeneratedPost, ModerationResult, PostTemplate } from '@/types';

export interface AiConfig {
  provider: 'claude' | 'openai' | 'gemini';
  claudeApiKey?: string;
  openaiApiKey?: string;
  geminiApiKey?: string;
  claudeModel?: string;
  openaiModel?: string;
  geminiModel?: string;
}

/** Dựng AiConfig từ bảng settings (dùng chung cho cron generate & ingest). */
export function aiConfigFromSettings(settings: Record<string, string>): AiConfig {
  return {
    provider: (settings.ai_provider as AiConfig['provider']) || 'gemini',
    claudeApiKey: settings.claude_api_key,
    openaiApiKey: settings.openai_api_key,
    geminiApiKey: settings.gemini_api_key,
    claudeModel: settings.claude_model,
    openaiModel: settings.openai_model,
    geminiModel: settings.gemini_model,
  };
}

/** Chọn provider theo settings của tenant. Đổi AI chỉ ở một chỗ. */
export function createAiProvider(cfg: AiConfig): AiProvider {
  if (cfg.provider === 'gemini') {
    if (!cfg.geminiApiKey) throw new Error('Thiếu Gemini API key');
    return new GeminiProvider(cfg.geminiApiKey, cfg.geminiModel);
  }
  if (cfg.provider === 'openai') {
    if (!cfg.openaiApiKey) throw new Error('Thiếu OpenAI API key');
    return new OpenAiProvider(cfg.openaiApiKey, cfg.openaiModel);
  }
  if (!cfg.claudeApiKey) throw new Error('Thiếu Claude API key');
  return new ClaudeProvider(cfg.claudeApiKey, cfg.claudeModel);
}

function toAiNews(n: CrawledNews): AiSourceNews {
  return {
    title: n.title,
    content: n.content,
    originUrl: n.originUrl,
    publishedAt: n.publishedAt,
  };
}

/** Sinh một bài đăng từ danh sách tin nguồn. */
export async function generateDraft(
  ai: AiProvider,
  template: PostTemplate,
  news: CrawledNews[],
): Promise<GeneratedPost> {
  const prompt = buildPostPrompt(template, news.map(toAiNews));
  return ai.generatePost({ systemPrompt: SYSTEM_PROMPT, userPrompt: prompt });
}

// --------------------------- MODERATION -----------------------------
const BANNED_WORDS = ['đm', 'vcl', 'đụ', 'lừa đảo', 'phản động']; // mở rộng theo nhu cầu

export interface ModerateInput {
  body: string;
  sourceNews: CrawledNews[];
  recentBodies: string[]; // body các bài đã đăng gần đây để chống trùng
}

/**
 * Moderation đơn giản, deterministic. Kết hợp được với 1 lượt AI review nếu cần.
 * Trả về passed=false nếu dính bất kỳ flag nghiêm trọng nào.
 */
export function moderate({ body, sourceNews, recentBodies }: ModerateInput): ModerationResult {
  const flags: ModerationResult['flags'] = [];

  // 1) nguồn không rõ ràng
  if (sourceNews.length === 0 || sourceNews.some((n) => !n.originUrl)) {
    flags.push('unclear_source');
  }
  // 2) thông tin quá cũ (> 14 ngày)
  const newest = sourceNews
    .map((n) => (n.publishedAt ? new Date(n.publishedAt).getTime() : 0))
    .sort((a, b) => b - a)[0];
  if (newest && Date.now() - newest > 14 * 864e5) flags.push('too_old');
  // 3) ngôn từ không phù hợp
  const lower = body.toLowerCase();
  if (BANNED_WORDS.some((w) => lower.includes(w))) flags.push('inappropriate_language');
  // 4) nội dung trùng (jaccard trên tập từ)
  if (recentBodies.some((b) => jaccard(b, body) > 0.7)) flags.push('duplicate');

  const passed = !flags.some((f) =>
    ['duplicate', 'inappropriate_language', 'sensitive_content', 'unclear_source'].includes(f),
  );
  const score = Math.max(0, 1 - flags.length * 0.25);
  return { passed, flags, score };
}

function jaccard(a: string, b: string): number {
  const sa = new Set(a.toLowerCase().split(/\s+/));
  const sb = new Set(b.toLowerCase().split(/\s+/));
  const inter = [...sa].filter((x) => sb.has(x)).length;
  const uni = new Set([...sa, ...sb]).size;
  return uni === 0 ? 0 : inter / uni;
}
