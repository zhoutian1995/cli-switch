/**
 * Strategy Engine Types — v0.3 多步编排
 *
 * @see docs/specs/routing-spec.md §2.3 策略选择规则
 * @see docs/specs/runtime-spec.md §1.2 Execution State
 */

import type { CapabilityId } from './capability.js';
import type { AgentId } from './agent.js';
import type { Tier } from './gateway.js';

// ─── Strategy 定义 ────────────────────────────────────────────

/** 策略模板名称 */
export type StrategyName = 'single' | 'write_review' | 'write_test_fix' | 'high_quality';

/** 单步定义 */
export interface StrategyStep {
  /** 步骤序号（1-indexed） */
  step: number;
  /** 本步执行的 Capability */
  capability: CapabilityId;
  /** 失败处理: abort | retry | loop */
  onFail: 'abort' | 'retry' | 'loop';
  /** 可选的 tier 覆盖（如 high_quality 强制 premium） */
  tierOverride?: Tier;
}

/** 策略定义 */
export interface StrategyDefinition {
  name: StrategyName;
  label: string;
  description: string;
  steps: StrategyStep[];
  /** 是否启用 Loop（写→测→修循环） */
  loop: boolean;
  /** Loop 最大迭代次数 */
  maxIterations: number;
  /** 默认 tier（未指定 tierOverride 的步骤） */
  defaultTier: Tier;
}

// ─── 错误分类 ─────────────────────────────────────────────────

/** 错误类型（runtime-spec §2.1） */
export type ErrorType =
  | 'syntax_error'
  | 'test_failure'
  | 'runtime_error'
  | 'agent_error'
  | 'timeout'
  | 'unknown';

/** 错误记录 */
export interface ErrorRecord {
  step: number;
  capability: CapabilityId;
  iteration: number;
  errorType: ErrorType;
  errorOutput: string;
  repairAction: string;
}

// ─── Execution State ──────────────────────────────────────────

/** Validated output from a capability execution */
export type ValidatedOutput = {
  status: 'success' | 'failed';
  summary: string;
  [key: string]: unknown;
};

/** 单步执行历史 */
export interface StepHistory {
  step: number;
  capability: CapabilityId;
  status: 'success' | 'failed';
  agent: AgentId;
  output?: string;
  /** Validated structured output (if validation was performed) */
  validatedOutput?: ValidatedOutput;
  durationMs: number;
  /** Per-step token usage (runtime-spec §1.2) */
  tokensUsed?: number;
}

/** 全局执行状态（runtime-spec §1.2） */
export interface ExecutionState {
  strategyName: StrategyName;
  currentStep: number;
  currentCapability: CapabilityId;
  totalSteps: number;

  iteration: number;
  maxIterations: number;

  history: StepHistory[];
  errors: ErrorRecord[];

  totalTokensUsed: number;
  totalDurationMs: number;
  startTime: string; // ISO 8601
}

// ─── Decision Trace ───────────────────────────────────────────

/** Loop 迭代记录 */
export interface LoopIteration {
  iteration: number;
  step: string;
  result: 'passed' | 'failed';
  errorType?: ErrorType;
}

/** 决策追溯（runtime-spec §1.3） */
export interface DecisionTrace {
  capability: CapabilityId;
  strategy: StrategyName;
  agentReason: string;
  modelReason: string;
  loopIterations?: LoopIteration[];
}

// ─── Strategy Result ──────────────────────────────────────────

/** 策略执行结果 */
export interface StrategyResult {
  status: 'success' | 'failed';
  summary: string;
  strategy: StrategyName;
  agent: AgentId;
  tier: Tier;
  model?: string;
  filesChanged?: string[];
  diff?: string;
  errors?: ErrorRecord[];
  iterations?: number;
  durationMs: number;
  decisionTrace: DecisionTrace;
}
