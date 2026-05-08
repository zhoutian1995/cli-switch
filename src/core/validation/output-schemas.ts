/**
 * Capability Output Schemas — per-capability Zod validation schemas.
 *
 * Each capability has a schema requiring `status` and `summary` as base fields,
 * plus capability-specific fields. Schemas use `.passthrough()` to allow extra
 * fields without stripping them.
 *
 * @see docs/specs/runtime-spec.md
 */

import { z } from 'zod';
import type { CapabilityId } from '../../types/capability.js';

// ─── Base schema (shared by all capabilities) ─────────────────────

const baseSchema = z.object({
  status: z.enum(['success', 'failed']),
  summary: z.string(),
});

// ─── Capability-specific schemas ──────────────────────────────────

const writeCodeSchema = baseSchema.extend({
  files_changed: z.array(z.string()),
  diff: z.string(),
}).passthrough();

const writeTestsSchema = baseSchema.extend({
  test_files_created: z.array(z.string()),
}).passthrough();

const runTestsSchema = baseSchema.extend({
  test_result: z.object({
    status: z.enum(['pass', 'fail']),
    output: z.string(),
  }),
}).passthrough();

const reviewCodeSchema = baseSchema.extend({
  review_report: z.object({
    verdict: z.enum(['pass', 'reject']),
    comments: z.array(z.string()),
  }),
}).passthrough();

const fixErrorSchema = baseSchema.extend({
  files_changed: z.array(z.string()),
  diff: z.string(),
}).passthrough();

const refactorSchema = baseSchema.extend({
  files_changed: z.array(z.string()),
  diff: z.string(),
  test_validation: z.object({
    status: z.enum(['pass', 'fail']),
    output: z.string().optional(),
  }),
}).passthrough();

const analyzeSchema = baseSchema.extend({
  analysis_report: z.object({
    root_cause: z.string(),
    suggestion: z.string(),
  }),
}).passthrough();

const explainSchema = baseSchema.extend({
  explanation_text: z.string(),
}).passthrough();

// ─── Registry ────────────────────────────────────────────────────

/** Map of capability ID → output Zod schema */
export const outputSchemas: Record<CapabilityId, z.ZodType> = {
  write_code: writeCodeSchema,
  write_tests: writeTestsSchema,
  run_tests: runTestsSchema,
  review_code: reviewCodeSchema,
  fix_error: fixErrorSchema,
  refactor: refactorSchema,
  analyze: analyzeSchema,
  explain: explainSchema,
};

/**
 * Get the output validation schema for a given capability.
 * @throws Error if capability ID is invalid.
 */
export function getOutputSchema(capability: CapabilityId): z.ZodType {
  const schema = outputSchemas[capability];
  if (!schema) {
    throw new Error(`No output schema defined for capability: ${capability}`);
  }
  return schema;
}
