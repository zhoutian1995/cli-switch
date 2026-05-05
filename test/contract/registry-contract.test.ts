import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { loadBuiltins, loadUserOverrides, mergeRegistry } from '../../src/registry/index.js';

const registry = loadBuiltins();

describe('registry contract', () => {
  it('profile defaultModel must exist in registry.models', () => {
    for (const [key, profile] of Object.entries(registry.profiles)) {
      if (!profile.defaultModel) continue;
      expect(
        registry.models[profile.defaultModel],
        `${key} -> defaultModel ${profile.defaultModel} is missing from registry.models`,
      ).toBeDefined();
    }
  });

  it('profile defaultProvider must exist when configured', () => {
    for (const [key, profile] of Object.entries(registry.profiles)) {
      if (!profile.defaultProvider) continue;
      expect(
        registry.providers[profile.defaultProvider],
        `${key} -> defaultProvider ${profile.defaultProvider} is missing`,
      ).toBeDefined();
    }
  });

  it('tool defaultProfile must exist as tool:profile key', () => {
    for (const [toolId, tool] of Object.entries(registry.tools)) {
      expect(
        registry.profiles[`${toolId}:${tool.defaultProfile}`],
        `${toolId} -> defaultProfile ${tool.defaultProfile} is missing`,
      ).toBeDefined();
    }
  });

  it('provider supportedTools must reference existing tools', () => {
    for (const [providerId, provider] of Object.entries(registry.providers)) {
      for (const toolId of provider.supportedTools) {
        expect(
          registry.tools[toolId],
          `${providerId} -> supported tool ${toolId} is missing`,
        ).toBeDefined();
      }
    }
  });

  it('loads and merges user overrides from config dir', () => {
    const configDir = mkdtempSync(join(tmpdir(), 'cli-switch-config-'));
    writeFileSync(
      join(configDir, 'registry.override.toml'),
      [
        '[models.custom-model]',
        'alias = "custom-model"',
        'resolvedName = "custom-model-v1"',
        'family = "custom"',
        'vendor = "custom-vendor"',
        'capabilities = ["chat"]',
        '',
        '[profiles.codex.default]',
        'tool = "codex"',
        'name = "default"',
        'description = "Override Default profile"',
        'defaultModel = "custom-model"',
        'authMode = "api_key"',
      ].join('\n'),
      'utf8',
    );

    const overrides = loadUserOverrides(configDir);
    const merged = mergeRegistry(loadBuiltins(), overrides);

    expect(merged.models['custom-model']).toBeDefined();
    expect(merged.models['custom-model']?.resolvedName).toBe('custom-model-v1');
    expect(merged.profiles['codex:default']?.defaultModel).toBe('custom-model');
  });
});
