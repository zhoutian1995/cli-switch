import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LLMService } from '../../src/core/llm/service.js';
import { createLLMService } from '../../src/core/llm/index.js';

describe('LLMService', () => {
  let service: LLMService;

  beforeEach(() => {
    service = new LLMService({
      baseUrl: 'https://openrouter.ai/api/v1',
      apiKey: 'test-key',
      model: 'test-model',
    });
  });

  it('chat() should return content from API response', async () => {
    const mockResponse = {
      choices: [{ message: { content: 'Hello from LLM' } }],
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    }));

    const result = await service.chat('system', 'user');
    expect(result).toBe('Hello from LLM');

    const call = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toBe('https://openrouter.ai/api/v1/chat/completions');
    const body = JSON.parse(call[1].body as string);
    expect(body.messages).toEqual([
      { role: 'system', content: 'system' },
      { role: 'user', content: 'user' },
    ]);
  });

  it('chat() should throw on non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Unauthorized'),
    }));

    await expect(service.chat('sys', 'usr')).rejects.toThrow('LLM request failed: 401');
  });

  it('chatJSON() should parse JSON response', async () => {
    const mockResponse = {
      choices: [{ message: { content: '{"agent":"codex","reason":"test","confidence":0.9}' } }],
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    }));

    const result = await service.chatJSON<{ agent: string }>('sys', 'usr');
    expect(result.agent).toBe('codex');
  });

  it('chatJSON() should strip markdown code fences', async () => {
    const mockResponse = {
      choices: [{ message: { content: '```json\n{"score": 8}\n```' } }],
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    }));

    const result = await service.chatJSON<{ score: number }>('sys', 'usr');
    expect(result.score).toBe(8);
  });
});

describe('createLLMService', () => {
  it('should return null when no API key', () => {
    delete process.env.OPENROUTER_API_KEY;
    expect(createLLMService()).toBeNull();
  });

  it('should create service from env var', () => {
    process.env.OPENROUTER_API_KEY = 'sk-test';
    const svc = createLLMService();
    expect(svc).not.toBeNull();
    delete process.env.OPENROUTER_API_KEY;
  });

  it('should create service from explicit config', () => {
    const svc = createLLMService({ apiKey: 'explicit-key' });
    expect(svc).not.toBeNull();
  });
});
