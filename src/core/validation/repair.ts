/**
 * Auto-Repair Pipeline — bounded repair attempts for malformed agent output.
 *
 * When agent output fails schema validation, this module attempts to extract
 * valid structured data from the raw output (e.g., JSON embedded in prose,
 * or diff blocks in conversational text).
 *
 * Budget is tracked per-strategy-run via module-level counter.
 */

import type { CapabilityId } from '../../types/capability.js';
import { validateOutput } from './validator.js';

// ─── Types ────────────────────────────────────────────────────

export interface RepairConfig {
  maxAttempts: number;
  maxTotalRepairs: number;
}

export interface RepairResult {
  success: boolean;
  output: string;
  attempts: number;
  repairs: string[];
}

// ─── Defaults ─────────────────────────────────────────────────

const DEFAULT_CONFIG: RepairConfig = {
  maxAttempts: 2,
  maxTotalRepairs: 3,
};

// ─── Module-level budget counter ──────────────────────────────

let totalRepairs = 0;

/**
 * Reset the module-level repair counter.
 * Must be called at the start of each strategy execution.
 */
export function resetRepairCounter(): void {
  totalRepairs = 0;
}

/**
 * Get current repair count (for testing/debugging).
 */
export function getRepairCount(): number {
  return totalRepairs;
}

// ─── Repair Pipeline ──────────────────────────────────────────

/**
 * Attempt to repair malformed agent output.
 *
 * Strategy:
 *   Attempt 1: Extract embedded JSON via regex /\{[\s\S]*\}/
 *   Attempt 2: Extract diff blocks via regex for "diff --git" sections
 *
 * Budget: respects maxAttempts per call and maxTotalRepairs across calls.
 *
 * @param capability - The capability ID to validate repaired output against.
 * @param rawOutput - The raw (invalid) agent output string.
 * @param config - Optional repair configuration overrides.
 */
export function repairOutput(
  capability: CapabilityId,
  rawOutput: string,
  config?: Partial<RepairConfig>,
): RepairResult {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const repairs: string[] = [];

  // Check global budget
  if (totalRepairs >= cfg.maxTotalRepairs) {
    return { success: false, output: rawOutput, attempts: 0, repairs: ['Repair budget exhausted'] };
  }

  let attempt = 0;
  let candidate = rawOutput;

  while (attempt < cfg.maxAttempts && totalRepairs < cfg.maxTotalRepairs) {
    attempt++;

    if (attempt === 1) {
      // Attempt 1: Extract embedded JSON
      const extracted = extractEmbeddedJSON(rawOutput);
      if (extracted) {
        candidate = extracted;
        repairs.push('Extracted embedded JSON');
      } else {
        // Try extracting from code fences
        const fenceExtracted = extractFromCodeFences(rawOutput);
        if (fenceExtracted) {
          candidate = fenceExtracted;
          repairs.push('Extracted JSON from code fence');
        } else {
          continue; // Nothing to try, move to next attempt
        }
      }
    } else if (attempt === 2) {
      // Attempt 2: Extract diff blocks
      const diffExtracted = extractDiffBlocks(rawOutput);
      if (diffExtracted) {
        // Build a minimal valid JSON wrapper around the diff
        candidate = JSON.stringify({
          status: 'success',
          summary: 'Extracted diff from output',
          files_changed: ['(see diff)'],
          diff: diffExtracted,
        });
        repairs.push('Extracted diff blocks and wrapped in JSON');
      } else {
        continue;
      }
    }

    // Validate the repaired candidate
    const validation = validateOutput(capability, candidate);
    if (validation.valid) {
      totalRepairs++;
      return { success: true, output: candidate, attempts: attempt, repairs };
    }
  }

  totalRepairs += attempt;
  return { success: false, output: rawOutput, attempts: attempt, repairs };
}

// ─── Extraction Helpers ───────────────────────────────────────

/**
 * Extract first JSON object from text using regex /\{[\s\S]*\}/.
 * Attempts JSON.parse on the match to verify it's valid JSON.
 */
function extractEmbeddedJSON(text: string): string | null {
  // Match outermost balanced braces — greedy to get the full object
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;

  const extracted = match[0];

  // Verify it parses as valid JSON object
  try {
    const parsed = JSON.parse(extracted);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return extracted;
    }
  } catch {
    // Not valid JSON, try finding a smaller match
  }

  // Try to find the first valid JSON object by scanning
  return findFirstValidJSON(text);
}

/**
 * Try progressively smaller substrings to find valid JSON.
 */
function findFirstValidJSON(text: string): string | null {
  const starts: number[] = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') starts.push(i);
  }

  for (const start of starts) {
    // Find the matching closing brace
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (ch === '{') depth++;
      if (ch === '}') {
        depth--;
        if (depth === 0) {
          const candidate = text.slice(start, i + 1);
          try {
            const parsed = JSON.parse(candidate);
            if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
              return candidate;
            }
          } catch {
            break; // Not valid, try next start
          }
        }
      }
    }
  }

  return null;
}

/**
 * Extract JSON content from code fence blocks (```json ... ```).
 */
function extractFromCodeFences(text: string): string | null {
  // Match ```json or ``` blocks containing JSON-like content
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (!fenceMatch) return null;

  const content = fenceMatch[1].trim();
  // Check if it contains a JSON object
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return jsonMatch[0];
    }
  } catch {
    // Not valid JSON
  }

  return null;
}

/**
 * Extract diff blocks (sections starting with "diff --git") from text.
 */
function extractDiffBlocks(text: string): string | null {
  const matches = text.match(/diff --git[\s\S]*?(?=diff --git|$)/g);
  if (!matches || matches.length === 0) return null;

  return matches.join('\n').trim() || null;
}
