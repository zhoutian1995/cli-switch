/**
 * Strategy Engine — 多步编排模块
 *
 * @see docs/specs/routing-spec.md §2.3 策略选择规则
 */

export { getStrategy, selectStrategy, listStrategies, isValidStrategy } from './registry.js';
export { executeStrategy, createExecutionState, type StepExecutor, type RouteResolver } from './engine.js';
export { classifyError, createErrorRecord, type ClassificationResult, type EscalationStage } from './error-classifier.js';
