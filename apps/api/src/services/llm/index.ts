import type { LLMProvider } from './types.js';
import { OpenAIProvider } from './openai-provider.js';
import { GeminiProvider } from './gemini-provider.js';

export type ProviderType = 'openai' | 'gemini';

export function createLLMProvider(
  provider: ProviderType = 'openai',
  apiKey?: string,
  model?: string
): LLMProvider {
  const key = apiKey || getApiKey(provider);

  switch (provider) {
    case 'openai':
      return new OpenAIProvider(key, model || 'gpt-4o-mini');
    case 'gemini':
      return new GeminiProvider(key, model || 'gemini-2.5-flash');
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

function getApiKey(provider: ProviderType): string {
  switch (provider) {
    case 'openai':
      const openaiKey = process.env.OPENAI_API_KEY;
      if (!openaiKey) throw new Error('OPENAI_API_KEY environment variable is required');
      return openaiKey;
    case 'gemini':
      const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
      if (!geminiKey) throw new Error('GEMINI_API_KEY environment variable is required');
      return geminiKey;
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

export * from './types.js';
export { OpenAIProvider } from './openai-provider.js';
export { GeminiProvider } from './gemini-provider.js';
