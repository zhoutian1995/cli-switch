/**
 * Error Classifier — 失败分类（runtime-spec §2.1）
 *
 * 根据 Agent 输出和退出码将错误分为 6 种类型，
 * 并给出升级链建议。
 *
 * @see docs/specs/runtime-spec.md §2.1 错误类型分类
 * @see docs/specs/runtime-spec.md §2.2 错误处理升级链
 */

import type { CapabilityId } from '../../types/capability.js';
import type { ErrorType, ErrorRecord } from '../../types/strategy.js';

/** 升级链阶段 */
export type EscalationStage = 'retry' | 'upgrade_tier' | 'switch_agent' | 'abort';

/** 分类结果 */
export interface ClassificationResult {
  errorType: ErrorType;
  stage: EscalationStage;
  repairAction: string;
}

/** 匹配规则 */
interface ErrorPattern {
  pattern: RegExp;
  type: ErrorType;
  action: string;
}

// ─── 错误模式匹配 ─────────────────────────────────────────────

const SYNTAX_PATTERNS: ErrorPattern[] = [
  { pattern: /SyntaxError|parse error|编译失败|compilation failed/i, type: 'syntax_error', action: 'retry' },
  { pattern: /Cannot find module|Module not found|模块未找到/i, type: 'syntax_error', action: 'retry' },
  { pattern: /Unexpected token|Unexpected end of input/i, type: 'syntax_error', action: 'retry' },
];

const TEST_PATTERNS: ErrorPattern[] = [
  { pattern: /\d+ failing|tests? failed|测试失败|✗|×/i, type: 'test_failure', action: 'loop' },
  { pattern: /AssertionError|expected.*got|期望.*实际/i, type: 'test_failure', action: 'loop' },
];

const RUNTIME_PATTERNS: ErrorPattern[] = [
  { pattern: /TypeError|RuntimeError|ReferenceError|ENOENT|permission denied|ECONNREFUSED/i, type: 'runtime_error', action: 'analyze_then_fix' },
  { pattern: /ENOMEM|out of memory|heap out of memory/i, type: 'runtime_error', action: 'analyze_then_fix' },
];

const AGENT_PATTERNS: ErrorPattern[] = [
  { pattern: /SIGKILL|SIGTERM|OOMKilled|process exited/i, type: 'agent_error', action: 'retry' },
  { pattern: /rate limit|429|quota exceeded/i, type: 'agent_error', action: 'retry' },
];

// ─── 分类器 ────────────────────────────────────────────────────

/**
 * Classify an error from agent output + exit code.
 *
 * Priority: test_failure > syntax_error > runtime_error > agent_error > timeout > unknown
 */
export function classifyError(
  output: string,
  exitCode: number | undefined,
  capability: CapabilityId,
  iteration: number,
): ClassificationResult {
  // 1. Timeout check (exit code based)
  if (exitCode === 124 || exitCode === 137) {
    return {
      errorType: 'timeout',
      stage: 'upgrade_tier',
      repairAction: 'upgrade_tier',
    };
  }

  // 2. Pattern matching (priority order)
  // TEST_PATTERNS only apply when capability is test-related
  const testCapabilities: CapabilityId[] = ['run_tests', 'write_tests'];
  const allPatterns = [
    ...(testCapabilities.includes(capability) ? TEST_PATTERNS : []),
    ...SYNTAX_PATTERNS,
    ...RUNTIME_PATTERNS,
    ...AGENT_PATTERNS,
  ];

  for (const { pattern, type, action } of allPatterns) {
    if (pattern.test(output)) {
      return {
        errorType: type,
        stage: escalate(type, iteration),
        repairAction: action,
      };
    }
  }

  // 3. Non-zero exit code without pattern match
  if (exitCode && exitCode !== 0) {
    return {
      errorType: 'agent_error',
      stage: 'retry',
      repairAction: 'retry',
    };
  }

  // 4. Unknown
  return {
    errorType: 'unknown',
    stage: iteration > 1 ? 'abort' : 'retry',
    repairAction: 'retry_once',
  };
}

/**
 * Determine escalation stage based on error type and iteration count.
 *
 * Upgrade chain: retry → upgrade_tier → switch_agent → abort
 */
function escalate(errorType: ErrorType, iteration: number): EscalationStage {
  // Simple escalation based on iteration count
  if (errorType === 'test_failure') {
    // Loop scenario: keep looping until max iterations
    return 'retry';
  }

  if (errorType === 'syntax_error' || errorType === 'agent_error') {
    if (iteration <= 1) return 'retry';
    if (iteration <= 2) return 'upgrade_tier';
    return 'switch_agent';
  }

  if (errorType === 'timeout') {
    if (iteration <= 1) return 'upgrade_tier';
    return 'switch_agent';
  }

  if (errorType === 'unknown') {
    return iteration <= 1 ? 'retry' : 'abort';
  }

  return 'abort';
}

/**
 * Create an ErrorRecord from classification result.
 */
export function createErrorRecord(
  step: number,
  capability: CapabilityId,
  iteration: number,
  result: ClassificationResult,
  output: string,
): ErrorRecord {
  return {
    step,
    capability,
    iteration,
    errorType: result.errorType,
    errorOutput: output.slice(0, 500), // Truncate for storage
    repairAction: result.repairAction,
  };
}
