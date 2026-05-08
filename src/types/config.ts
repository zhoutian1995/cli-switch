/**
 * Configuration types and Zod schema for cli-switch.
 *
 * Config precedence: CLI flags > task options > project config > global config > env aliases > built-in defaults.
 *
 * @see .planning/phases/02-configuration-coverage/02-CONTEXT.md
 * @see docs/specs/routing-spec.md
 */

import { z } from 'zod';

// ─── Re-exports ─────────────────────────────────────────────

import type { Tier } from './gateway.js';
import type { StrategyName } from './strategy.js';

// ─── Config Section Schemas ────────────────────────────────

/** Gateway section — mirrors GatewayConfig shape but all optional (user config fills gaps). */
export const gatewaySectionSchema = z.object({
  api_key: z.string().min(1).optional(),
  base_url: z.string().url().optional().or(z.literal('')),
  models: z.partialRecord(z.enum(['economy', 'standard', 'premium']), z.string()).optional(),
  default_tier: z.enum(['economy', 'standard', 'premium']).optional(),
  agent_keys: z.record(z.string(), z.string()).optional(),
});

/** Routing section — mirrors RoutingConfig shape. */
export const routingSectionSchema = z.object({
  tier_default: z.enum(['economy', 'standard', 'premium']).optional(),
  capability_tier_override: z.partialRecord(
    z.string(),
    z.enum(['economy', 'standard', 'premium']),
  ).optional(),
});

/** Execution section — for future --execution default. */
export const executionSectionSchema = z.object({
  default_strategy: z.enum(['single', 'write_review', 'write_test_fix', 'high_quality']).optional(),
});

/** Loop section — strategy loop config. */
export const loopSectionSchema = z.object({
  verify_command: z.string().optional(),
  max_iterations: z.number().int().positive().optional(),
});

/** Output section — output preference. */
export const outputSectionSchema = z.object({
  json: z.boolean().optional(),
  quiet: z.boolean().optional(),
});

// ─── Root Config Schema ────────────────────────────────────

/**
 * Root config schema — validates the full YAML config file.
 * Strict: rejects unknown top-level keys to catch typos.
 */
export const configSchema = z.object({
  gateway: gatewaySectionSchema.optional(),
  routing: routingSectionSchema.optional(),
  execution: executionSectionSchema.optional(),
  loop: loopSectionSchema.optional(),
  output: outputSectionSchema.optional(),
}).strict();

// ─── TypeScript Interfaces ─────────────────────────────────

/** Gateway config section (all optional). */
export interface GatewaySection {
  api_key?: string;
  base_url?: string;
  models?: Partial<Record<Tier, string>>;
  default_tier?: Tier;
  agent_keys?: Record<string, string>;
}

/** Routing config section. */
export interface RoutingSection {
  tier_default?: Tier;
  capability_tier_override?: Partial<Record<string, Tier>>;
}

/** Execution config section. */
export interface ExecutionSection {
  default_strategy?: StrategyName;
}

/** Loop config section. */
export interface LoopSection {
  verify_command?: string;
  max_iterations?: number;
}

/** Output config section. */
export interface OutputSection {
  json?: boolean;
  quiet?: boolean;
}

/** Root config file shape (all sections optional). */
export interface CliSwitchConfig {
  gateway?: GatewaySection;
  routing?: RoutingSection;
  execution?: ExecutionSection;
  loop?: LoopSection;
  output?: OutputSection;
}

/** Config source metadata. */
export interface ConfigSource {
  path: string;
  loaded: boolean;
  invalid?: string;
}

/** Effective merged config with source metadata. */
export interface EffectiveConfig {
  config: CliSwitchConfig;
  sources: {
    global: ConfigSource;
    project: ConfigSource;
  };
}

/** Structured config error (runtime-spec §2.1 envelope). */
export interface ConfigError {
  code: string;
  message: string;
  path?: string;
}

/** Result from loading config. */
export interface ConfigLoadResult {
  config: EffectiveConfig | null;
  errors: ConfigError[];
}

// ─── Zod inferred type (for internal use) ─────────────────

export type ConfigSchemaInput = z.input<typeof configSchema>;
export type ConfigSchemaOutput = z.output<typeof configSchema>;
