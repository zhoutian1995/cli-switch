/**
 * Output Validator — validates raw agent output against capability schemas.
 *
 * @see docs/specs/runtime-spec.md §1.2 Execution State
 */

import type { CapabilityId } from '../../types/capability.js';
import { getOutputSchema } from './output-schemas.js';

/** Result of output validation */
export interface ValidationResult {
  valid: boolean;
  data?: Record<string, unknown>;
  errors?: string[];
}

/**
 * Validate raw agent output for a given capability.
 *
 * 1. Attempts JSON.parse on the raw output string.
 * 2. If not valid JSON, returns `{ valid: false, errors: [...] }`.
 * 3. If valid JSON, validates against the capability's output schema.
 *
 * @param capability - The capability ID to validate against.
 * @param rawOutput - Raw stdout string from the agent.
 */
export function validateOutput(
  capability: CapabilityId,
  rawOutput: string,
): ValidationResult {
  // Step 1: Try JSON parse
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawOutput);
  } catch {
    return {
      valid: false,
      errors: ['Output is not valid JSON'],
    };
  }

  // Step 2: Must be a plain object (not array, null, etc.)
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return {
      valid: false,
      errors: ['Output must be a JSON object'],
    };
  }

  // Step 3: Validate against capability schema
  const schema = getOutputSchema(capability);
  const result = schema.safeParse(parsed);

  if (result.success) {
    return {
      valid: true,
      data: result.data as Record<string, unknown>,
    };
  }

  return {
    valid: false,
    errors: result.error.issues.map((issue) => {
      const path = issue.path.join('.');
      return path ? `${path}: ${issue.message}` : issue.message;
    }),
  };
}
