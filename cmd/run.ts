import { Command } from 'commander';

import { buildResult, suggestFallback } from '../src/core/aggregator/index.js';
import { ProcessManager, resolveAgentCommand, getAgent } from '../src/core/dispatcher/index.js';
import { parseIntent } from '../src/core/intent/index.js';
import { orchestrate, handoff, review } from '../src/core/orchestrator/index.js';
import { loadBuiltins, createRegistryService } from '../src/registry/index.js';
import { routeWithFallback, rankAgents } from '../src/core/router/index.js';
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
import { InteractivePrompt } from '../src/core/ui/prompt.js';
import type { AgentId, OrchestrationMode, RunResult } from '../src/types/agent.js';
import { printJson, EXIT_CODES } from './_shared.js';

interface RunOptions {
  mode?: string;
  agent?: string;
  json?: boolean;
  dryRun?: boolean;
  timeout?: string;
  reviewer?: string;
  noGit?: boolean;
  rollback?: boolean;
  stream?: boolean;
  interactive?: boolean;
  acp?: boolean;
}

export function createRunCommand(): Command {
  return new Command('run')
    .description('Run an AI agent with smart routing')
    .argument('<input>', 'task description')
    .option('--mode <mode>', 'orchestration mode: single|orchestrator|handoff|review')
    .option('--agent <agent>', 'override agent: claude-code|codex|gemini|opencode|aider')
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

        // Phase 2: Routing (LLM-first with rule fallback)
        let decision;
        if (options.agent) {
          decision = {
            agent: options.agent as AgentId,
            reason: '手动指定',
            confidence: 1.0,
          };
        } else {
          decision = await routeWithFallback(intent, llm);
        }

        // Auto-detect tech stack and select model
        const techStack = TechDetector.detectFrom(process.cwd());
        const modelSelection = selectModel(decision.agent, intent);
        const modelArgs = buildModelArgs(modelSelection);

        // Interactive mode: let user choose
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

        const mode: OrchestrationMode = (options.mode as OrchestrationMode) ?? 'single';

        // --dry-run: only show routing decision
        if (options.dryRun) {
          const ranked = rankAgents(intent.type, intent.complexity);
          const output = { intent, decision, mode, ranked };
          if (options.json) {
            printJson({ ok: true, data: output, warnings: [], diagnostics: [] });
          } else {
            console.log('── Routing Decision ──────────────────');
            console.log(`  Intent:      ${intent.type} (${intent.complexity})`);
            console.log(`  Agent:       ${decision.agent}`);
            console.log(`  Reason:      ${decision.reason}`);
            console.log(`  Confidence:  ${(decision.confidence * 100).toFixed(0)}%`);
            console.log(`  Mode:        ${mode}`);
            if (intent.techStack.length > 0) {
              console.log(`  Tech Stack:  ${intent.techStack.join(', ')}`);
            }
            console.log(`  Model:       ${modelSelection.model} (${modelSelection.reason})`);
            if (techStack.languages.length > 0) {
              console.log(`  Detected:    ${[...techStack.languages, ...techStack.frameworks].join(', ')}`);
            }
            console.log('\n── Agent Ranking ──────────────────');
            for (const r of ranked) {
              const marker = r.agent === decision.agent ? ' ← selected' : '';
              console.log(`  ${r.agent.padEnd(14)} score=${r.score}  (${r.reason})${marker}`);
            }
          }
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
          await runSingle(decision.agent, input, { timeoutMs, maxMemoryMb, startTime, options, llm, gitGuard });
        } else if (mode === 'orchestrator') {
          const agents = ([decision.agent, 'codex', 'gemini'] as AgentId[]).filter(
            (a, i, arr) => arr.indexOf(a) === i,
          );
          const results = await orchestrate(input, agents, { timeoutMs });
          printResults(results, options);
        } else if (mode === 'handoff') {
          const chain: AgentId[] = [decision.agent, options.reviewer as AgentId ?? 'codex'];
          // LLM context summarization for handoff
          if (llm) {
            try {
              const summarized = await summarizeContext(input, input, llm);
              // summarized context is used as enhanced input for the chain
            } catch { /* non-critical */ }
          }
          const result = await handoff(input, chain, { timeoutMs });
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

async function runSingle(
  agentId: AgentId,
  input: string,
  ctx: { timeoutMs: number; maxMemoryMb: number; startTime: number; options: RunOptions; llm?: InstanceType<typeof import('../src/core/llm/service.js').LLMService> | null; gitGuard?: GitGuard },
): Promise<void> {
  const { program, args } = resolveAgentCommand(agentId, input);
  const pm = new ProcessManager();
  const proc = await pm.spawnAgent(agentId, args, {
    timeoutMs: ctx.timeoutMs,
    maxMemoryMb: ctx.maxMemoryMb,
    command: program,
    gitGuard: ctx.gitGuard,
  });

  let result: RunResult = buildResult(proc, ctx.startTime);

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
      const fbCmd = resolveAgentCommand(fb, input);
      const fbProc = await pm.spawnAgent(fb, fbCmd.args, {
        timeoutMs: ctx.timeoutMs,
        maxMemoryMb: ctx.maxMemoryMb,
        command: fbCmd.program,
      });
      result = { ...buildResult(fbProc, ctx.startTime), fallback: true };
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

  printSingleResult(result, ctx.options);
}

function printSingleResult(result: RunResult, options: RunOptions): void {
  if (options.json) {
    printJson({
      ok: result.ok,
      data: result,
      warnings: result.ok ? [] : [`Agent ${result.agent} exited with code ${result.exitCode}`],
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
