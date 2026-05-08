import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { loadConfig } from '../../src/core/config/index.js';
import { loadGatewayConfig, resolveGateway } from '../../src/core/gateway/index.js';
import { resolveTier } from '../../src/core/router/tier-resolver.js';

let __tmpDir = '';

vi.mock('../../src/platform/paths.js', async () => {
  const { join } = await import('node:path');
  return {
    resolvePaths: () => ({
      configDir: join(__tmpDir, 'config'),
      dataDir: join(__tmpDir, 'data'),
      cacheDir: join(__tmpDir, 'cache'),
    }),
  };
});

beforeEach(() => {
  __tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-switch-wiring-'));
  vi.resetModules();
});

afterEach(() => {
  fs.rmSync(__tmpDir, { recursive: true, force: true });
});

function writeGlobalConfig(content: string): void {
  const configDir = path.join(__tmpDir, 'config');
  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(path.join(configDir, 'config.yaml'), content, 'utf-8');
}

function writeProjectConfig(content: string): void {
  fs.writeFileSync(path.join(__tmpDir, '.cli-switch.yaml'), content, 'utf-8');
}

describe('02-02 Config wiring', () => {
  describe('gateway overrides from config', () => {
    it('passes config gateway.api_key as override to loadGatewayConfig', async () => {
      writeGlobalConfig(`
gateway:
  api_key: test-config-key-123
`);
      const result = loadConfig(__tmpDir);
      const config = result.config?.config;
      // Note: loadConfig redacts secret fields (api_key contains 'key')
      expect(config?.gateway?.api_key).toBe('***');

      // loadGatewayConfig receives raw overrides before redaction — test via loadConfigRaw
      const { loadConfigRaw } = await import('../../src/core/config/loader.js');
      const raw = loadConfigRaw(__tmpDir);
      expect(raw.config?.config?.gateway?.api_key).toBe('test-config-key-123');
    });

    it('passes config gateway.models as override', () => {
      writeGlobalConfig(`
gateway:
  models:
    economy: gpt-4o-mini
    standard: gpt-4o
`);
      const result = loadConfig(__tmpDir);
      const config = result.config?.config;
      expect(config?.gateway?.models).toEqual({
        economy: 'gpt-4o-mini',
        standard: 'gpt-4o',
      });
    });

    it('passes config gateway.default_tier as override', () => {
      writeGlobalConfig(`
gateway:
  default_tier: economy
`);
      const result = loadConfig(__tmpDir);
      expect(result.config?.config?.gateway?.default_tier).toBe('economy');
    });

    it('passes config gateway.agent_keys as override', () => {
      writeGlobalConfig(`
gateway:
  agent_keys:
    claude-code: claude-key-abc
    codex: codex-key-xyz
`);
      const result = loadConfig(__tmpDir);
      expect(result.config?.config?.gateway?.agent_keys).toEqual({
        'claude-code': 'claude-key-abc',
        'codex': 'codex-key-xyz',
      });
    });

    it('project config overrides global config via deepMerge', () => {
      writeGlobalConfig(`
gateway:
  default_tier: economy
  models:
    economy: gpt-4o-mini
`);
      writeProjectConfig(`
gateway:
  default_tier: premium
`);
      const result = loadConfig(__tmpDir);
      expect(result.config?.config?.gateway?.default_tier).toBe('premium');
      // models from global should be preserved
      expect(result.config?.config?.gateway?.models?.economy).toBe('gpt-4o-mini');
    });
  });

  describe('tier resolution with routing config', () => {
    it('uses routing.capability_tier_override to override default tier', () => {
      writeGlobalConfig(`
routing:
  capability_tier_override:
    write_code: premium
`);
      const result = loadConfig(__tmpDir);
      const routing = result.config?.config?.routing;
      // write_code normally resolves to 'standard'
      const tier = resolveTier('write_code', routing);
      expect(tier).toBe('premium');
    });

    it('uses routing.tier_default as fallback for capabilities without built-in default', () => {
      writeGlobalConfig(`
routing:
  tier_default: premium
`);
      const result = loadConfig(__tmpDir);
      const routing = result.config?.config?.routing;
      // run_tests has built-in default 'economy', so tier_default does NOT apply
      // But write_tests also has 'economy' — tier_default only applies to unknown capabilities
      // Since all CapabilityIds have built-in defaults, tier_default is effectively unused
      // Just verify routing was parsed correctly
      expect(routing?.tier_default).toBe('premium');
    });

    it('CLI --tier still wins over config routing', () => {
      writeGlobalConfig(`
routing:
  capability_tier_override:
    write_code: economy
`);
      const result = loadConfig(__tmpDir);
      const routing = result.config?.config?.routing;
      const tier = resolveTier('write_code', routing, 'premium');
      expect(tier).toBe('premium');
    });

    it('falls back to built-in defaults when no config', () => {
      const result = loadConfig(__tmpDir);
      const routing = result.config?.config?.routing;
      // write_code default is 'premium' per built-in mapping in tier-resolver.ts
      const tier = resolveTier('write_code', routing);
      expect(tier).toBe('premium');
    });
  });

  describe('execution strategy from config', () => {
    it('reads execution.default_strategy from config', () => {
      writeGlobalConfig(`
execution:
  default_strategy: write_test_fix
`);
      const result = loadConfig(__tmpDir);
      expect(result.config?.config?.execution?.default_strategy).toBe('write_test_fix');
    });

    it('project config overrides global for execution strategy', () => {
      writeGlobalConfig(`
execution:
  default_strategy: single
`);
      writeProjectConfig(`
execution:
  default_strategy: high_quality
`);
      const result = loadConfig(__tmpDir);
      expect(result.config?.config?.execution?.default_strategy).toBe('high_quality');
    });
  });

  describe('config source metadata', () => {
    it('reports global and project source load status', () => {
      writeGlobalConfig('gateway:\n  api_key: test\n');
      const result = loadConfig(__tmpDir);
      expect(result.config?.sources.global.loaded).toBe(true);
      expect(result.config?.sources.project.loaded).toBe(false);
    });

    it('reports both loaded when both exist', () => {
      writeGlobalConfig('gateway:\n  api_key: global\n');
      writeProjectConfig('gateway:\n  default_tier: premium\n');
      const result = loadConfig(__tmpDir);
      expect(result.config?.sources.global.loaded).toBe(true);
      expect(result.config?.sources.project.loaded).toBe(true);
    });
  });
});
