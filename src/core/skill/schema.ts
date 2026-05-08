/**
 * Skill Schema — Zod validation + TypeScript interfaces for Skill definitions.
 *
 * A Skill is a user-defined YAML template that maps to capability/strategy/tier
 * for reusable AI agent workflows.
 */

import { z } from 'zod';
import type { CapabilityId } from '../../types/capability.js';
import type { StrategyName } from '../../types/strategy.js';
import type { Tier } from '../../types/gateway.js';
import type { ExecutionMode } from '../sandbox/execution-mode.js';

// ─── Zod Schema ──────────────────────────────────────────────

export const skillSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  capability: z.enum([
    'write_code',
    'review_code',
    'refactor',
    'fix_error',
    'analyze',
    'write_tests',
    'run_tests',
    'explain',
  ]),
  strategy: z.enum(['single', 'write_review', 'write_test_fix', 'high_quality']).optional(),
  tier: z.enum(['economy', 'standard', 'premium']).optional(),
  prompt_template: z.string().optional(),
  execution_mode: z.enum(['default', 'patch-only', 'temp-copy', 'worktree']).optional(),
  env: z.record(z.string(), z.string()).optional(),
}).strict();

// ─── TypeScript Interfaces ───────────────────────────────────

export interface SkillDefinition {
  name: string;
  description: string;
  capability: CapabilityId;
  strategy?: StrategyName;
  tier?: Tier;
  prompt_template?: string;
  execution_mode?: ExecutionMode;
  env?: Record<string, string>;
}

export interface SkillInfo {
  name: string;
  description: string;
  source: 'global' | 'project';
}

export interface SkillLoadError {
  code: string;
  message: string;
  path?: string;
}

// ─── Helper ──────────────────────────────────────────────────

/**
 * Validate a parsed YAML object against the skill schema.
 * Returns the validated SkillDefinition on success, or an array of error messages.
 */
export function validateSkillYaml(
  data: unknown,
): { success: true; skill: SkillDefinition } | { success: false; errors: string[] } {
  const result = skillSchema.safeParse(data);
  if (result.success) {
    return { success: true, skill: result.data as SkillDefinition };
  }
  return {
    success: false,
    errors: result.error.issues.map((issue) => issue.message),
  };
}
