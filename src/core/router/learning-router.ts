import { appendFileSync, existsSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { AgentId } from '../../types/agent.js';

export interface RoutingHistory {
  agent: AgentId;
  taskType: string;
  complexity: string;
  success: boolean;
  durationMs: number;
  qualityScore?: number;
  timestamp: string;
}

export interface AgentStats {
  totalRuns: number;
  successRate: number;
  avgDuration: number;
  avgQuality: number;
}

export class LearningRouter {
  private historyPath: string;

  constructor(historyPath?: string) {
    this.historyPath = historyPath ?? `${process.env.HOME ?? '~'}/.config/cli-switch/routing-history.jsonl`;
  }

  recordRouting(result: RoutingHistory): void {
    const dir = dirname(this.historyPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    const line = JSON.stringify(result) + '\n';
    appendFileSync(this.historyPath, line, 'utf8');
  }

  private readHistory(): RoutingHistory[] {
    if (!existsSync(this.historyPath)) return [];
    const content = readFileSync(this.historyPath, 'utf8');
    return content
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line) as RoutingHistory);
  }

  getStats(agent: AgentId, taskType?: string): AgentStats {
    const all = this.readHistory();
    const filtered = all.filter((h) => {
      if (h.agent !== agent) return false;
      if (taskType && h.taskType !== taskType) return false;
      return true;
    });

    if (filtered.length === 0) {
      return { totalRuns: 0, successRate: 0, avgDuration: 0, avgQuality: 0 };
    }

    const successes = filtered.filter((h) => h.success);
    const withQuality = filtered.filter((h) => h.qualityScore !== undefined);

    return {
      totalRuns: filtered.length,
      successRate: successes.length / filtered.length,
      avgDuration: filtered.reduce((sum, h) => sum + h.durationMs, 0) / filtered.length,
      avgQuality: withQuality.length > 0
        ? withQuality.reduce((sum, h) => sum + (h.qualityScore ?? 0), 0) / withQuality.length
        : 0,
    };
  }

  suggestAgent(taskType: string, _complexity: string): AgentId | null {
    const all = this.readHistory();
    const byAgent = new Map<AgentId, { success: number; total: number }>();

    for (const h of all) {
      if (h.taskType !== taskType) continue;
      const entry = byAgent.get(h.agent) ?? { success: 0, total: 0 };
      entry.total++;
      if (h.success) entry.success++;
      byAgent.set(h.agent, entry);
    }

    let bestAgent: AgentId | null = null;
    let bestRate = 0;

    for (const [agent, { success, total }] of byAgent) {
      if (total < 5) continue;
      const rate = success / total;
      if (rate > 0.8 && rate > bestRate) {
        bestRate = rate;
        bestAgent = agent;
      }
    }

    return bestAgent;
  }
}
