/**
 * Intent-to-Capability mapping layer.
 *
 * Maps the current TaskIntent.type (Chinese task categories) to
 * v2 CapabilityId (atomic operation units).
 *
 * Mapping rules (from routing-spec §0.1):
 *   代码生成 → write_code
 *   重构     → refactor
 *   调试     → fix_error (default; analyze if read-only hint detected)
 *   测试     → write_tests (default; run_tests if "run" hint detected)
 *   解释     → explain
 *
 * PR2: simple keyword-based resolution.
 * Future: LLM-assisted classification for ambiguous cases.
 */

import type { TaskIntent } from '../../types/agent.js';
import type { CapabilityId } from '../../types/capability.js';

/** Default mapping from intent type to capability. */
const INTENT_CAPABILITY_MAP: Record<string, CapabilityId> = {
  '代码生成': 'write_code',
  '代码审查': 'review_code',
  '重构': 'refactor',
  '调试': 'fix_error',
  '测试': 'write_tests',
  '解释': 'explain',
};

/** Keywords that override the default mapping. */
const RUN_TEST_HINTS = ['run', '跑', '执行', '运行'];
const ANALYZE_HINTS = ['analyze', '分析', '看看', 'inspect', '为什么', '怎么回事'];

/**
 * Resolve a TaskIntent to a CapabilityId.
 *
 * Uses the intent type as primary signal, with keyword heuristics
 * for sub-classification (e.g., debug → fix_error vs analyze).
 */
export function resolveCapability(intent: TaskIntent): CapabilityId {
  let base = INTENT_CAPABILITY_MAP[intent.type];
  if (!base) {
    // Unknown intent type — log warning and fall back to write_code
    console.warn(`[capability] Unknown intent type "${intent.type}", falling back to write_code`);
    base = 'write_code';
  }
  const lower = intent.rawInput.toLowerCase();

  // Sub-classification for debug intent → analyze if read-only hints
  if (intent.type === '调试') {
    if (ANALYZE_HINTS.some(h => lower.includes(h))) {
      return 'analyze';
    }
  }

  // Sub-classification for explain intent → analyze if analysis/deep-inspection hints
  if (intent.type === '解释') {
    if (ANALYZE_HINTS.some(h => lower.includes(h))) {
      return 'analyze';
    }
  }

  // Sub-classification for test intent → run_tests if execution hints
  if (intent.type === '测试') {
    if (RUN_TEST_HINTS.some(h => lower.includes(h))) {
      return 'run_tests';
    }
  }

  return base;
}
