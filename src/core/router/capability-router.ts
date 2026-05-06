/**
 * Capability-based routing rules — Auto mode.
 *
 * Maps CapabilityId → preferred AgentId based on routing-spec §2.2:
 *
 * | Condition | Agent | Reason |
 * |-----------|-------|--------|
 * | write_code / review_code / refactor / fix_error / analyze | claude-code | Complex reasoning, long context |
 * | write_tests / run_tests / explain | codex | Fast generation, lightweight tasks |
 *
 * Priority:
 * 1. Custom config (per-capability agent override) — v0.4
 * 2. Built-in capability rules (this module)
 * 3. LLM-assisted routing (fallback)
 */

import type { AgentId } from '../../types/agent.js';
import type { CapabilityId } from '../../types/capability.js';

/** Built-in default: capability → preferred agent. */
const CAPABILITY_AGENT_MAP: Record<CapabilityId, AgentId> = {
  write_code: 'claude-code',
  review_code: 'claude-code',
  refactor: 'claude-code',
  fix_error: 'claude-code',
  analyze: 'codex',
  write_tests: 'codex',
  run_tests: 'codex',
  explain: 'codex',
};

/** Human-readable reason for each capability→agent mapping. */
const CAPABILITY_AGENT_REASON: Record<CapabilityId, string> = {
  write_code: '代码生成需要强推理',
  review_code: '代码审查需要强推理',
  refactor: '重构需要长上下文和推理',
  fix_error: '调试修复需要强推理',
  analyze: '分析适合快速Agent',
  write_tests: '测试生成适合快速Agent',
  run_tests: '跑测试适合快速Agent',
  explain: '解释适合轻量Agent',
};

/**
 * Route a capability to its default agent.
 *
 * Returns null if the capability is not in the built-in map
 * (shouldn't happen if CapabilityId is exhaustive).
 */
export function routeByCapability(
  capability: CapabilityId,
): { agent: AgentId; reason: string } | null {
  const agent = CAPABILITY_AGENT_MAP[capability];
  if (!agent) return null;
  return { agent, reason: CAPABILITY_AGENT_REASON[capability] ?? 'capability规则路由' };
}
