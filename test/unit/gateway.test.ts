import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  loadGatewayConfig,
  resolveGateway,
  getEffectiveModel,
} from '../../src/core/gateway/index.js';
import type { GatewayConfig } from '../../src/types/gateway.js';

describe('Gateway', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('loadGatewayConfig', () => {
    it('returns null when no gateway api key alias is set', () => {
      delete process.env.SWITCH_API_KEY;
      delete process.env.SWITCH_RELAY_API_KEY;
      delete process.env.OPENROUTER_API_KEY;
      expect(loadGatewayConfig()).toBeNull();
    });

    it('loads config from env vars', () => {
      process.env.SWITCH_API_KEY = 'test-key-123';
      process.env.SWITCH_BASE_URL = 'https://my-gateway.example.com/v1';

      const config = loadGatewayConfig();
      expect(config).not.toBeNull();
      expect(config!.apiKey).toBe('test-key-123');
      expect(config!.baseUrl).toBe('https://my-gateway.example.com/v1');
      expect(config!.defaultTier).toBe('standard');
    });

    it('uses default baseUrl when SWITCH_BASE_URL is not set', () => {
      process.env.SWITCH_API_KEY = 'test-key';

      const config = loadGatewayConfig();
      expect(config!.baseUrl).toBe('https://openrouter.ai/api/v1');
    });

    it('loads config from self-hosted relay env aliases', () => {
      delete process.env.SWITCH_API_KEY;
      delete process.env.SWITCH_BASE_URL;
      process.env.SWITCH_RELAY_API_KEY = 'relay-key';
      process.env.SWITCH_RELAY_BASE_URL = 'https://relay.example.com/v1';

      const config = loadGatewayConfig();
      expect(config!.apiKey).toBe('relay-key');
      expect(config!.baseUrl).toBe('https://relay.example.com/v1');
    });

    it('loads config from OpenRouter env aliases', () => {
      delete process.env.SWITCH_API_KEY;
      delete process.env.SWITCH_RELAY_API_KEY;
      delete process.env.SWITCH_BASE_URL;
      delete process.env.SWITCH_RELAY_BASE_URL;
      process.env.OPENROUTER_API_KEY = 'openrouter-key';
      process.env.OPENROUTER_BASE_URL = 'https://openrouter.example.com/api/v1';

      const config = loadGatewayConfig();
      expect(config!.apiKey).toBe('openrouter-key');
      expect(config!.baseUrl).toBe('https://openrouter.example.com/api/v1');
    });

    it('keeps SWITCH_* gateway env aliases higher priority than provider aliases', () => {
      process.env.SWITCH_API_KEY = 'switch-key';
      process.env.SWITCH_BASE_URL = 'https://switch.example.com/v1';
      process.env.SWITCH_RELAY_API_KEY = 'relay-key';
      process.env.SWITCH_RELAY_BASE_URL = 'https://relay.example.com/v1';
      process.env.OPENROUTER_API_KEY = 'openrouter-key';
      process.env.OPENROUTER_BASE_URL = 'https://openrouter.example.com/api/v1';

      const config = loadGatewayConfig();
      expect(config!.apiKey).toBe('switch-key');
      expect(config!.baseUrl).toBe('https://switch.example.com/v1');
    });

    it('loads tier model mappings from env', () => {
      process.env.SWITCH_API_KEY = 'test-key';
      process.env.SWITCH_MODEL_ECONOMY = 'gpt-4o-mini';
      process.env.SWITCH_MODEL_STANDARD = 'gpt-4o';
      process.env.SWITCH_MODEL_PREMIUM = 'o3';

      const config = loadGatewayConfig();
      expect(config!.models.economy).toBe('gpt-4o-mini');
      expect(config!.models.standard).toBe('gpt-4o');
      expect(config!.models.premium).toBe('o3');
    });

    it('accepts overrides that take priority over env', () => {
      process.env.SWITCH_API_KEY = 'env-key';
      process.env.SWITCH_BASE_URL = 'https://env-url.com';

      const config = loadGatewayConfig({
        apiKey: 'override-key',
        baseUrl: 'https://override-url.com',
        models: { economy: 'custom-cheap' },
      });

      expect(config!.apiKey).toBe('override-key');
      expect(config!.baseUrl).toBe('https://override-url.com');
      expect(config!.models.economy).toBe('custom-cheap');
    });

    it('loads per-agent keys from SWITCH_AGENT_KEYS env var', () => {
      process.env.SWITCH_API_KEY = 'default-key';
      process.env.SWITCH_AGENT_KEYS = '{"claude-code":"anthropic-key","codex":"openai-key"}';

      const config = loadGatewayConfig();
      expect(config!.agentKeys).toBeDefined();
      expect(config!.agentKeys!['claude-code']).toBe('anthropic-key');
      expect(config!.agentKeys!['codex']).toBe('openai-key');
    });

    it('ignores invalid SWITCH_AGENT_KEYS JSON silently', () => {
      process.env.SWITCH_API_KEY = 'default-key';
      process.env.SWITCH_AGENT_KEYS = 'not-json';

      const config = loadGatewayConfig();
      expect(config!.agentKeys).toBeUndefined();
    });

    it('merges agent keys overrides over env var', () => {
      process.env.SWITCH_API_KEY = 'default-key';
      process.env.SWITCH_AGENT_KEYS = '{"claude-code":"env-claude-key"}';

      const config = loadGatewayConfig({
        agentKeys: { codex: 'override-codex-key' },
      });
      expect(config!.agentKeys!['claude-code']).toBe('env-claude-key');
      expect(config!.agentKeys!['codex']).toBe('override-codex-key');
    });
  });

  describe('resolveGateway', () => {
    const config: GatewayConfig = {
      apiKey: 'gw-key',
      baseUrl: 'https://gw.example.com/v1',
      models: {
        economy: 'cheap-model',
        standard: 'default-model',
        premium: 'premium-model',
      },
      defaultTier: 'standard',
    };

    it('resolves claude-code with standard tier', () => {
      const result = resolveGateway(config, 'claude-code', 'standard');

      expect(result.available).toBe(true);
      expect(result.model).toBe('default-model');
      expect(result.tier).toBe('standard');
      expect(result.env['ANTHROPIC_API_KEY']).toBe('gw-key');
      expect(result.env['ANTHROPIC_BASE_URL']).toBe('https://gw.example.com/v1');
    });

    it('resolves codex with economy tier', () => {
      const result = resolveGateway(config, 'codex', 'economy');

      expect(result.model).toBe('cheap-model');
      expect(result.tier).toBe('economy');
      expect(result.env['OPENAI_API_KEY']).toBe('gw-key');
      expect(result.env['OPENAI_BASE_URL']).toBe('https://gw.example.com/v1');
    });

    it('resolves with default tier when tier not specified', () => {
      const result = resolveGateway(config, 'claude-code');

      expect(result.tier).toBe('standard');
      expect(result.model).toBe('default-model');
    });

    it('handles missing tier model mapping', () => {
      const partialConfig: GatewayConfig = {
        apiKey: 'gw-key',
        baseUrl: 'https://gw.example.com/v1',
        models: { standard: 'default-model' }, // no economy
        defaultTier: 'standard',
      };

      const result = resolveGateway(partialConfig, 'claude-code', 'economy');
      expect(result.model).toBeUndefined();
      expect(result.reason).toContain('no model mapping');
    });

    it('uses per-agent key when agentKeys is configured', () => {
      const configWithKeys: GatewayConfig = {
        apiKey: 'default-gw-key',
        baseUrl: 'https://gw.example.com/v1',
        models: { standard: 'default-model' },
        defaultTier: 'standard',
        agentKeys: {
          'claude-code': 'claude-specific-key',
          codex: 'codex-specific-key',
        },
      };

      const claudeResult = resolveGateway(configWithKeys, 'claude-code', 'standard');
      expect(claudeResult.env['ANTHROPIC_API_KEY']).toBe('claude-specific-key');
      expect(claudeResult.env['SWITCH_API_KEY']).toBe('claude-specific-key');

      const codexResult = resolveGateway(configWithKeys, 'codex', 'standard');
      expect(codexResult.env['OPENAI_API_KEY']).toBe('codex-specific-key');
      expect(codexResult.env['SWITCH_API_KEY']).toBe('codex-specific-key');
    });

    it('falls back to default apiKey when agent not in agentKeys', () => {
      const configWithKeys: GatewayConfig = {
        apiKey: 'default-gw-key',
        baseUrl: 'https://gw.example.com/v1',
        models: { standard: 'default-model' },
        defaultTier: 'standard',
        agentKeys: {
          'claude-code': 'claude-specific-key',
        },
      };

      const codexResult = resolveGateway(configWithKeys, 'codex', 'standard');
      expect(codexResult.env['OPENAI_API_KEY']).toBe('default-gw-key');
    });

    it('works without agentKeys (backward compat)', () => {
      const basicConfig: GatewayConfig = {
        apiKey: 'gw-key',
        baseUrl: 'https://gw.example.com/v1',
        models: { standard: 'default-model' },
        defaultTier: 'standard',
      };

      const result = resolveGateway(basicConfig, 'claude-code', 'standard');
      expect(result.env['ANTHROPIC_API_KEY']).toBe('gw-key');
    });
  });

  describe('getEffectiveModel', () => {
    const config: GatewayConfig = {
      apiKey: 'gw-key',
      baseUrl: 'https://gw.example.com/v1',
      models: { standard: 'gateway-model' },
      defaultTier: 'standard',
    };

    it('returns gateway model when available', () => {
      const result = getEffectiveModel(config, 'claude-code', 'standard', 'adapter-default');
      expect(result.model).toBe('gateway-model');
      expect(result.source).toBe('gateway');
      expect(result.tier).toBe('standard');
    });

    it('falls back to adapter default when gateway has no model for tier', () => {
      const result = getEffectiveModel(config, 'claude-code', 'premium', 'adapter-default');
      expect(result.model).toBe('adapter-default');
      expect(result.source).toBe('adapter');
    });

    it('falls back when gateway is null', () => {
      const result = getEffectiveModel(null, 'claude-code', 'standard', 'adapter-default');
      expect(result.model).toBe('adapter-default');
      expect(result.source).toBe('adapter');
    });
  });
});
