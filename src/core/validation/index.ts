/**
 * Validation module barrel export.
 */

export {
  getOutputSchema,
  outputSchemas,
} from './output-schemas.js';

export {
  validateOutput,
  type ValidationResult,
} from './validator.js';

export {
  parseUnifiedDiff,
  validateDiffPaths,
  type DiffFile,
  type DiffHunk,
  type DiffParseResult,
  type ProtectedPathConfig,
} from './diff-validator.js';

export {
  repairOutput,
  resetRepairCounter,
  getRepairCount,
  type RepairConfig,
  type RepairResult,
} from './repair.js';
