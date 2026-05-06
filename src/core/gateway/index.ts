/**
 * Gateway module — loads config, resolves tier→model, injects env vars.
 *
 * Design: cli-switch never calls OpenAI/Anthropic directly.
 * All model access goes through SWITCH_API_KEY + SWITCH_BASE_URL.
 */

import type { AgentId } from '../../types/agent.js';
import {
  type GatewayConfig,
  type Tier,
  type TierModelMap,
  GATEWAY_ENV_KEYS,
  AGENT_ENV_OVERRIDE,
} from '../../types/gateway.js';

/** Result of gateway resolution — everything needed to spawn an agent. */
export interface ResolvedGateway {
  /** Whether gateway is configured and ready. */
  available: boolean;
  /** The gateway config (undefined if not available). */
  config?: GatewayConfig;
  /** The resolved model ID for the given tier. */
  model?: string;
  /** The tier used for resolution. */
  tier: Tier;
  /** Env vars to inject into agent subprocess (overrides native keys). */
  env: Record<string, string>;
  /** Reason for resolution (for decision_trace / dry-run). */
  reason: string;
}

/**
 * Load gateway config from environment variables + optional overrides.
 *
 * Priority: overrides > env vars
 */
export function loadGatewayConfig(overrides?: Partial<GatewayConfig>): GatewayConfig | null {
  const apiKey = overrides?.apiKey ?? process.env[GATEWAY_ENV_KEYS.apiKey];
  if (!apiKey) return null;

  const baseUrl =
    overrides?.baseUrl ??
    process.env[GATEWAY_ENV_KEYS.baseUrl] ??
    'https://openrouter.ai/api/v1';

  const models: TierModelMap = overrides?.models ?? {
    economy: process.env.SWITCH_MODEL_ECONOMY,
    standard: process.env.SWITCH_MODEL_STANDARD,
    premium: process.env.SWITCH_MODEL_PREMIUM,
  };

  const defaultTier: Tier = overrides?.defaultTier ?? 'standard';

  return { apiKey, baseUrl, models, defaultTier };
}

/**
 * Resolve gateway for a specific agent + tier combination.
 *
 * Returns the env vars to inject and the resolved model name.
 */
export function resolveGateway(
  gateway: GatewayConfig,
  agentId: AgentId,
  tier?: Tier,
): ResolvedGateway {
  const effectiveTier = tier ?? gateway.defaultTier;
  const model = gateway.models[effectiveTier];
  const agentOverrides = AGENT_ENV_OVERRIDE[agentId] ?? {};

  // Build env: gateway vars + agent-specific native key overrides
  const env: Record<string, string> = {
    [GATEWAY_ENV_KEYS.apiKey]: gateway.apiKey,
    [GATEWAY_ENV_KEYS.baseUrl]: gateway.baseUrl,
  };

  // Override native API keys so agent routes through gateway
  for (const [nativeKey, switchEnvKey] of Object.entries(agentOverrides)) {
    // The switchEnvKey is the env var name that holds the actual value
    // For agent subprocess, we set the native key = gateway value
    env[nativeKey] = gateway.apiKey;
  }

  // Also set base URL overrides if agent supports them
  // PR1 only supports claude-code and codex for gateway
  if (agentId === 'gemini') {
    return {
      available: false,
      tier: effectiveTier,
      env: {},
      reason: `Gateway not supported for '${agentId}' in PR1. Only claude-code and codex are supported.`,
    };
  }
  if (agentId === 'claude-code') {
    env['ANTHROPIC_BASE_URL'] = gateway.baseUrl;
  } else if (agentId === 'codex') {
    env['OPENAI_BASE_URL'] = gateway.baseUrl;
  }

  const reason = model
    ? `gateway tier=${effectiveTier} model=${model} agent=${agentId}`
    : `gateway tier=${effectiveTier} (no model mapping, using agent default) agent=${agentId}`;

  return {
    available: true,
    config: gateway,
    model,
    tier: effectiveTier,
    env,
    reason,
  };
}

/**
 * Get the model name to pass to the agent CLI.
 *
 * If gateway resolved a model, use that.
 * Otherwise fall back to the adapter's default model selection.
 */
export function getEffectiveModel(
  gateway: GatewayConfig | null,
  agentId: AgentId,
  tier: Tier,
  adapterDefault: string,
): { model: string; source: 'gateway' | 'adapter'; tier: Tier } {
  if (gateway) {
    const resolved = resolveGateway(gateway, agentId, tier);
    if (resolved.model) {
      return { model: resolved.model, source: 'gateway', tier: resolved.tier };
    }
  }
  return { model: adapterDefault, source: 'adapter', tier };
}
