/**
 * Strategy Registry — 策略定义注册表
 *
 * 4 个内置策略模板（routing-spec §2.3）：
 * - single: 单步执行
 * - write_review: 写 + 审
 * - write_test_fix: 写 + 测 + 修（Loop）
 * - high_quality: 全 premium 写 + 审 + 测 + 修
 *
 * @see docs/specs/routing-spec.md §2.3 策略选择规则
 */

import type { CapabilityId } from '../../types/capability.js';
import type { StrategyDefinition, StrategyName } from '../../types/strategy.js';

const STRATEGIES: Record<StrategyName, StrategyDefinition> = {
  single: {
    name: 'single',
    label: '单步执行',
    description: 'Agent 执行一步直接输出',
    steps: [
      { step: 1, capability: 'write_code', onFail: 'abort' },
    ],
    loop: false,
    maxIterations: 1,
    defaultTier: 'standard',
  },

  write_review: {
    name: 'write_review',
    label: '写 + 审',
    description: 'write_code → review_code',
    steps: [
      { step: 1, capability: 'write_code', onFail: 'abort' },
      { step: 2, capability: 'review_code', onFail: 'abort' },
    ],
    loop: false,
    maxIterations: 1,
    defaultTier: 'standard',
  },

  write_test_fix: {
    name: 'write_test_fix',
    label: '写 + 测 + 修（Loop）',
    description: 'write_code → write_tests → run_tests → 失败则 fix_error → Loop',
    steps: [
      { step: 1, capability: 'write_code', onFail: 'abort' },
      { step: 2, capability: 'write_tests', onFail: 'abort' },
      { step: 3, capability: 'run_tests', onFail: 'loop' },
      { step: 4, capability: 'fix_error', onFail: 'retry' },
    ],
    loop: true,
    maxIterations: 5,
    defaultTier: 'standard',
  },

  high_quality: {
    name: 'high_quality',
    label: '高质量模式',
    description: '全 premium: write_code → review_code → run_tests → 失败修复',
    steps: [
      { step: 1, capability: 'write_code', onFail: 'abort', tierOverride: 'premium' },
      { step: 2, capability: 'review_code', onFail: 'abort', tierOverride: 'premium' },
      { step: 3, capability: 'run_tests', onFail: 'loop' },
      { step: 4, capability: 'fix_error', onFail: 'retry', tierOverride: 'premium' },
    ],
    loop: true,
    maxIterations: 5,
    defaultTier: 'premium',
  },
};

/**
 * Capability → 默认策略映射（routing-spec §2.3 策略选择规则）
 */
const CAPABILITY_STRATEGY_MAP: Record<CapabilityId, StrategyName> = {
  write_code: 'single',
  review_code: 'single',
  write_tests: 'write_test_fix',
  refactor: 'write_review',
  fix_error: 'write_test_fix',
  analyze: 'single',
  explain: 'single',
  run_tests: 'single',
};

/**
 * Get a strategy definition by name.
 */
export function getStrategy(name: StrategyName, capability?: CapabilityId): StrategyDefinition {
  const base = STRATEGIES[name];
  // For 'single' strategy, dynamically set the step capability to match the intent
  if (name === 'single' && capability && capability !== 'write_code') {
    return {
      ...base,
      steps: [{ ...base.steps[0], capability }],
    };
  }
  return base;
}

/**
 * Select the default strategy for a given capability.
 */
export function selectStrategy(capability: CapabilityId): StrategyName {
  return CAPABILITY_STRATEGY_MAP[capability] ?? 'single';
}

/**
 * List all available strategies.
 */
export function listStrategies(): StrategyDefinition[] {
  return Object.values(STRATEGIES);
}

/**
 * Validate a strategy name.
 */
export function isValidStrategy(name: string): name is StrategyName {
  return name in STRATEGIES;
}
