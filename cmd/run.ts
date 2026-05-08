import { Command } from 'commander';

import { buildResult, suggestFallback } from '../src/core/aggregator/index.js';
import { resolveCapability } from '../src/core/capability/index.js';
import { ProcessManager, resolveAgentCommand, getAgent } from '../src/core/dispatcher/index.js';
import { parseIntent } from '../src/core/intent/index.js';
import { orchestrate, handoff, review } from '../src/core/orchestrator/index.js';
import { resolveTier } from '../src/core/router/tier-resolver.js';
import { routeWithFallback, rankAgents, routeByCapability } from '../src/core/router/index.js';
import { createLLMService } from '../src/core/llm/index.js';
import { GitGuard } from '../src/core/git/guard.js';
import { evaluateQuality } from '../src/core/aggregator/quality-checker.js';
import { summarizeContext } from '../src/core/orchestrator/summarizer.js';
import { reviewCode } from '../src/core/orchestrator/code-reviewer.js';
import { TechDetector } from '../src/core/context/tech-detector.js';
import { ProjectContextBuilder } from '../src/core/context/project-context.js';
import { selectModel, buildModelArgs } from '../src/core/router/model-selector.js';
import { ACPBridge } from '../src/core/dispatcher/acp-bridge.js';
import { StreamWriter } from '../src/core/dispatcher/stream-writer.js';
import { getStrategy, selectStrategy, isValidStrategy, executeStrategy, createExecutionState, type StepExecutor } from '../src/core/strategy/index.js';
import type { StrategyName, ExecutionState } from '../src/types/strategy.js';
import { InteractivePrompt } from '../src/core/ui/prompt.js';
import type { AgentId, OrchestrationMode, RunResult, TaskIntent } from '../src/types/agent.js';
import type { CapabilityId } from '../src/types/capability.js';
import type { Diagnostic } from '../src/types/index.js';
import { printJson, EXIT_CODES, createCommandContext, type CommandContext } from './_shared.js';
import { loadGatewayConfig, resolveGateway, getEffectiveModel } from '../src/core/gateway/index.js';
import type { GatewayConfig, Tier } from '../src/types/gateway.js';
import { loadConfig } from '../src/core/config/index.js';
import type { CliSwitchConfig, EffectiveConfig } from '../src/types/config.js';
import {
  parseExecutionMode,
  getExecutionModeConfig,
  type ExecutionMode,
} from '../src/core/sandbox/execution-mode.js';
import { collectPatches, applyPatch } from '../src/core/sandbox/patch-collector.js';
import { createTempCopy, computeCopyDiff } from '../src/core/sandbox/temp-copy.js';
import { validateDiffPaths, parseUnifiedDiff } from '../src/core/validation/diff-validator.js';

interface RunOptions {
  mode?: string;
  agent?: string;
  strategy?: string;
  execution?: string;
  tier?: string;
  json?: boolean;
  dryRun?: boolean;
  timeout?: string;
  reviewer?: string;
  noGit?: boolean;
  rollback?: boolean;
  stream?: boolean;
  interactive?: boolean;
  acp?: boolean;
  executionMode?: string;
  patchApply?: boolean;
  keepTemp?: boolean;
}

export function createRunCommand(): Command {
  return new Command('run')
    .description('Run an AI agent with smart routing')
    .argument('<input>', 'task description')
    .option('--mode <mode>', 'orchestration mode: single|orchestrator|handoff|review')
    .option('--agent <agent>', 'override agent: claude-code|codex')
    .option('--strategy <name>', 'cost profile: balanced|high_quality|low_cost (TODO: not yet implemented)')
    .option('--execution <mode>', 'execution mode: single|write_review|write_test_fix')
    .option('--tier <tier>', 'model tier: economy|standard|premium')
    .option('--json', 'output JSON')
    .option('--dry-run', 'show routing decision without executing')
    .option('--timeout <seconds>', 'agent timeout in seconds (default 120)')
    .option('--reviewer <agent>', 'reviewer agent for review mode')
    .option('--no-git', 'skip Git branch/checkpoint management')
    .option('--rollback', 'auto-rollback on failure')
    .option('--stream', 'stream agent output in real-time (default: true)')
    .option('--no-stream', 'disable streaming')
    .option('-i, --interactive', 'interactive agent selection')
    .option('--acp', 'use ACP protocol (JSON-RPC over stdio)')
    .option('--execution-mode <mode>', 'execution mode: default|patch-only|temp-copy|worktree')
    .option('--patch-apply', 'apply collected patches after patch-only execution')
    .option('--keep-temp', 'preserve temporary sandbox files for debugging')
    .action(async (input: string, options: RunOptions) => {
      const startTime = Date.now();

      try {
        // Create LLM service (optional, requires OPENROUTER_API_KEY)
        const llm = createLLMService();

        // Phase 1: Intent parsing
        const intent = await parseIntent(input, llm ? {
          baseUrl: 'https://openrouter.ai/api/v1',
          apiKey: process.env.OPENROUTER_API_KEY!,
          model: 'deepseek/deepseek-chat-v3-0324:free',
        } : undefined);

        // Capability resolution (intent → atomic operation)
        const capability = resolveCapability(intent);

        // Phase 2: Routing (capability-based → LLM → legacy rules)
        let decision;
        if (options.agent) {
          decision = {
            agent: options.agent as AgentId,
            reason: '手动指定',
            confidence: 1.0,
          };
        } else {
          decision = await routeWithFallback(intent, llm, capability);
        }

        // Auto-detect tech stack
        const techStack = TechDetector.detectFrom(process.cwd());

        // Interactive mode: let user choose (before gateway resolution)
        if (options.interactive) {
          const ranked = rankAgents(intent.type, intent.complexity);
          const chosen = await InteractivePrompt.selectAgent(ranked, decision.agent);
          decision = { agent: chosen, reason: 'User selected', confidence: 1.0 };
          const confirmed = await InteractivePrompt.confirmRouting(decision.agent, decision.reason, decision.confidence);
          if (!confirmed) {
            console.log('Cancelled.');
            return;
          }
        }

        // Model selection (after final agent decision)
        const modelSelection = selectModel(decision.agent, intent);

        // Gateway: load config and resolve tier→model (after final agent decision)
        const configResult = loadConfig(process.cwd());
        const effectiveConfig: CliSwitchConfig | null = configResult.config?.config ?? null;
        const configSources: EffectiveConfig['sources'] | null = configResult.config?.sources ?? null;

        const warnings: string[] = [];
        if (configResult.errors.length > 0) {
          for (const err of configResult.errors) {
            warnings.push(`Config: ${err.message}`);
          }
        }

        // Build gateway overrides from file config (env still wins via loadGatewayConfig)
        const gatewayOverrides: Partial<GatewayConfig> | undefined = effectiveConfig?.gateway
          ? {
              apiKey: effectiveConfig.gateway.api_key,
              baseUrl: effectiveConfig.gateway.base_url || undefined,
              models: effectiveConfig.gateway.models,
              defaultTier: effectiveConfig.gateway.default_tier,
              agentKeys: effectiveConfig.gateway.agent_keys as GatewayConfig['agentKeys'],
            }
          : undefined;

        const gateway = loadGatewayConfig(gatewayOverrides);
        const effectiveTier = resolveTier(capability, effectiveConfig?.routing, options.tier);
        const gatewayResult = gateway
          ? resolveGateway(gateway, decision.agent, effectiveTier)
          : null;

        // Override model if gateway resolved one
        const effectiveModel = getEffectiveModel(
          gateway,
          decision.agent,
          effectiveTier,
          modelSelection.model,
        );
        if (effectiveModel.source === 'gateway') {
          modelSelection.model = effectiveModel.model;
          modelSelection.reason = `gateway tier=${effectiveModel.tier}`;
        }

        const mode: OrchestrationMode = (options.mode as OrchestrationMode)
          ?? (options.interactive ? await InteractivePrompt.selectMode() : 'single');

        // Strategy resolution: --execution > config default > auto-select from capability
        const VALID_EXECUTIONS = ['single', 'write_review', 'write_test_fix', 'high_quality'] as const;
        let strategyName: StrategyName;
        if (options.execution) {
          if (!isValidStrategy(options.execution)) {
            const msg = `--execution must be one of: ${VALID_EXECUTIONS.join(', ')}. Got '${options.execution}'.`;
            if (options.json) {
              printJson({ ok: false, error: { code: 'INPUT_ERROR', message: msg }, warnings: [], diagnostics: [] });
            } else {
              console.error(`Error: ${msg}`);
            }
            process.exit(EXIT_CODES.input);
          }
          strategyName = options.execution as StrategyName;
        } else if (effectiveConfig?.execution?.default_strategy && isValidStrategy(effectiveConfig.execution.default_strategy)) {
          strategyName = effectiveConfig.execution.default_strategy;
        } else {
          strategyName = selectStrategy(capability);
        }
        const strategy = getStrategy(strategyName, capability);
        const VALID_TIERS = ['economy', 'standard', 'premium'] as const;
        if (options.tier && !VALID_TIERS.includes(options.tier as typeof VALID_TIERS[number])) {
          const msg = `--tier must be one of: ${VALID_TIERS.join(', ')}. Got '${options.tier}'.`;
          if (options.json) {
            printJson({ ok: false, error: { code: 'INPUT_ERROR', message: msg }, warnings: [], diagnostics: [] });
          } else {
            console.error(`Error: ${msg}`);
          }
          process.exit(EXIT_CODES.input);
        }
        if (options.strategy) {
          const msg = `--strategy ${options.strategy} is accepted but not yet implemented; use --execution and --tier for active behavior.`;
          warnings.push(msg);
          if (!options.json) {
            console.warn(`Warning: ${msg}`);
          }
        }

        // Execution mode (sandbox isolation): parse and validate
        let executionMode: ExecutionMode;
        try {
          executionMode = parseExecutionMode(options.executionMode);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (options.json) {
            printJson({ ok: false, error: { code: 'INPUT_ERROR', message: msg }, warnings: [], diagnostics: [] });
          } else {
            console.error(`Error: ${msg}`);
          }
          process.exit(EXIT_CODES.input);
        }

        // Placeholder warnings for modes not yet implemented
        if (executionMode === 'temp-copy') {
          // temp-copy is now implemented — no fallback
        } else if (executionMode === 'worktree') {
          console.warn('Warning: worktree execution mode is coming in plan 04-03. Falling back to default.');
          executionMode = 'default';
        }

        const executionModeConfig = getExecutionModeConfig(executionMode);

        // For patch-only mode: append prompt suffix to input
        let effectiveInput = input;
        if (executionMode === 'patch-only' && executionModeConfig.promptSuffix) {
          effectiveInput = input + executionModeConfig.promptSuffix;
        }

        // Gateway only supports single mode in PR1
        if (gatewayResult && mode !== 'single') {
          console.warn(`Warning: Gateway env injection only applies to --mode single in PR1. Mode '${mode}' will use native agent env.`);
        }

        // Gateway + --acp are mutually exclusive in PR1
        if (gatewayResult && options.acp) {
          const msg = 'Gateway injection is not supported with --acp in PR1. Remove --acp or unset SWITCH_API_KEY.';
          if (options.json) {
            printJson({ ok: false, error: { code: 'GATEWAY_ACP_CONFLICT', message: msg }, warnings: [], diagnostics: [] });
          } else {
            console.error(`Error: ${msg}`);
          }
          process.exit(EXIT_CODES.input);
        }

        // --dry-run: only show routing decision
        if (options.dryRun) {
          const ranked = rankAgents(intent.type, intent.complexity);
          const output = {
            intent,
            capability,
            tier: effectiveTier,
            decision,
            mode,
            ranked,
            strategy: {
              name: strategy.name,
              label: strategy.label,
              description: strategy.description,
              steps: strategy.steps.map(s => ({
                step: s.step,
                capability: s.capability,
                onFail: s.onFail,
                tierOverride: s.tierOverride,
              })),
              loop: strategy.loop,
              maxIterations: strategy.maxIterations,
            },
            gateway: gatewayResult?.available === true ? {
              available: true,
              tier: effectiveModel.tier,
              model: effectiveModel.model,
              modelSource: effectiveModel.source,
              baseUrl: gateway?.baseUrl,
            } : { available: false },
            config: configSources ? {
              global: { loaded: configSources.global.loaded, path: configSources.global.path },
              project: { loaded: configSources.project.loaded, path: configSources.project.path },
            } : undefined,
          };
          if (options.json) {
            printJson({ ok: true, data: output, warnings, diagnostics: [] });
          } else {
            console.log('── Routing Decision ──────────────────');
            console.log(`  Intent:      ${intent.type} (${intent.complexity})`);
            console.log(`  Capability:  ${capability}`);
            console.log(`  Strategy:    ${strategy.name} (${strategy.label})`);
            console.log(`  Steps:       ${strategy.steps.map(s => s.capability).join(' → ')}`);
            if (strategy.loop) {
              console.log(`  Loop:        enabled (max ${strategy.maxIterations} iterations)`);
            }
            console.log(`  Tier:        ${effectiveTier}`);
            console.log(`  Agent:       ${decision.agent}`);
            console.log(`  Reason:      ${decision.reason}`);
            console.log(`  Confidence:  ${(decision.confidence * 100).toFixed(0)}%`);
            console.log(`  Mode:        ${mode}`);
            if (intent.techStack.length > 0) {
              console.log(`  Tech Stack:  ${intent.techStack.join(', ')}`);
            }
            console.log(`  Model:       ${effectiveModel.model} (${effectiveModel.source}${effectiveModel.source === 'gateway' ? `, tier=${effectiveModel.tier}` : ''})`);
            if (techStack.languages.length > 0) {
              console.log(`  Detected:    ${[...techStack.languages, ...techStack.frameworks].join(', ')}`);
            }
            console.log('── Gateway ───────────────────────');
            if (gatewayResult?.available === true) {
              console.log(`  Status:      ✓ configured`);
              console.log(`  Base URL:    ${gateway?.baseUrl}`);
              console.log(`  Tier:        ${effectiveModel.tier}`);
              console.log(`  Model:       ${effectiveModel.model}`);
            } else if (gateway && !gatewayResult?.available) {
              console.log(`  Status:      ✗ configured but not available for '${decision.agent}' (${gatewayResult?.reason})`);
            } else {
              console.log('  Status:      ✗ not configured (set SWITCH_API_KEY)');
            }
            console.log('\n── Agent Ranking ──────────────────');
            for (const r of ranked) {
              const marker = r.agent === decision.agent ? ' ← selected' : '';
              console.log(`  ${r.agent.padEnd(14)} score=${r.score}  (${r.reason})${marker}`);
            }
            if (ranked.length > 0 && ranked[0].agent !== decision.agent) {
              console.log(`  ℹ ${decision.agent} selected by capability routing (${decision.reason}), overriding ranking`);
            }
          }
          return;
        }

        const commandContext = createCommandContext();
        const preflightFailure = preflightAgents(commandContext, getModeAgents(mode, decision.agent, options.reviewer));
        if (preflightFailure) {
          printPreflightFailure(preflightFailure, options, warnings);
          process.exitCode = preflightExitCode(preflightFailure.code);
          return;
        }

        // Resolve agent defaults
        const agentDef = getAgent(decision.agent);
        const timeoutMs = options.timeout
          ? parseInt(options.timeout, 10) * 1000
          : (agentDef?.timeoutMs ?? 120_000);
        const maxMemoryMb = agentDef?.maxMemoryMb ?? 512;

        const gitGuard = options.noGit ? undefined : new GitGuard();

        if (mode === 'single') {
          // Strategy-aware execution
          if (strategy.steps.length > 1 || strategy.loop) {
            // Multi-step strategy: use strategy engine
            const resolver = (cap: CapabilityId, stepTierOverride?: Tier) => {
              if (options.agent) return { agent: options.agent as AgentId, tier: stepTierOverride ?? effectiveTier, reason: 'CLI --agent override' };
              const route = routeByCapability(cap);
              return {
                agent: route?.agent ?? decision.agent,
                tier: stepTierOverride ?? effectiveTier,
                reason: route?.reason ?? decision.reason,
              };
            };

            const stepExec: import('../src/core/strategy/engine.js').StepExecutor = async (cap, agent, tier, prompt, context) => {
              const stepStart = Date.now();
              const stepPreflightFailure = preflightAgent(commandContext, agent);
              if (stepPreflightFailure) {
                return {
                  ok: false,
                  output: stepPreflightFailure.message,
                  exitCode: preflightExitCode(stepPreflightFailure.code),
                  durationMs: Date.now() - stepStart,
                  agent,
                };
              }

              const stepRuntime = resolveAgentRuntime(agent, tier, intent, gateway);

              // H1: per-capability prompt construction
              const stepPrompt = buildCapabilityPrompt(cap, prompt, context);

              const agentCmd = resolveAgentCommand(agent, stepPrompt, stepRuntime.model);
              const stepPm = new ProcessManager();
              const stepWriter = options.stream !== false ? StreamWriter.create() : null;
              if (stepWriter) stepWriter.startAgent(agent);

              const stepProc = await stepPm.spawnAgent(agent, agentCmd.args, {
                timeoutMs,
                maxMemoryMb,
                command: agentCmd.program,
                gitGuard,
                gatewayEnv: stepRuntime.gatewayEnv,
                sandbox: { homeIsolation: Boolean(stepRuntime.gatewayEnv) },
                onChunk: stepWriter ? (chunk) => stepWriter!.writeChunk(chunk) : undefined,
              });

              const ok = stepProc.status === 'completed';
              const output = stepProc.stdout || stepProc.stderr || '';
              if (stepWriter) stepWriter.complete(ok);

              return {
                ok,
                output,
                exitCode: stepProc.exitCode ?? (ok ? 0 : 1),
                durationMs: Date.now() - stepStart,
                agent,
              };
            };

            const strategyResult = await executeStrategy(strategy, input, stepExec, resolver);
            if (options.json) {
              printJson({ ok: strategyResult.status === 'success', data: strategyResult, warnings, diagnostics: [] });
            } else {
              console.log(`── Strategy: ${strategyResult.strategy} ────────────`);
              console.log(`  Status:      ${strategyResult.status}`);
              console.log(`  Summary:     ${strategyResult.summary}`);
              console.log(`  Agent:       ${strategyResult.agent}`);
              console.log(`  Tier:        ${strategyResult.tier}`);
              if (strategyResult.iterations) {
                console.log(`  Iterations:  ${strategyResult.iterations}`);
              }
              if (strategyResult.errors && strategyResult.errors.length > 0) {
                console.log(`  Errors:`);
                for (const e of strategyResult.errors) {
                  console.log(`    Step ${e.step} (${e.capability}): ${e.errorType} — ${e.repairAction}`);
                }
              }
              if (strategyResult.decisionTrace.loopIterations?.length) {
                console.log(`  Loop Trace:`);
                for (const it of strategyResult.decisionTrace.loopIterations) {
                  console.log(`    #${it.iteration} ${it.step}: ${it.result}${it.errorType ? ` (${it.errorType})` : ''}`);
                }
              }
            }
            process.exit(strategyResult.status === 'success' ? EXIT_CODES.success : EXIT_CODES.input);
          }

          // Single-step: existing fast path
          await runSingle(decision.agent, effectiveInput, { timeoutMs, maxMemoryMb, startTime, options, llm, gitGuard, gatewayEnv: gatewayResult?.available === true ? gatewayResult.env : undefined, effectiveModel: gatewayResult?.available === true ? effectiveModel.model : undefined, capability, gateway, effectiveTier, intent, warnings, executionMode });

          // Patch-only: collect patches from agent output after execution
          // (patches are collected inside runSingle's result; handled via printSingleResult)
          if (executionMode === 'patch-only' && options.patchApply) {
            warnings.push('Patch-only mode with --patch-apply: patches will be applied after agent execution.');
          }
        } else if (mode === 'orchestrator') {
          const agents = ([decision.agent, 'codex'] as AgentId[]).filter(
            (a, i, arr) => arr.indexOf(a) === i,
          );
          const results = await orchestrate(input, agents, { timeoutMs });
          printResults(results, options);
        } else if (mode === 'handoff') {
          const chain: AgentId[] = [decision.agent, options.reviewer as AgentId ?? 'codex'];
          // LLM context summarization for handoff
          let effectiveInput = input;
          if (llm) {
            try {
              effectiveInput = await summarizeContext(input, input, llm);
            } catch { /* non-critical */ }
          }
          const result = await handoff(effectiveInput, chain, { timeoutMs });
          printSingleResult(result, options);
        } else if (mode === 'review') {
          const reviewer = (options.reviewer ?? 'codex') as AgentId;
          const reviewResult = await review(input, decision.agent, reviewer, { timeoutMs });
          // LLM code review
          if (llm && reviewResult.code.ok) {
            try {
              const llmReview = await reviewCode(reviewResult.code.output, input, llm);
              if (options.json) {
                printJson({ ok: true, data: { ...reviewResult, llmReview }, warnings: [], diagnostics: [] });
              } else {
                console.log('── Code ──────────────────');
                console.log(reviewResult.code.output);
                console.log('── Review ─────────────────');
                console.log(reviewResult.review.output);
                console.log('── LLM Quality Review ─────');
                console.log(`Approved: ${llmReview.approved}`);
                console.log(`Summary: ${llmReview.summary}`);
                if (llmReview.issues.length > 0) console.log(`Issues: ${llmReview.issues.join('; ')}`);
              }
              return;
            } catch { /* non-critical, fall through */ }
          }
          if (options.json) {
            printJson({ ok: true, data: reviewResult, warnings: [], diagnostics: [] });
          } else {
            console.log('── Code ──────────────────');
            console.log(reviewResult.code.output);
            console.log('── Review ─────────────────');
            console.log(reviewResult.review.output);
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (options.json) {
          printJson({
            ok: false,
            error: { code: 'RUN_FAILED', message, hint: '检查 Agent 是否已安装并可用' },
            warnings: [],
            diagnostics: [],
          });
        } else {
          console.error(`Error: ${message}`);
        }
        process.exitCode = EXIT_CODES.input;
      }
    });
}

/**
 * Build a capability-specific prompt for strategy step execution.
 *
 * Each capability gets a different system prefix so the agent knows
 * what role it's playing in the current step.
 */
function buildCapabilityPrompt(
  cap: CapabilityId,
  originalPrompt: string,
  context: string,
): string {
  const CAPABILITY_PREFIXES: Record<CapabilityId, string> = {
    write_code: '[Step: write_code] You are writing code. Implement the following task. Output only the code changes needed.\n',
    review_code: '[Step: review_code] You are reviewing code. Analyze the changes for correctness, style, and potential issues. Provide a structured review.\n',
    refactor: '[Step: refactor] You are refactoring code. Improve structure without changing behavior. Preserve existing tests.\n',
    fix_error: '[Step: fix_error] You are fixing errors. Analyze the error output below and fix the issues. Do NOT rewrite unrelated code.\n',
    analyze: '[Step: analyze] You are analyzing code. Read the codebase and provide insights. Do NOT modify any files.\n',
    write_tests: '[Step: write_tests] You are writing tests. Create comprehensive test cases for the code. Use the project\'s existing test framework.\n',
    run_tests: '[Step: run_tests] Run the existing test suite and report results. If tests fail, output the failure details so the next step can fix them.\n',
    explain: '[Step: explain] Explain the code or concept clearly. Be concise and accurate.\n',
  };

  const prefix = CAPABILITY_PREFIXES[cap] ?? '';
  const ctx = context ? `\n\nPrevious step context:\n${context}` : '';
  return `${prefix}${originalPrompt}${ctx}`;
}

function getModeAgents(mode: OrchestrationMode, primary: AgentId, reviewer?: string): AgentId[] {
  const agents: AgentId[] = [primary];
  if (mode === 'orchestrator') {
    agents.push('codex');
  }
  if (mode === 'handoff' || mode === 'review') {
    agents.push((reviewer ?? 'codex') as AgentId);
  }
  return agents.filter((agent, index, all) => all.indexOf(agent) === index);
}

function preflightAgent(context: CommandContext, agent: AgentId): Diagnostic | null {
  const result = context.resolver.resolve({ tool: agent });
  if (result.ok) {
    return null;
  }

  return result.diagnostics[0] ?? {
    level: 'error',
    code: 'RESOLVE_FAILED',
    message: `Runtime preflight failed for ${agent}.`,
    details: { agent },
  };
}

function preflightAgents(context: CommandContext, agents: AgentId[]): Diagnostic | null {
  for (const agent of agents) {
    const failure = preflightAgent(context, agent);
    if (failure) {
      return failure;
    }
  }
  return null;
}

function preflightExitCode(code: string): number {
  if (code === 'BINARY_NOT_FOUND' || code === 'PLATFORM_UNSUPPORTED') {
    return EXIT_CODES.environment;
  }
  return EXIT_CODES.resolve;
}

function printPreflightFailure(diagnostic: Diagnostic, options: RunOptions, warnings: string[]): void {
  const message = diagnostic.message || 'Runtime preflight failed.';
  const hint = diagnostic.code === 'BINARY_NOT_FOUND'
    ? 'Install the target CLI or ensure PATH contains the executable before running the agent.'
    : diagnostic.code === 'PLATFORM_UNSUPPORTED'
      ? 'Use a supported platform or adjust the selected tool/profile.'
      : 'Run `cli-switch resolve --json` or `cli-switch doctor --json` for details.';

  if (options.json) {
    printJson({
      ok: false,
      error: {
        code: diagnostic.code,
        message,
        hint,
        ...(diagnostic.details ? { details: diagnostic.details } : {}),
      },
      warnings,
      diagnostics: [diagnostic],
    });
  } else {
    console.error(`Error: ${message}`);
    console.error(`code: ${diagnostic.code}`);
    console.error(`hint: ${hint}`);
  }
}

function resolveAgentRuntime(
  agent: AgentId,
  tier: Tier,
  intent: TaskIntent,
  gateway?: GatewayConfig | null,
): { model: string; gatewayEnv?: Record<string, string> } {
  const selected = selectModel(agent, intent);
  const effective = getEffectiveModel(gateway ?? null, agent, tier, selected.model);
  const gatewayResult = gateway ? resolveGateway(gateway, agent, tier) : null;

  return {
    model: effective.model,
    gatewayEnv: gatewayResult?.available === true ? gatewayResult.env : undefined,
  };
}

async function runSingle(
  agentId: AgentId,
  input: string,
  ctx: { timeoutMs: number; maxMemoryMb: number; startTime: number; options: RunOptions; llm?: InstanceType<typeof import('../src/core/llm/service.js').LLMService> | null; gitGuard?: GitGuard; gatewayEnv?: Record<string, string>; effectiveModel?: string; capability?: import('../src/types/capability.js').CapabilityId; gateway?: GatewayConfig | null; effectiveTier?: Tier; intent?: TaskIntent; warnings?: string[]; executionMode?: ExecutionMode },
): Promise<void> {
  const isPatchOnly = ctx.executionMode === 'patch-only';
  const isTempCopy = ctx.executionMode === 'temp-copy';
  const { program, args } = resolveAgentCommand(agentId, input, ctx.effectiveModel);
  const pm = new ProcessManager();

  // Temp-copy: create isolated project copy before execution
  let tempCopyCtx: Awaited<ReturnType<typeof createTempCopy>> | null = null;
  if (isTempCopy) {
    tempCopyCtx = await createTempCopy(process.cwd(), {
      keepTemp: Boolean(ctx.options.keepTemp),
    });
  }

  // ACP mode: use ACPBridge instead of direct spawn
  if (ctx.options.acp) {
    const bridge = new ACPBridge();
    const writer = ctx.options.stream !== false ? StreamWriter.create() : null;
    if (writer) {
      writer.startAgent(agentId);
      bridge.onChunk((chunk) => writer!.writeChunk(chunk));
    }
    await bridge.connect(program, args, {
      cwd: tempCopyCtx?.copyDir ?? process.cwd(),
      timeoutMs: ctx.timeoutMs,
    });
    const result = await bridge.sendTask(input);
    if (writer) writer.complete(true);
    await bridge.close();

    // Temp-copy: compute diff after ACP execution
    if (isTempCopy && tempCopyCtx) {
      await handleTempCopyPostExec(tempCopyCtx, ctx);
    }

    const runResult: RunResult = {
      agent: agentId,
      capability: ctx.capability,
      ok: true,
      output: JSON.stringify(result.result ?? ''),
      exitCode: 0,
      durationMs: Date.now() - ctx.startTime,
    };
    printSingleResult(runResult, ctx.options, ctx.warnings);
    return;
  }

  // Stream mode: set up StreamWriter
  const writer = ctx.options.stream !== false ? StreamWriter.create() : null;
  if (writer) writer.startAgent(agentId);

  const proc = await pm.spawnAgent(agentId, args, {
    timeoutMs: ctx.timeoutMs,
    maxMemoryMb: ctx.maxMemoryMb,
    command: program,
    cwd: tempCopyCtx?.copyDir,
    gitGuard: ctx.gitGuard,
    gatewayEnv: ctx.gatewayEnv,
    sandbox: { homeIsolation: Boolean(ctx.gatewayEnv) },
    onChunk: writer ? (chunk) => writer!.writeChunk(chunk) : undefined,
  });

  let result: RunResult = { ...buildResult(proc, ctx.startTime), capability: ctx.capability };

  if (writer) writer.complete(result.ok);

  // Rollback on failure if requested
  if (!result.ok && ctx.options.rollback && ctx.gitGuard && proc.checkpoint) {
    ctx.gitGuard.restore(proc.checkpoint);
    result.output += '\n[git] Rolled back to checkpoint';
  }

  // Fallback: if failed, try up to 2 fallback agents
  if (!result.ok) {
    let currentAgent = agentId;
    let attempts = 0;
    while (!result.ok && attempts < 2) {
      const fb = suggestFallback(currentAgent, result.output);
      if (!fb) break;

      const fbRuntime = ctx.intent && ctx.effectiveTier
        ? resolveAgentRuntime(fb, ctx.effectiveTier, ctx.intent, ctx.gateway)
        : { model: ctx.effectiveModel, gatewayEnv: undefined };

      const fbCmd = resolveAgentCommand(fb, input, fbRuntime.model);
      const fbProc = await pm.spawnAgent(fb, fbCmd.args, {
        timeoutMs: ctx.timeoutMs,
        maxMemoryMb: ctx.maxMemoryMb,
        command: fbCmd.program,
        gatewayEnv: fbRuntime.gatewayEnv,
        sandbox: { homeIsolation: Boolean(fbRuntime.gatewayEnv) },
      });
      result = { ...buildResult(fbProc, ctx.startTime), capability: ctx.capability, fallback: true };
      currentAgent = fb;
      attempts++;
    }
  }

  // LLM quality evaluation
  if (result.ok && ctx.llm) {
    try {
      const quality = await evaluateQuality(result.output, input, ctx.llm);
      if (ctx.options.json) {
        result = { ...result, output: JSON.stringify({ output: result.output, quality }) };
      } else {
        console.log(result.output);
        console.log(`\n── Quality: ${quality.score}/10 (${quality.pass ? 'PASS' : 'NEEDS IMPROVEMENT'}) ──`);
        if (quality.issues.length > 0) console.log(`Issues: ${quality.issues.join('; ')}`);
        if (quality.suggestions.length > 0) console.log(`Suggestions: ${quality.suggestions.join('; ')}`);
        return;
      }
    } catch { /* non-critical */ }
  }

  // Patch-only: collect and display patches from agent output
  if (isPatchOnly) {
    const patchResult = collectPatches(result.output);

    if (ctx.options.json) {
      // Include patch results in JSON output
      result = { ...result, output: JSON.stringify({
        output: result.output,
        executionMode: 'patch-only',
        patchResult: {
          filesChanged: patchResult.diffs.map(d => d.path),
          violations: patchResult.violations,
          clean: patchResult.clean,
          patchCount: patchResult.diffs.length,
        },
      })};
    } else {
      // Text output: show patch summary
      console.log('\n── Patch-Only Mode ─────────────────');
      console.log(`  Files changed: ${patchResult.diffs.length}`);
      if (patchResult.diffs.length > 0) {
        for (const diff of patchResult.diffs) {
          console.log(`    • ${diff.path} (${diff.hunks.length} hunk${diff.hunks.length !== 1 ? 's' : ''})`);
        }
      }
      if (patchResult.violations.length > 0) {
        console.log(`  ⚠ Protected path violations:`);
        for (const v of patchResult.violations) {
          console.log(`    • ${v}`);
        }
      }
      if (patchResult.clean) {
        console.log('  ✓ No protected path violations');
      }
      if (patchResult.diffs.length === 0) {
        console.log('  No diffs found in agent output.');
      }

      // Apply patches if --patch-apply is set
      if (ctx.options.patchApply && patchResult.rawDiffs) {
        console.log('\n── Applying Patches ─────────────────');
        const applyResult = applyPatch(patchResult.rawDiffs, process.cwd());
        if (applyResult.applied) {
          console.log('  ✓ Patches applied successfully');
        } else if (applyResult.success && !applyResult.applied) {
          console.log('  ✓ Patches validated (dry-run mode)');
        } else {
          console.log(`  ✗ Patch apply failed: ${applyResult.error}`);
        }
      }

      console.log('');
      // Still show agent output for context
      console.log(result.output);
      return;
    }
  }

  // Temp-copy: compute diff and optionally apply after execution
  if (isTempCopy && tempCopyCtx) {
    const tempCopyInfo = await handleTempCopyPostExec(tempCopyCtx, ctx);
    // Augment output with temp-copy info
    if (ctx.options.json) {
      result = {
        ...result,
        output: JSON.stringify({
          output: typeof result.output === 'string' && result.output.startsWith('{')
            ? JSON.parse(result.output) : result.output,
          executionMode: 'temp-copy',
          tempCopy: tempCopyInfo,
        }),
      };
    } else {
      console.log('\n── Temp-Copy Mode ─────────────────');
      console.log(`  Copy dir:    ${tempCopyInfo.copyDir}`);
      console.log(`  Files changed: ${tempCopyInfo.diffFiles}`);
      if (tempCopyInfo.violations.length > 0) {
        console.log(`  ⚠ Protected path violations:`);
        for (const v of tempCopyInfo.violations) {
          console.log(`    • ${v}`);
        }
      }
      if (tempCopyInfo.clean) {
        console.log('  ✓ No protected path violations');
      }
      if (tempCopyInfo.applied) {
        console.log('  ✓ Diff applied to original directory');
      }
      console.log('');
    }
  }

  printSingleResult(result, ctx.options, ctx.warnings);
}

/**
 * Handle post-execution logic for temp-copy mode.
 * Computes diff, validates paths, optionally applies to original, and cleans up.
 */
async function handleTempCopyPostExec(
  tempCopyCtx: Awaited<ReturnType<typeof createTempCopy>>,
  ctx: { options: RunOptions; warnings?: string[] },
): Promise<{ copyDir: string; diffFiles: number; violations: string[]; clean: boolean; applied: boolean }> {
  const { srcDir, copyDir, cleanup } = tempCopyCtx;

  // Compute diff between original and modified copy
  const diffText = await computeCopyDiff(srcDir, copyDir);

  // Parse and validate diff paths
  const parseResult = parseUnifiedDiff(diffText);
  const { violations, clean } = validateDiffPaths(parseResult.files);

  // Apply diff to original if --patch-apply is set and diff exists
  let applied = false;
  if (ctx.options.patchApply && diffText.trim()) {
    const applyResult = applyPatch(diffText, srcDir);
    applied = applyResult.applied;
    if (!applied && applyResult.error) {
      (ctx.warnings ?? []).push(`Temp-copy patch apply failed: ${applyResult.error}`);
    }
  }

  // Cleanup temp copy
  await cleanup();

  return {
    copyDir,
    diffFiles: parseResult.files.length,
    violations,
    clean,
    applied,
  };
}

function printSingleResult(result: RunResult, options: RunOptions, warnings: string[] = []): void {
  if (options.json) {
    printJson({
      ok: result.ok,
      data: result,
      warnings: result.ok ? warnings : [...warnings, `Agent ${result.agent} exited with code ${result.exitCode}`],
      diagnostics: [],
    });
  } else if (result.ok) {
    console.log(result.output);
  } else {
    console.error(`✗ Agent ${result.agent} failed (exit ${result.exitCode})`);
    if (result.output) console.error(result.output);
    process.exitCode = EXIT_CODES.resolve;
  }
}

function printResults(results: RunResult[], options: RunOptions): void {
  if (options.json) {
    printJson({ ok: results.every((r) => r.ok), data: results, warnings: [], diagnostics: [] });
  } else {
    for (const r of results) {
      console.log(`── ${r.agent} (${r.ok ? 'ok' : 'failed'}) ──`);
      console.log(r.output);
    }
  }
}
