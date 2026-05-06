import { describe, it, expect } from 'vitest';
import { parseIntent } from '../../src/core/intent/parser.js';

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
const hasOpenRouter = !!OPENROUTER_KEY;

describe('intent parser (rules)', () => {
  it('detects refactor intent', async () => {
    const intent = await parseIntent('refactor the auth module');
    expect(intent.type).toBe('重构');
  });

  it('detects debug intent', async () => {
    const intent = await parseIntent('fix the null pointer bug');
    expect(intent.type).toBe('调试');
  });

  it('detects test intent', async () => {
    const intent = await parseIntent('write a test for the parser');
    expect(intent.type).toBe('测试');
  });

  it('detects explain intent', async () => {
    const intent = await parseIntent('explain how this function works');
    expect(intent.type).toBe('解释');
  });

  it('detects Chinese analysis intent', async () => {
    const intent = await parseIntent('分析一下这个错误');
    expect(intent.type).toBe('解释');
  });

  it('detects code review intent', async () => {
    const intent = await parseIntent('review the auth module code');
    expect(intent.type).toBe('代码审查');
  });

  it('detects Chinese 代码审查 intent', async () => {
    const intent = await parseIntent('代码审查一下这个PR');
    expect(intent.type).toBe('代码审查');
  });

  it('detects Chinese 为什么 intent', async () => {
    const intent = await parseIntent('为什么登录失败');
    expect(intent.type).toBe('解释');
  });

  it('defaults to code generation', async () => {
    const intent = await parseIntent('create a new API endpoint');
    expect(intent.type).toBe('代码生成');
  });

  it('detects Chinese keywords', async () => {
    const intent = await parseIntent('重构这个模块的类型定义');
    expect(intent.type).toBe('重构');
  });

  it('detects complexity from file paths', async () => {
    const intent = await parseIntent('fix src/auth.ts and lib/utils.ts and core/main.ts');
    expect(intent.complexity).toBe('跨仓库');
  });
});

// OpenRouter integration — only runs when API key is available
describe.skipIf(!hasOpenRouter)('intent parser (LLM via OpenRouter)', () => {
  it('calls OpenRouter API for intent analysis', async () => {
    const intent = await parseIntent('refactor the database layer', {
      baseUrl: 'https://openrouter.ai/api/v1',
      apiKey: OPENROUTER_KEY!,
      model: 'deepseek/deepseek-chat-v3-0324:free',
    });
    // LLM should return a structured type
    expect(intent.type).toBeTruthy();
    expect(['重构', '代码生成', '调试', '解释', '测试']).toContain(intent.type);
  }, 30_000);
});
