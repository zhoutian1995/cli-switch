/**
 * Strategy Engine — 多步编排执行器
 *
 * 接收 StrategyDefinition + ExecutionState，按步骤执行每个 Capability，
 * 处理 Loop 迭代、错误分类和升级链。
 *
 * Routing 通过 RouteResolver 接口注入，engine 不直接依赖 router 模块，
 * 保证 CLI 的 --agent/--tier 覆盖能传递到每一步。
 *
 * @see docs/specs/routing-spec.md §2.3
 * @see docs/specs/runtime-spec.md §1.2
 */

import type { AgentId } from '../../types/agent.js';
import type { CapabilityId } from '../../types/capability.js';
import type {
  StrategyDefinition,
  StrategyName,
  ExecutionState,
  StrategyResult,
  StepHistory,
  ErrorRecord,
  DecisionTrace,
  LoopIteration,
} from '../../types/strategy.js';
import type { Tier } from '../../types/gateway.js';
import { classifyError, createErrorRecord } from './error-classifier.js';
import { validateOutput } from '../validation/validator.js';
import { repairOutput, resetRepairCounter } from '../validation/repair.js';

// ─── Route Resolver Interface ────────────────────────────────

/** 路由解析器 — 由 CLI 注入，包含 --agent/--tier 覆盖 */
export interface RouteResolver {
  (
    capability: CapabilityId,
    stepTierOverride?: Tier,
  ): { agent: AgentId; tier: Tier; reason: string };
}

// ─── Step Executor Interface ──────────────────────────────────

/** 单步执行器 — 由 cmd/run.ts 注入实际 Agent 执行逻辑 */
export interface StepExecutor {
  (
    capability: CapabilityId,
    agent: AgentId,
    tier: Tier,
    prompt: string,
    context: string,
  ): Promise<{
    ok: boolean;
    output: string;
    exitCode?: number;
    durationMs: number;
    agent: AgentId;
  }>;
}

// ─── Execution State Builder ──────────────────────────────────

/**
 * Create initial ExecutionState for a strategy.
 */
export function createExecutionState(
  strategy: StrategyDefinition,
): ExecutionState {
  return {
    strategyName: strategy.name,
    currentStep: 1,
    currentCapability: strategy.steps[0].capability,
    totalSteps: strategy.steps.length,
    iteration: 1,
    maxIterations: strategy.maxIterations,
    history: [],
    errors: [],
    totalTokensUsed: 0,
    totalDurationMs: 0,
    startTime: new Date().toISOString(),
  };
}

// ─── Strategy Engine ──────────────────────────────────────────

/**
 * Execute a strategy.
 *
 * For `single` mode: runs only the first step, no loop.
 * For multi-step strategies: runs through all steps, handles loops and failures.
 *
 * `resolver` is injected by CLI so --agent/--tier overrides propagate to every step.
 *
 * Returns the final StrategyResult.
 */
export async function executeStrategy(
  strategy: StrategyDefinition,
  prompt: string,
  executor: StepExecutor,
  resolver: RouteResolver,
  state?: ExecutionState,
): Promise<StrategyResult> {
  const execState = state ?? createExecutionState(strategy);
  const startTime = Date.now();
  const loopIterations: LoopIteration[] = [];
  const validatedOutputs: Record<string, unknown> = {};

  let finalAgent: AgentId = 'claude-code';
  let finalTier: Tier = strategy.defaultTier;
  let finalReason = '';

  // Reset repair counter at start of strategy execution
  resetRepairCounter();

  // For single strategy, just execute step 1 (no validation hook)
  if (!strategy.loop && strategy.steps.length === 1) {
    const step = strategy.steps[0];
    const route = resolver(step.capability, step.tierOverride);
    const agent = route.agent;
    const tier = route.tier;

    const result = await executor(step.capability, agent, tier, prompt, '');

    finalAgent = result.agent;
    finalTier = tier;
    finalReason = route.reason;

    execState.history.push({
      step: 1,
      capability: step.capability,
      status: result.ok ? 'success' : 'failed',
      agent: result.agent,
      output: result.output,
      durationMs: result.durationMs,
    });
    execState.totalDurationMs += result.durationMs;

    return buildResult(
      result.ok ? 'success' : 'failed',
      result.ok ? 'Execution completed' : `Step 1 failed: ${result.output.slice(0, 100)}`,
      strategy.name,
      finalAgent,
      finalTier,
      execState.totalDurationMs,
      { capability: step.capability, strategy: strategy.name, agentReason: route.reason, modelReason: `tier=${tier}` },
      execState.errors.length > 0 ? execState.errors : undefined,
    );
  }

  // Multi-step execution with Loop support
  let currentStepIdx = 0;
  let iteration = 1;
  let enteredFromLoop = false; // true when we jumped to fix_error from a failed run_tests

  while (currentStepIdx < strategy.steps.length) {
    // Check max iterations for loop
    if (iteration > strategy.maxIterations) {
      return buildResult(
        'failed',
        `Max iterations (${strategy.maxIterations}) reached`,
        strategy.name,
        finalAgent,
        finalTier,
        Date.now() - startTime,
        buildTrace(strategy, loopIterations, finalAgent, finalTier),
        execState.errors,
        iteration,
        validatedOutputs,
      );
    }

    const step = strategy.steps[currentStepIdx];
    execState.currentStep = step.step;
    execState.currentCapability = step.capability;

    // Route agent + tier via injected resolver (respects --agent/--tier)
    const route = resolver(step.capability, step.tierOverride);
    const agent = route.agent;
    const tier = route.tier;

    // Build context from previous steps
    const context = buildContext(execState.history);

    // Execute step
    const result = await executor(step.capability, agent, tier, prompt, context);

    finalAgent = result.agent;
    finalTier = tier;
    finalReason = route.reason;

    // ── Post-step validation (multi-step only) ──
    let validatedOutput: unknown;
    const validationResult = validateOutput(step.capability, result.output);

    if (validationResult.valid) {
      validatedOutput = validationResult.data;
    } else {
      // Attempt repair
      const repairResult = repairOutput(step.capability, result.output);
      if (repairResult.success) {
        const revalidation = validateOutput(step.capability, repairResult.output);
        if (revalidation.valid) {
          validatedOutput = revalidation.data;
        }
      }
      // If repair also failed, validatedOutput stays undefined — don't abort
    }

    const stepHistory: StepHistory = {
      step: step.step,
      capability: step.capability,
      status: result.ok ? 'success' : 'failed',
      agent: result.agent,
      output: result.output,
      durationMs: result.durationMs,
    };

    if (validatedOutput !== undefined) {
      stepHistory.validatedOutput = validatedOutput as StepHistory['validatedOutput'];
      validatedOutputs[`step-${step.step}`] = validatedOutput;
    }

    execState.history.push(stepHistory);
    execState.totalDurationMs += result.durationMs;

    if (result.ok) {
      // Step succeeded
      loopIterations.push({ iteration, step: step.capability, result: 'passed' });

      // If fix_error succeeded after a loop, go back to run_tests to verify
      if (strategy.loop && step.capability === 'fix_error' && enteredFromLoop) {
        const runTestsIdx = strategy.steps.findIndex(s => s.capability === 'run_tests');
        if (runTestsIdx >= 0) {
          iteration++;
          currentStepIdx = runTestsIdx;
          enteredFromLoop = true;
          continue;
        }
      }

      // Normal advance
      enteredFromLoop = false;
      currentStepIdx++;
    } else {
      // Step failed — classify and handle
      const classification = classifyError(result.output, result.exitCode, step.capability, iteration);
      const errorRecord = createErrorRecord(step.step, step.capability, iteration, classification, result.output);
      execState.errors.push(errorRecord);

      loopIterations.push({
        iteration,
        step: step.capability,
        result: 'failed',
        errorType: classification.errorType,
      });

      // Handle based on step.onFail
      switch (step.onFail) {
        case 'abort':
          return buildResult(
            'failed',
            `Step ${step.step} (${step.capability}) failed: ${classification.errorType}`,
            strategy.name,
            finalAgent,
            finalTier,
            Date.now() - startTime,
            buildTrace(strategy, loopIterations, finalAgent, finalTier),
            execState.errors,
            iteration,
            validatedOutputs,
          );

        case 'loop':
          // Loop: if run_tests failed, go to fix_error step
          if (step.capability === 'run_tests') {
            const fixIdx = strategy.steps.findIndex(s => s.capability === 'fix_error');
            if (fixIdx >= 0 && iteration < strategy.maxIterations) {
              iteration++;
              currentStepIdx = fixIdx;
              enteredFromLoop = true;
              continue;
            }
          }
          // No fix_error step or max iterations reached
          return buildResult(
            'failed',
            `Loop exhausted at step ${step.step}: ${classification.errorType}`,
            strategy.name,
            finalAgent,
            finalTier,
            Date.now() - startTime,
            buildTrace(strategy, loopIterations, finalAgent, finalTier),
            execState.errors,
            iteration,
            validatedOutputs,
          );

        case 'retry':
          if (iteration < strategy.maxIterations) {
            iteration++;
            // Stay on same step (fix_error retries itself)
            continue;
          }
          return buildResult(
            'failed',
            `Retry exhausted at step ${step.step}: ${classification.errorType}`,
            strategy.name,
            finalAgent,
            finalTier,
            Date.now() - startTime,
            buildTrace(strategy, loopIterations, finalAgent, finalTier),
            execState.errors,
            iteration,
            validatedOutputs,
          );
      }
    }
  }

  // All steps completed successfully
  return buildResult(
    'success',
    `Strategy "${strategy.name}" completed in ${iteration} iteration(s)`,
    strategy.name,
    finalAgent,
    finalTier,
    Date.now() - startTime,
    buildTrace(strategy, loopIterations, finalAgent, finalTier),
    undefined,
    iteration,
    validatedOutputs,
  );
}

// ─── Helpers ──────────────────────────────────────────────────

function buildContext(history: StepHistory[]): string {
  if (history.length === 0) return '';
  const last = history[history.length - 1];
  return `[前序步骤] ${last.capability} (${last.status}): ${(last.output ?? '').slice(0, 500)}`;
}

function buildTrace(
  strategy: StrategyDefinition,
  iterations: LoopIteration[],
  agent: AgentId,
  tier: Tier,
): DecisionTrace {
  return {
    capability: strategy.steps[0].capability,
    strategy: strategy.name,
    agentReason: `strategy=${strategy.name}`,
    modelReason: `tier=${tier}`,
    loopIterations: iterations.length > 0 ? iterations : undefined,
  };
}

function buildResult(
  status: 'success' | 'failed',
  summary: string,
  strategy: StrategyName,
  agent: AgentId,
  tier: Tier,
  durationMs: number,
  decisionTrace: DecisionTrace,
  errors?: ErrorRecord[],
  iterations?: number,
  validatedOutputs?: Record<string, unknown>,
): StrategyResult {
  return {
    status,
    summary,
    strategy,
    agent,
    tier,
    durationMs,
    decisionTrace,
    ...(errors && errors.length > 0 ? { errors } : {}),
    ...(iterations && iterations > 1 ? { iterations } : {}),
    ...(validatedOutputs && Object.keys(validatedOutputs).length > 0 ? { validatedOutputs } : {}),
  };
}
