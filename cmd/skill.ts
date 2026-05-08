/**
 * Skill command — list, show, and run skill definitions.
 *
 * Skills are reusable YAML templates that map to capability/strategy/tier
 * for pre-configured AI agent workflows.
 */

import { Command } from 'commander';

import { loadSkill, listSkills } from '../src/core/skill/loader.js';
import { renderPrompt } from '../src/core/skill/renderer.js';
import type { SkillDefinition } from '../src/core/skill/schema.js';
import { selectStrategy, isValidStrategy, getStrategy, executeStrategy } from '../src/core/strategy/index.js';
import { resolveTier } from '../src/core/router/tier-resolver.js';
import { routeByCapability } from '../src/core/router/index.js';
import { selectModel } from '../src/core/router/model-selector.js';
import { ProcessManager, resolveAgentCommand, getAgent } from '../src/core/dispatcher/index.js';
import { loadConfig } from '../src/core/config/index.js';
import { loadGatewayConfig, resolveGateway, getEffectiveModel } from '../src/core/gateway/index.js';
import { GitGuard } from '../src/core/git/guard.js';
import { parseExecutionMode } from '../src/core/sandbox/execution-mode.js';
import { StreamWriter } from '../src/core/dispatcher/stream-writer.js';
import type { CliSwitchConfig } from '../src/types/config.js';
import type { CapabilityId, StrategyName, Tier } from '../src/types/index.js';
import type { AgentId, TaskIntent } from '../src/types/agent.js';
import type { GatewayConfig } from '../src/types/gateway.js';
import type { ExecutionMode } from '../src/core/sandbox/execution-mode.js';
import {
  EXIT_CODES,
  createError,
  printJson,
  printTextError,
  toErrorEnvelope,
  renderJson,
  createCommandContext,
} from './_shared.js';

// ─── Options types ──────────────────────────────────────────

interface SkillListOptions {
  json?: boolean;
}

interface SkillShowOptions {
  json?: boolean;
}

interface SkillRunOptions {
  strategy?: string;
  tier?: string;
  executionMode?: string;
  dryRun?: boolean;
  json?: boolean;
  agent?: string;
  noGit?: boolean;
  timeout?: string;
  stream?: boolean;
  acp?: boolean;
}

// ─── Preflight helpers (inlined from run.ts) ────────────────

function preflightAgent(context: ReturnType<typeof createCommandContext>, agent: AgentId) {
  const result = context.resolver.resolve({ tool: agent });
  if (result.ok) return null;
  return result.diagnostics[0] ?? {
    level: 'error' as const,
    code: 'RESOLVE_FAILED',
    message: `Runtime preflight failed for ${agent}.`,
    details: { agent },
  };
}

function preflightAgents(context: ReturnType<typeof createCommandContext>, agents: AgentId[]) {
  for (const agent of agents) {
    const failure = preflightAgent(context, agent);
    if (failure) return failure;
  }
  return null;
}

function preflightExitCode(code: string): number {
  if (code === 'BINARY_NOT_FOUND' || code === 'PLATFORM_UNSUPPORTED') {
    return EXIT_CODES.environment;
  }
  return EXIT_CODES.resolve;
}

function printPreflightFailure(diagnostic: any, options: { json?: boolean }, warnings: string[]): void {
  const message = diagnostic.message || 'Runtime preflight failed.';
  if (options.json) {
    printJson({
      ok: false,
      error: { code: diagnostic.code, message, details: diagnostic.details },
      warnings,
      diagnostics: [diagnostic],
    });
  } else {
    console.error(`Error: ${message}`);
    console.error(`code: ${diagnostic.code}`);
  }
}

// ─── Skill intent (minimal TaskIntent for model selection) ──

function makeSkillIntent(prompt: string): TaskIntent {
  return {
    type: 'code_change',
    complexity: 'moderate',
    needsLongContext: false,
    techStack: [],
    rawInput: prompt,
  };
}

// ─── Command factory ───────────────────────────────────────

export function createSkillCommand(): Command {
  return new Command('skill')
    .description('Manage and run skill definitions')
    .addCommand(createListCommand())
    .addCommand(createShowCommand())
    .addCommand(createRunCommand());
}

// ─── list ──────────────────────────────────────────────────

function createListCommand(): Command {
  return new Command('list')
    .description('List available skills')
    .option('--json', 'output as JSON')
    .action(async (options: SkillListOptions) => {
      try {
        const skills = await listSkills(process.cwd());

        if (skills.length === 0) {
          if (options.json) {
            printJson({ ok: true, data: [], warnings: [], diagnostics: [] });
          } else {
            console.log('No skills found.');
          }
          return;
        }

        if (options.json) {
          printJson({ ok: true, data: skills, warnings: [], diagnostics: [] });
          return;
        }

        // Table output
        const nameCol = Math.max(4, ...skills.map(s => s.name.length));
        const sourceCol = Math.max(6, ...skills.map(s => s.source.length));

        console.log(
          'Name'.padEnd(nameCol) + '  ' +
          'Source'.padEnd(sourceCol) + '  ' +
          'Description',
        );
        console.log('-'.repeat(nameCol + sourceCol + 4 + 11));

        for (const skill of skills) {
          console.log(
            skill.name.padEnd(nameCol) + '  ' +
            skill.source.padEnd(sourceCol) + '  ' +
            skill.description,
          );
        }
      } catch (error) {
        if (options.json) {
          console.log(renderJson(toErrorEnvelope(error)));
        } else {
          printTextError(error);
        }
        process.exitCode = EXIT_CODES.input;
      }
    });
}

// ─── show ──────────────────────────────────────────────────

function createShowCommand(): Command {
  return new Command('show')
    .description('Show skill definition details')
    .argument('<name>', 'skill name')
    .option('--json', 'output as JSON')
    .action(async (name: string, options: SkillShowOptions) => {
      try {
        const result = await loadSkill(name, process.cwd());

        if (!result.skill) {
          const errorMsg = result.errors.map(e => e.message).join('; ');
          if (options.json) {
            console.log(renderJson(toErrorEnvelope(
              createError(result.errors[0]?.code ?? 'SKILL_ERROR', errorMsg),
            )));
          } else {
            printTextError(createError(result.errors[0]?.code ?? 'SKILL_ERROR', errorMsg));
          }
          process.exitCode = EXIT_CODES.input;
          return;
        }

        if (options.json) {
          printJson({ ok: true, data: result.skill, warnings: [], diagnostics: [] });
          return;
        }

        // Formatted key-value output
        const skill = result.skill;
        const keyCol = 20;
        const entries: [string, string][] = [
          ['name', skill.name],
          ['description', skill.description],
          ['capability', skill.capability],
          ['strategy', skill.strategy ?? '(auto)'],
          ['tier', skill.tier ?? '(auto)'],
          ['execution_mode', skill.execution_mode ?? '(default)'],
          ['source', result.source ?? 'unknown'],
        ];
        if (skill.prompt_template) {
          entries.push(['prompt_template', skill.prompt_template]);
        }
        if (skill.env && Object.keys(skill.env).length > 0) {
          entries.push(['env', JSON.stringify(skill.env)]);
        }

        for (const [key, value] of entries) {
          console.log(`${key.padEnd(keyCol)} ${value}`);
        }
      } catch (error) {
        if (options.json) {
          console.log(renderJson(toErrorEnvelope(error)));
        } else {
          printTextError(error);
        }
        process.exitCode = EXIT_CODES.input;
      }
    });
}

// ─── run ───────────────────────────────────────────────────

function createRunCommand(): Command {
  return new Command('run')
    .description('Run a skill with resolved parameters')
    .argument('<name>', 'skill name')
    .argument('[input...]', 'input text for the skill prompt template')
    .option('--strategy <name>', 'override strategy')
    .option('--tier <tier>', 'override tier')
    .option('--execution-mode <mode>', 'execution mode: default|patch-only|temp-copy|worktree')
    .option('--dry-run', 'show resolved parameters without executing')
    .option('--json', 'output JSON')
    .option('--agent <agent>', 'override agent')
    .option('--no-git', 'skip Git branch/checkpoint management')
    .option('--timeout <seconds>', 'agent timeout in seconds')
    .option('--stream', 'stream agent output (default: true)')
    .option('--no-stream', 'disable streaming')
    .option('--acp', 'use ACP protocol')
    .action(async (name: string, inputParts: string[], options: SkillRunOptions) => {
      const startTime = Date.now();
      const input = inputParts.join(' ');

      try {
        // 1. Load skill
        const loadResult = await loadSkill(name, process.cwd());
        if (!loadResult.skill) {
          const errorMsg = loadResult.errors.map(e => e.message).join('; ');
          if (options.json) {
            console.log(renderJson(toErrorEnvelope(
              createError(loadResult.errors[0]?.code ?? 'SKILL_ERROR', errorMsg),
            )));
          } else {
            printTextError(createError(loadResult.errors[0]?.code ?? 'SKILL_ERROR', errorMsg));
          }
          process.exitCode = EXIT_CODES.input;
          return;
        }

        const skill = loadResult.skill;

        // 2. Load config
        const configResult = loadConfig(process.cwd());
        const effectiveConfig: CliSwitchConfig | null = configResult.config?.config ?? null;
        const warnings: string[] = [];
        if (configResult.errors.length > 0) {
          for (const err of configResult.errors) {
            warnings.push(`Config: ${err.message}`);
          }
        }

        // 3. Resolve capability (from skill, required)
        const capability = skill.capability as CapabilityId;

        // 4. Resolve strategy: CLI > skill > config.skills > auto-select
        let strategyName: StrategyName;
        if (options.strategy) {
          if (!isValidStrategy(options.strategy)) {
            const msg = `--strategy must be one of: single, write_review, write_test_fix, high_quality`;
            if (options.json) {
              printJson({ ok: false, error: { code: 'INPUT_ERROR', message: msg }, warnings: [], diagnostics: [] });
            } else {
              console.error(`Error: ${msg}`);
            }
            process.exitCode = EXIT_CODES.input;
            return;
          }
          strategyName = options.strategy as StrategyName;
        } else if (skill.strategy) {
          strategyName = skill.strategy;
        } else if (effectiveConfig?.skills?.default_strategy) {
          if (isValidStrategy(effectiveConfig.skills.default_strategy)) {
            strategyName = effectiveConfig.skills.default_strategy;
          } else {
            strategyName = selectStrategy(capability);
          }
        } else {
          strategyName = selectStrategy(capability);
        }

        // 5. Resolve tier: CLI > skill > config.skills > resolveTier
        let effectiveTier: Tier;
        if (options.tier && ['economy', 'standard', 'premium'].includes(options.tier)) {
          effectiveTier = options.tier as Tier;
        } else if (skill.tier) {
          effectiveTier = skill.tier;
        } else if (effectiveConfig?.skills?.default_tier) {
          effectiveTier = effectiveConfig.skills.default_tier;
        } else {
          effectiveTier = resolveTier(capability, effectiveConfig?.routing);
        }

        // 6. Execution mode
        let executionMode: ExecutionMode = 'default';
        if (options.executionMode) {
          try {
            executionMode = parseExecutionMode(options.executionMode);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            if (options.json) {
              printJson({ ok: false, error: { code: 'INPUT_ERROR', message: msg }, warnings: [], diagnostics: [] });
            } else {
              console.error(`Error: ${msg}`);
            }
            process.exitCode = EXIT_CODES.input;
            return;
          }
        } else if (skill.execution_mode) {
          executionMode = skill.execution_mode;
        }

        // 7. Render prompt
        let renderedPrompt = renderPrompt(skill, input);

        // Append prompt_suffix from config if present
        if (effectiveConfig?.skills?.prompt_suffix) {
          renderedPrompt += effectiveConfig.skills.prompt_suffix;
        }

        // 8. Route agent based on capability
        let agentId: AgentId;
        if (options.agent) {
          agentId = options.agent as AgentId;
        } else {
          const routeResult = routeByCapability(capability);
          agentId = routeResult?.agent ?? 'claude-code';
        }

        // 9. Gateway resolution
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
        const gatewayResult = gateway ? resolveGateway(gateway, agentId, effectiveTier) : null;

        const strategy = getStrategy(strategyName, capability);
        const intent = makeSkillIntent(renderedPrompt);

        // 10. --dry-run: show resolved parameters
        if (options.dryRun) {
          const effectiveModel = getEffectiveModel(
            gateway ?? null,
            agentId,
            effectiveTier,
            selectModel(agentId, intent).model,
          );

          const output = {
            skill: skill.name,
            capability,
            strategy: strategyName,
            tier: effectiveTier,
            agent: agentId,
            execution_mode: executionMode,
            prompt: renderedPrompt,
            gateway: gatewayResult?.available === true ? {
              available: true,
              tier: effectiveTier,
              model: effectiveModel.model,
            } : { available: false },
          };

          if (options.json) {
            printJson({ ok: true, data: output, warnings, diagnostics: [] });
          } else {
            console.log('── Skill Run Parameters ─────────────────');
            console.log(`  Skill:       ${skill.name}`);
            console.log(`  Capability:  ${capability}`);
            console.log(`  Strategy:    ${strategyName} (${strategy.label})`);
            console.log(`  Steps:       ${strategy.steps.map(s => s.capability).join(' → ')}`);
            if (strategy.loop) {
              console.log(`  Loop:        enabled (max ${strategy.maxIterations} iterations)`);
            }
            console.log(`  Tier:        ${effectiveTier}`);
            console.log(`  Agent:       ${agentId}`);
            console.log(`  Exec Mode:   ${executionMode}`);
            console.log(`  Prompt:      ${renderedPrompt}`);
            console.log('── Gateway ───────────────────────');
            if (gatewayResult?.available === true) {
              console.log('  Status:      ✓ configured');
            } else {
              console.log('  Status:      ✗ not configured');
            }
          }
          return;
        }

        // 11. Execute: use strategy engine for multi-step, single-step otherwise
        const commandContext = createCommandContext();
        const preflightFailure = preflightAgents(commandContext, [agentId]);
        if (preflightFailure) {
          printPreflightFailure(preflightFailure, { json: options.json }, warnings);
          process.exitCode = preflightExitCode(preflightFailure.code);
          return;
        }

        const agentDef = getAgent(agentId);
        const timeoutMs = options.timeout
          ? parseInt(options.timeout, 10) * 1000
          : (agentDef?.timeoutMs ?? 120_000);
        const maxMemoryMb = agentDef?.maxMemoryMb ?? 512;
        const gitGuard = options.noGit ? undefined : new GitGuard();

        if (strategy.steps.length > 1 || strategy.loop) {
          // Multi-step strategy execution
          const resolver = (cap: CapabilityId, stepTierOverride?: Tier) => {
            if (options.agent) return { agent: options.agent as AgentId, tier: stepTierOverride ?? effectiveTier, reason: 'CLI --agent override' };
            const route = routeByCapability(cap);
            return {
              agent: route?.agent ?? agentId,
              tier: stepTierOverride ?? effectiveTier,
              reason: route?.reason ?? 'capability routing',
            };
          };

          const stepExec: import('../src/core/strategy/engine.js').StepExecutor = async (cap, agent, tier, prompt, context) => {
            const stepStart = Date.now();
            const stepPm = new ProcessManager();
            const stepModel = getEffectiveModel(gateway ?? null, agent, tier, selectModel(agent, intent).model).model;
            const agentCmd = resolveAgentCommand(agent, prompt, stepModel);
            const stepGw = gateway ? resolveGateway(gateway, agent, tier) : null;
            const stepWriter = options.stream !== false ? StreamWriter.create() : null;
            if (stepWriter) stepWriter.startAgent(agent);

            const stepProc = await stepPm.spawnAgent(agent, agentCmd.args, {
              timeoutMs,
              maxMemoryMb,
              command: agentCmd.program,
              gitGuard,
              gatewayEnv: stepGw?.available === true ? stepGw.env : undefined,
              sandbox: { homeIsolation: Boolean(stepGw?.available) },
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

          const strategyResult = await executeStrategy(strategy, renderedPrompt, stepExec, resolver);
          if (options.json) {
            printJson({ ok: strategyResult.status === 'success', data: strategyResult, warnings, diagnostics: [] });
          } else {
            console.log(`── Strategy: ${strategyResult.strategy} ────────────`);
            console.log(`  Status:      ${strategyResult.status}`);
            console.log(`  Summary:     ${strategyResult.summary}`);
            console.log(`  Agent:       ${strategyResult.agent}`);
            console.log(`  Tier:        ${strategyResult.tier}`);
          }
          process.exit(strategyResult.status === 'success' ? EXIT_CODES.success : EXIT_CODES.input);
        }

        // Single-step execution
        const effectiveModelResult = getEffectiveModel(gateway ?? null, agentId, effectiveTier, selectModel(agentId, intent).model);
        const { program: agentProgram, args: agentArgs } = resolveAgentCommand(agentId, renderedPrompt, effectiveModelResult.model);
        const pm = new ProcessManager();

        const writer = options.stream !== false ? StreamWriter.create() : null;
        if (writer) writer.startAgent(agentId);

        const proc = await pm.spawnAgent(agentId, agentArgs, {
          timeoutMs,
          maxMemoryMb,
          command: agentProgram,
          gitGuard,
          gatewayEnv: gatewayResult?.available === true ? gatewayResult.env : undefined,
          sandbox: { homeIsolation: Boolean(gatewayResult?.available) },
          onChunk: writer ? (chunk) => writer!.writeChunk(chunk) : undefined,
        });

        const ok = proc.status === 'completed';
        const output = proc.stdout || proc.stderr || '';
        if (writer) writer.complete(ok);

        const durationMs = Date.now() - startTime;

        if (options.json) {
          printJson({
            ok,
            data: {
              skill: skill.name,
              agent: agentId,
              capability,
              strategy: strategyName,
              tier: effectiveTier,
              exitCode: proc.exitCode ?? (ok ? 0 : 1),
              durationMs,
              output,
            },
            warnings: ok ? warnings : [...warnings, `Agent ${agentId} exited with code ${proc.exitCode}`],
            diagnostics: [],
          });
        } else if (ok) {
          console.log(output);
        } else {
          console.error(`✗ Agent ${agentId} failed (exit ${proc.exitCode})`);
          if (output) console.error(output);
          process.exitCode = EXIT_CODES.resolve;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (options.json) {
          printJson({
            ok: false,
            error: { code: 'RUN_FAILED', message, hint: 'Check agent availability and configuration' },
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
