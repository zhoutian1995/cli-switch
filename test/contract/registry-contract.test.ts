import { describe, expect, it } from 'vitest';

import { loadBuiltins } from '../../src/registry/index.js';

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
});
