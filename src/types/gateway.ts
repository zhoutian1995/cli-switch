/**
 * Gateway configuration — model routing via third-party API gateway.
 *
 * cli-switch never calls OpenAI/Anthropic directly.
 * All model access goes through SWITCH_API_KEY + SWITCH_BASE_URL.
 */

/** Cost-performance tier (semantic level, decoupled from actual model names). */
export type Tier = 'economy' | 'standard' | 'premium';

/** Tier → actual gateway model ID mapping (user configures per their gateway). */
export type TierModelMap = Partial<Record<Tier, string>>;

/**
 * Resolved gateway config — ready for use after loading from env/config.
 *
 * Resolution order:
 *   1. CLI flags / task-level config
 *   2. Project config (.cli-switch.yaml)
 *   3. Global config (~/.cli-switch/config.yaml)
 *   4. Environment variables (SWITCH_API_KEY, SWITCH_BASE_URL)
 */
export interface GatewayConfig {
  /** API key for the model gateway. Required for execution. */
  apiKey: string;

  /** Base URL of the model gateway. Default: https://openrouter.ai/api/v1 */
  baseUrl: string;

  /** Tier → gateway model ID mapping. */
  models: TierModelMap;

  /** Default tier when none specified. */
  defaultTier: Tier;
}

/** Environment variable names used by the gateway. */
export const GATEWAY_ENV_KEYS = {
  apiKey: 'SWITCH_API_KEY',
  baseUrl: 'SWITCH_BASE_URL',
} as const;

/**
 * Environment variable names to OVERRIDE in the agent subprocess.
 * These replace the native API keys so the agent routes through the gateway.
 */
export const AGENT_ENV_OVERRIDE: Record<string, Record<string, string>> = {
  'claude-code': {
    ANTHROPIC_API_KEY: GATEWAY_ENV_KEYS.apiKey,
    ANTHROPIC_BASE_URL: GATEWAY_ENV_KEYS.baseUrl,
  },
  codex: {
    OPENAI_API_KEY: GATEWAY_ENV_KEYS.apiKey,
    OPENAI_BASE_URL: GATEWAY_ENV_KEYS.baseUrl,
  },
};

/** Agents that support base URL override via env var. */
export const AGENT_BASE_URL_OVERRIDE: Record<string, string> = {
  'claude-code': 'ANTHROPIC_BASE_URL',
  codex: 'OPENAI_BASE_URL',
};
