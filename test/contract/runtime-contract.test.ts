import { describe, expect, it } from 'vitest';

import { loadBuiltins } from '../../src/registry/index.js';

const registry = loadBuiltins();

describe('runtime contract', () => {
  it('tool supportedPlatforms should not be empty', () => {
    for (const [toolId, tool] of Object.entries(registry.tools)) {
      expect(tool.supportedPlatforms.length, `${toolId} supportedPlatforms should not be empty`).toBeGreaterThan(0);
    }
  });

  it('profile defaultTransport should exist in provider transports when both are configured', () => {
    for (const [key, profile] of Object.entries(registry.profiles)) {
      if (!profile.defaultProvider || !profile.defaultTransport) continue;
      const provider = registry.providers[profile.defaultProvider];
      expect(provider, `${key} provider ${profile.defaultProvider} missing`).toBeDefined();
      expect(
        provider.transports.includes(profile.defaultTransport),
        `${key} transport ${profile.defaultTransport} not supported by provider ${profile.defaultProvider}`,
      ).toBe(true);
    }
  });

  it('profile authMode should be accepted by defaultProvider when defaultProvider is configured', () => {
    for (const [key, profile] of Object.entries(registry.profiles)) {
      if (!profile.defaultProvider) continue;
      const provider = registry.providers[profile.defaultProvider];
      expect(provider, `${key} provider ${profile.defaultProvider} missing`).toBeDefined();
      expect(
        provider.authModes.includes(profile.authMode),
        `${key} authMode ${profile.authMode} not supported by provider ${profile.defaultProvider}`,
      ).toBe(true);
    }
  });

  it('profile defaultProvider should support the profile tool when configured', () => {
    for (const [key, profile] of Object.entries(registry.profiles)) {
      if (!profile.defaultProvider) continue;
      const provider = registry.providers[profile.defaultProvider];
      expect(provider, `${key} provider ${profile.defaultProvider} missing`).toBeDefined();
      expect(
        provider.supportedTools.includes(profile.tool),
        `${key} tool ${profile.tool} not supported by provider ${profile.defaultProvider}`,
      ).toBe(true);
    }
  });

  it('provider transports should exist in registry.transports', () => {
    for (const [providerId, provider] of Object.entries(registry.providers)) {
      for (const transportId of provider.transports) {
        expect(
          registry.transports[transportId],
          `${providerId} -> transport ${transportId} is missing from registry.transports`,
        ).toBeDefined();
      }
    }
  });

  it('provider authModes should be supported by at least one declared transport', () => {
    for (const [providerId, provider] of Object.entries(registry.providers)) {
      for (const authMode of provider.authModes) {
        const supportedBySomeTransport = provider.transports.some((transportId) => {
          const transport = registry.transports[transportId];
          expect(transport, `${providerId} -> transport ${transportId} missing`).toBeDefined();
          return transport?.authModes.includes(authMode) ?? false;
        });

        expect(
          supportedBySomeTransport,
          `${providerId} -> authMode ${authMode} is not supported by any declared transport`,
        ).toBe(true);
      }
    }
  });
});
