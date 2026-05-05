import type { AgentId, AgentProcess, RunResult } from '../../types/agent.js';

export function buildResult(
  process: AgentProcess,
  startTime: number,
  suggestedFallback?: AgentId,
): RunResult {
  return {
    ok: process.status === 'completed',
    agent: process.agent,
    output: process.stdout || process.stderr,
    exitCode: process.exitCode,
    durationMs: Date.now() - startTime,
    ...(suggestedFallback ? { suggestedFallback } : {}),
  };
}
