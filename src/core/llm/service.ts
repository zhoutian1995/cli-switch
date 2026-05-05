export interface LLMServiceConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export class LLMService {
  constructor(private config: LLMServiceConfig) {}

  async chat(systemPrompt: string, userPrompt: string): Promise<string> {
    const resp = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0,
      }),
    });

    if (!resp.ok) {
      throw new Error(`LLM request failed: ${resp.status} ${await resp.text()}`);
    }

    const data = (await resp.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return data.choices?.[0]?.message?.content ?? '';
  }

  async chatJSON<T>(systemPrompt: string, userPrompt: string): Promise<T> {
    const content = await this.chat(systemPrompt, userPrompt);
    // Strip markdown code fences if present
    const cleaned = content.replace(/^```(?:json)?\s*\n?/m, '').replace(/\n?```\s*$/m, '');
    return JSON.parse(cleaned) as T;
  }
}
