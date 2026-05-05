import type { LLMService } from '../llm/service.js';

export interface QualityReport {
  score: number;
  issues: string[];
  suggestions: string[];
  pass: boolean;
}

const QUALITY_SYSTEM_PROMPT = `你是代码质量评估专家。评估以下代码完成指定任务的质量。

返回 JSON: {"score":0到10,"issues":["问题列表"],"suggestions":["改进建议"]}
score >= 7 视为通过。只返回 JSON，不要其他内容。`;

export async function evaluateQuality(
  code: string,
  task: string,
  llm: LLMService,
): Promise<QualityReport> {
  const userPrompt = `任务: ${task}\n\n代码:\n${code}`;

  const raw = await llm.chatJSON<{
    score: number;
    issues: string[];
    suggestions: string[];
  }>(QUALITY_SYSTEM_PROMPT, userPrompt);

  return {
    score: raw.score,
    issues: raw.issues ?? [],
    suggestions: raw.suggestions ?? [],
    pass: raw.score >= 7,
  };
}
