/**
 * Capability — atomic operation unit for cli-switch.
 *
 * Users express intent in natural language (parsed to TaskIntent.type).
 * The system maps intent to a Capability (atomic operation), which then
 * determines agent selection, model tier, and output schema.
 *
 * PR2 scope: define enum + intent→capability mapping + add to RunResult.
 * Future: capability_tier_override, strategy routing, output schema validation.
 */

/** All capabilities cli-switch recognizes. */
export type CapabilityId =
  | 'write_code'
  | 'review_code'
  | 'refactor'
  | 'fix_error'
  | 'analyze'
  | 'write_tests'
  | 'run_tests'
  | 'explain';

/** Capability metadata. */
export interface Capability {
  /** Machine-readable ID. */
  id: CapabilityId;
  /** Human-readable label (en). */
  label: string;
  /** Whether this capability modifies files. */
  mutates: boolean;
  /** Description for dry-run / help output. */
  description: string;
}

/** Registry of all capabilities. */
export const CAPABILITIES: Record<CapabilityId, Capability> = {
  write_code: {
    id: 'write_code',
    label: 'Write Code',
    mutates: true,
    description: 'Generate or modify source code files',
  },
  review_code: {
    id: 'review_code',
    label: 'Review Code',
    mutates: false,
    description: 'Review code quality, style, and correctness',
  },
  refactor: {
    id: 'refactor',
    label: 'Refactor',
    mutates: true,
    description: 'Restructure existing code without changing behavior',
  },
  fix_error: {
    id: 'fix_error',
    label: 'Fix Error',
    mutates: true,
    description: 'Debug and fix errors or bugs',
  },
  analyze: {
    id: 'analyze',
    label: 'Analyze',
    mutates: false,
    description: 'Read-only analysis, no file modifications',
  },
  write_tests: {
    id: 'write_tests',
    label: 'Write Tests',
    mutates: true,
    description: 'Generate test files',
  },
  run_tests: {
    id: 'run_tests',
    label: 'Run Tests',
    mutates: false,
    description: 'Execute existing tests and report results',
  },
  explain: {
    id: 'explain',
    label: 'Explain',
    mutates: false,
    description: 'Explain code or concepts (read-only)',
  },
};

/** Get a capability by ID. Throws if invalid. */
export function getCapability(id: CapabilityId): Capability {
  const cap = CAPABILITIES[id];
  if (!cap) throw new Error(`Unknown capability: ${id}`);
  return cap;
}

/** All valid capability IDs. Useful for input validation. */
export const CAPABILITY_IDS = Object.keys(CAPABILITIES) as CapabilityId[];
