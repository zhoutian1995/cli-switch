import { Command } from 'commander';
import { DEFAULT_CAPABILITIES, rankAgents, type AgentCapabilities } from '../src/core/router/capability-matrix.js';
import type { AgentId } from '../src/types/agent.js';
import { printJson } from './_shared.js';

export function createCapabilitiesCommand(): Command {
  return new Command('capabilities')
    .description('Show agent capability matrix')
    .option('--agent <agent>', 'show specific agent')
    .option('--json', 'output JSON')
    .action((options: { agent?: string; json?: boolean }) => {
      const agents = options.agent
        ? { [options.agent]: DEFAULT_CAPABILITIES[options.agent as AgentId] } as Record<string, AgentCapabilities>
        : DEFAULT_CAPABILITIES;

      if (options.json) {
        printJson({ ok: true, data: agents, warnings: [], diagnostics: [] });
        return;
      }

      const dims = ['reasoning', 'codeGen', 'refactoring', 'debugging', 'testing', 'longContext', 'speed', 'multimodal', 'costPerToken'] as const;

      for (const [id, cap] of Object.entries(agents)) {
        if (!cap) continue;
        console.log(`\n── ${id} ──────────────────`);
        const bar = (v: number) => '█'.repeat(v) + '░'.repeat(10 - v);
        for (const dim of dims) {
          const val = cap[dim] as number;
          const label = dim.padEnd(14);
          console.log(`  ${label} ${bar(val)}  ${val}/10`);
        }
        console.log(`  contextWindow  ${cap.contextWindow.toLocaleString()} tokens`);
      }

      // Rankings by task type
      console.log('\n── Rankings by Task Type ──────────────────');
      const taskTypes = ['重构', '调试', '测试', '解释', '代码生成'];
      for (const tt of taskTypes) {
        const ranked = rankAgents(tt, '中等');
        console.log(`\n  [${tt}]`);
        for (const r of ranked) {
          console.log(`    ${r.agent.padEnd(14)} score=${r.score}  (${r.reason})`);
        }
      }
    });
}
