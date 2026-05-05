export { LLMService } from './service.js';
export type { LLMServiceConfig } from './service.js';

import { LLMService, type LLMServiceConfig } from './service.js';

export function createLLMService(config?: Partial<LLMServiceConfig>): LLMService | null {
  const apiKey = config?.apiKey ?? process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  return new LLMService({
    baseUrl: config?.baseUrl ?? 'https://openrouter.ai/api/v1',
    model: config?.model ?? 'deepseek/deepseek-chat-v3-0324:free',
    apiKey,
  });
}
