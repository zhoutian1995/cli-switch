import type { LLMService } from '../llm/service.js';

export interface CodeReview {
  approved: boolean;
  issues: string[];
  suggestions: string[];
  summary: string;
}

const REVIEW_SYSTEM_PROMPT = `你是高级代码审查专家。审查以下代码是否正确完成了指定任务。

返回 JSON: {"approved":true或false,"issues":["问题列表"],"suggestions":["改进建议"],"summary":"审查摘要"}
只返回 JSON，不要其他内容。`;

export async function reviewCode(
  code: string,
  task: string,
  llm: LLMService,
): Promise<CodeReview> {
  const userPrompt = `任务: ${task}\n\n代码:\n${code}`;

  return llm.chatJSON<CodeReview>(REVIEW_SYSTEM_PROMPT, userPrompt);
}
