/**
 * Tier Resolution — Capability-aware tier selection.
 *
 * Resolves the effective tier for a task based on:
 * 1. CLI `--tier` override (highest priority)
 * 2. `capability_tier_override` from config (per-capability)
 * 3. Built-in DEFAULT_CAPABILITY_TIER (per-capability hardcoded defaults)
 * 4. Global `tier_default` from config (only for unknown/future capabilities)
 * 5. Hardcoded fallback: 'standard'
 *
 * Note: tier_default only applies when a capability is NOT in DEFAULT_CAPABILITY_TIER.
 * All 8 current CapabilityIds have built-in defaults, so tier_default acts as a
 * forward-compatibility safety net for future capabilities.
 *
 * @see docs/specs/routing-spec.md §1.3 capability_tier_override
 */

import type { CapabilityId } from '../../types/capability.js';
import type { Tier } from '../../types/gateway.js';

/** Config shape for routing section. */
export interface RoutingConfig {
  tier_default?: Tier;
  capability_tier_override?: Partial<Record<CapabilityId, Tier>>;
}

/** Default tier overrides per capability (from routing-spec §1.3). */
const DEFAULT_CAPABILITY_TIER: Record<CapabilityId, Tier> = {
  write_code: 'premium',
  review_code: 'premium',
  refactor: 'premium',
  fix_error: 'standard',
  analyze: 'standard',
  write_tests: 'economy',
  run_tests: 'economy',
  explain: 'economy',
};

/**
 * Resolve the effective tier for a given capability.
 *
 * Priority: CLI > config per-capability override > built-in default > tier_default > 'standard'
 *
 * TODO: PR4 — consolidate --tier validation here as single source of truth;
 * callers should not duplicate the whitelist check.
 */
export function resolveTier(
  capability: CapabilityId,
  config?: RoutingConfig,
  cliOverride?: string,
): Tier {
  // 1. CLI --tier override wins
  if (cliOverride && ['economy', 'standard', 'premium'].includes(cliOverride)) {
    return cliOverride as Tier;
  }

  // 2. Config capability_tier_override
  if (config?.capability_tier_override?.[capability]) {
    return config.capability_tier_override[capability]!;
  }

  // 3. Default capability→tier mapping
  return DEFAULT_CAPABILITY_TIER[capability] ?? config?.tier_default ?? 'standard';
}
