import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { LLMConfig, TaskIntent } from '../../types/agent.js';

const TYPE_KEYWORDS: Array<{ keywords: string[]; type: string }> = [
  { keywords: ['refactor', '重构'], type: '重构' },
  { keywords: ['debug', 'fix', 'bug', '调试', '修复'], type: '调试' },
  { keywords: ['test', 'spec', '测试'], type: '测试' },
  { keywords: ['explain', 'what', 'why', '解释', '说明', '是什么'], type: '解释' },
];

function matchType(input: string): string {
  const lower = input.toLowerCase();
  for (const { keywords, type } of TYPE_KEYWORDS) {
    if (keywords.some((k) => lower.includes(k))) {
      return type;
    }
  }
  return '代码生成';
}

function detectComplexity(input: string): string {
  const pathPattern = /(?:^|\s|['"`])([\w./\-]+\.[\w]+)(?:['"`]|\s|$)/g;
  const paths: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = pathPattern.exec(input)) !== null) {
    if (m[1].includes('/') || m[1].includes('.')) {
      paths.push(m[1]);
    }
  }
  if (paths.length >= 3) return '跨仓库';
  if (paths.length >= 1) return '多文件';
  return '单文件';
}

function detectTechStack(cwd?: string): string[] {
  const dir = cwd ?? process.cwd();
  const stack: string[] = [];
  if (existsSync(resolve(dir, 'package.json'))) stack.push('node');
  if (existsSync(resolve(dir, 'tsconfig.json'))) stack.push('typescript');
  if (existsSync(resolve(dir, 'Cargo.toml'))) stack.push('rust');
  if (existsSync(resolve(dir, 'go.mod'))) stack.push('go');
  return stack;
}

function detectLongContext(input: string): boolean {
  return input.length > 4000;
}

export async function parseIntent(input: string, llmConfig?: LLMConfig, cwd?: string): Promise<TaskIntent> {
  if (llmConfig) {
    try {
      const resp = await fetch(`${llmConfig.baseUrl}/chat/completions`, {
        method: 'POST',
        signal: AbortSignal.timeout(10_000),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${llmConfig.apiKey}`,
        },
        body: JSON.stringify({
          model: llmConfig.model,
          messages: [
            {
              role: 'system',
              content:
                '分析用户意图，返回 JSON: {"type":"代码生成|重构|调试|解释|测试","complexity":"单文件|多文件|跨仓库","needsLongContext":false,"techStack":[]}',
            },
            { role: 'user', content: input },
          ],
          temperature: 0,
        }),
      });
      const data = (await resp.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const content = data.choices?.[0]?.message?.content ?? '';
      const json = JSON.parse(content) as Partial<TaskIntent>;
      return {
        type: json.type ?? '代码生成',
        complexity: json.complexity ?? detectComplexity(input),
        needsLongContext: json.needsLongContext ?? detectLongContext(input),
        techStack: json.techStack ?? detectTechStack(cwd),
        rawInput: input,
      };
    } catch {
      // fall through to rules
    }
  }

  return {
    type: matchType(input),
    complexity: detectComplexity(input),
    needsLongContext: detectLongContext(input),
    techStack: detectTechStack(cwd),
    rawInput: input,
  };
}
