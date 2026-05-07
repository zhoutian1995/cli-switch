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
    it('returns null when SWITCH_API_KEY is not set', () => {
      delete process.env.SWITCH_API_KEY;
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
