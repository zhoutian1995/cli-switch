/** Agent orchestration types */

export type AgentId = 'claude-code' | 'codex' | 'gemini' | 'opencode' | 'aider';

export interface TaskIntent {
  type: string;
  complexity: string;
  needsLongContext: boolean;
  techStack: string[];
  rawInput: string;
}

export interface RoutingDecision {
  agent: AgentId;
  model?: string;
  reason: string;
  confidence: number;
}

export interface AgentProcess {
  id: string;
  agent: AgentId;
  pid?: number;
  status: 'starting' | 'running' | 'completed' | 'failed';
  stdout: string;
  stderr: string;
  exitCode?: number;
}

export type OrchestrationMode = 'single' | 'orchestrator' | 'handoff' | 'review';

export interface RunRequest {
  input: string;
  mode?: OrchestrationMode;
  preferredAgent?: AgentId;
  maxConcurrency?: number;
  timeoutMs?: number;
}

export interface RunResult {
  ok: boolean;
  agent: AgentId;
  output: string;
  exitCode?: number;
  durationMs: number;
  fallback?: boolean;
}

export interface LLMConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}
