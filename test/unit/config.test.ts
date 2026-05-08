import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { deepMerge, isSecretField, redactSecrets } from '../../src/core/config/merge.js';

// ─── merge.ts tests ────────────────────────────────────────

describe('deepMerge', () => {
  it('returns base when override is empty', () => {
    const base = { a: 1, b: 'hello' };
    expect(deepMerge(base, {})).toEqual(base);
  });

  it('overrides scalar values', () => {
    const base = { a: 1, b: 'hello' };
    expect(deepMerge(base, { a: 2 })).toEqual({ a: 2, b: 'hello' });
  });

  it('recursively merges nested objects', () => {
    const base = { gateway: { api_key: 'old', base_url: 'http://old' } } as Record<string, unknown>;
    const override = { gateway: { api_key: 'new' } } as Record<string, unknown>;
    expect(deepMerge(base, override)).toEqual({
      gateway: { api_key: 'new', base_url: 'http://old' },
    });
  });

  it('replaces arrays (does not concatenate)', () => {
    const base = { models: ['a', 'b'] };
    const override = { models: ['c'] };
    expect(deepMerge(base, override)).toEqual({ models: ['c'] });
  });

  it('skips undefined override values (preserves base)', () => {
    const base = { a: 1, b: 2 } as Record<string, unknown>;
    const override = { a: undefined } as Record<string, unknown>;
    expect(deepMerge(base, override)).toEqual({ a: 1, b: 2 });
  });

  it('does not mutate inputs', () => {
    const base = { a: { nested: 1 } };
    const override = { a: { nested: 2 } };
    deepMerge(base, override);
    expect((base.a as { nested: number }).nested).toBe(1);
    expect((override.a as { nested: number }).nested).toBe(2);
  });

  it('handles 3-level deep merge', () => {
    const base = { a: { b: { c: 1, d: 2 } } } as Record<string, unknown>;
    const override = { a: { b: { c: 10 } } } as Record<string, unknown>;
    expect(deepMerge(base, override)).toEqual({ a: { b: { c: 10, d: 2 } } });
  });
});

describe('isSecretField', () => {
  it('matches key', () => {
    expect(isSecretField('api_key')).toBe(true);
    expect(isSecretField('apiKey')).toBe(true);
    expect(isSecretField('API_KEY')).toBe(true);
  });

  it('matches token', () => {
    expect(isSecretField('access_token')).toBe(true);
    expect(isSecretField('refreshToken')).toBe(true);
  });

  it('matches secret', () => {
    expect(isSecretField('client_secret')).toBe(true);
  });

  it('matches password', () => {
    expect(isSecretField('db_password')).toBe(true);
  });

  it('does not match non-secret fields', () => {
    expect(isSecretField('base_url')).toBe(false);
    expect(isSecretField('default_tier')).toBe(false);
    expect(isSecretField('verify_command')).toBe(false);
  });
});

describe('redactSecrets', () => {
  it('redacts string values of secret fields', () => {
    const input = { api_key: 'sk-12345', base_url: 'http://example.com' };
    expect(redactSecrets(input)).toEqual({
      api_key: '***',
      base_url: 'http://example.com',
    });
  });

  it('does not redact empty strings', () => {
    expect(redactSecrets({ api_key: '' })).toEqual({ api_key: '' });
  });

  it('recursively redacts nested secrets', () => {
    const input = {
      gateway: {
        api_key: 'secret',
        base_url: 'http://example.com',
        agent_keys: { claude_api_key: 'key1' },
      },
    };
    expect(redactSecrets(input)).toEqual({
      gateway: {
        api_key: '***',
        base_url: 'http://example.com',
        agent_keys: { claude_api_key: '***' },
      },
    });
  });

  it('passes through null/undefined/primitives unchanged', () => {
    expect(redactSecrets(null)).toBe(null);
    expect(redactSecrets(undefined)).toBe(undefined);
    expect(redactSecrets(42)).toBe(42);
    expect(redactSecrets('plain')).toBe('plain');
  });

  it('processes arrays recursively', () => {
    const input = [{ api_key: 'secret' }, { safe: 'value' }];
    expect(redactSecrets(input)).toEqual([{ api_key: '***' }, { safe: 'value' }]);
  });

  it('does not mutate input', () => {
    const input = { api_key: 'secret' };
    redactSecrets(input);
    expect(input.api_key).toBe('secret');
  });
});

// ─── loader.ts integration tests (with temp files) ────────

// vi.mock is hoisted — must be at module top level.
// We use a mutable ref to point the mock at the temp dir.
let __tmpDir = '';

vi.mock('../../src/platform/paths.js', () => ({
  resolvePaths: () => ({
    configDir: path.join(__tmpDir, 'config'),
    dataDir: __tmpDir,
    cacheDir: __tmpDir,
  }),
}));

describe('config loader (integration)', () => {
  beforeEach(() => {
    __tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-switch-test-'));
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(__tmpDir, { recursive: true, force: true });
    __tmpDir = '';
  });

  it('returns null config when no config files exist', async () => {
    const { loadConfig } = await import('../../src/core/config/loader.js');
    const result = loadConfig(__tmpDir);
    expect(result.config).toBeNull();
    expect(result.errors).toEqual([]);
  });

  it('loads project config file with redaction', async () => {
    const { loadConfig } = await import('../../src/core/config/loader.js');
    const projectConfig = path.join(__tmpDir, '.cli-switch.yaml');
    fs.writeFileSync(projectConfig, [
      'gateway:',
      '  base_url: https://example.com/v1',
      '  api_key: sk-test123',
      'routing:',
      '  tier_default: premium',
    ].join('\n'));

    const result = loadConfig(__tmpDir);
    expect(result.config).not.toBeNull();
    expect(result.config!.config.gateway?.base_url).toBe('https://example.com/v1');
    expect(result.config!.config.gateway?.api_key).toBe('***');
    expect(result.config!.config.routing?.tier_default).toBe('premium');
    expect(result.config!.sources.project.loaded).toBe(true);
    expect(result.config!.sources.global.loaded).toBe(false);
  });

  it('loads raw config without redaction via loadConfigRaw', async () => {
    const { loadConfigRaw } = await import('../../src/core/config/loader.js');
    const projectConfig = path.join(__tmpDir, '.cli-switch.yaml');
    fs.writeFileSync(projectConfig, 'gateway:\n  api_key: sk-real-key\n');

    const result = loadConfigRaw(__tmpDir);
    expect(result.config!.config.gateway?.api_key).toBe('sk-real-key');
  });

  it('merges global and project config (project wins)', async () => {
    const { loadConfigRaw } = await import('../../src/core/config/loader.js');
    // Create global config dir
    const globalDir = path.join(__tmpDir, 'config');
    fs.mkdirSync(globalDir, { recursive: true });
    fs.writeFileSync(path.join(globalDir, 'config.yaml'), [
      'gateway:',
      '  base_url: https://global.example.com/v1',
      '  api_key: global-key',
      'routing:',
      '  tier_default: economy',
    ].join('\n'));
    // Create project config
    const projectConfig = path.join(__tmpDir, '.cli-switch.yaml');
    fs.writeFileSync(projectConfig, 'gateway:\n  api_key: project-key\n');

    const result = loadConfigRaw(__tmpDir);
    expect(result.config!.config.gateway?.base_url).toBe('https://global.example.com/v1');
    expect(result.config!.config.gateway?.api_key).toBe('project-key');
    expect(result.config!.config.routing?.tier_default).toBe('economy');
  });

  it('reports error for invalid YAML', async () => {
    const { loadConfig } = await import('../../src/core/config/loader.js');
    const projectConfig = path.join(__tmpDir, '.cli-switch.yaml');
    fs.writeFileSync(projectConfig, '  invalid: yaml: [broken');

    const result = loadConfig(__tmpDir);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].code).toBe('CONFIG_INVALID');
  });

  it('reports error for unknown top-level keys (strict schema)', async () => {
    const { loadConfig } = await import('../../src/core/config/loader.js');
    const projectConfig = path.join(__tmpDir, '.cli-switch.yaml');
    fs.writeFileSync(projectConfig, [
      'unknown_section: true',
      'gateway:',
      '  base_url: https://example.com/v1',
    ].join('\n'));

    const result = loadConfig(__tmpDir);
    expect(result.errors.some(e => e.code === 'CONFIG_INVALID')).toBe(true);
  });

  it('reports error for invalid field values', async () => {
    const { loadConfig } = await import('../../src/core/config/loader.js');
    const projectConfig = path.join(__tmpDir, '.cli-switch.yaml');
    fs.writeFileSync(projectConfig, 'gateway:\n  base_url: not-a-url\n');

    const result = loadConfig(__tmpDir);
    expect(result.errors.some(e => e.code === 'CONFIG_INVALID')).toBe(true);
  });

  it('handles empty YAML file', async () => {
    const { loadConfig } = await import('../../src/core/config/loader.js');
    const projectConfig = path.join(__tmpDir, '.cli-switch.yaml');
    fs.writeFileSync(projectConfig, '');

    const result = loadConfig(__tmpDir);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('handles valid config with all sections', async () => {
    const { loadConfigRaw } = await import('../../src/core/config/loader.js');
    const projectConfig = path.join(__tmpDir, '.cli-switch.yaml');
    fs.writeFileSync(projectConfig, [
      'gateway:',
      '  base_url: https://api.example.com/v1',
      '  api_key: sk-all-sections',
      '  models:',
      '    economy: gpt-4o-mini',
      '    premium: gpt-4o',
      '  default_tier: standard',
      'routing:',
      '  tier_default: premium',
      '  capability_tier_override:',
      '    write_code: premium',
      'execution:',
      '  default_strategy: high_quality',
      'loop:',
      '  verify_command: npm test',
      '  max_iterations: 5',
      'output:',
      '  json: true',
      '  quiet: false',
    ].join('\n'));

    const result = loadConfigRaw(__tmpDir);
    const cfg = result.config!.config;
    expect(cfg.gateway?.base_url).toBe('https://api.example.com/v1');
    expect(cfg.gateway?.models?.economy).toBe('gpt-4o-mini');
    expect(cfg.gateway?.default_tier).toBe('standard');
    expect(cfg.routing?.tier_default).toBe('premium');
    expect(cfg.execution?.default_strategy).toBe('high_quality');
    expect(cfg.loop?.max_iterations).toBe(5);
    expect(cfg.output?.json).toBe(true);
  });
});
