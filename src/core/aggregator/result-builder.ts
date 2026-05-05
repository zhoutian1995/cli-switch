import type { AgentProcess, RunResult } from '../../types/agent.js';

export function buildResult(process: AgentProcess, startTime: number): RunResult {
  return {
    ok: process.status === 'completed',
    agent: process.agent,
    output: process.stdout || process.stderr,
    exitCode: process.exitCode,
    durationMs: Date.now() - startTime,
  };
}
