import { describe, expect, it } from 'vitest';

import {
  claudeCodeAdapter,
  codexAdapter,
  geminiAdapter,
} from '../../src/adapters/index.js';
import { createResolverService } from '../../src/core/resolver/index.js';
import { loadBuiltins } from '../../src/registry/index.js';

const registry = loadBuiltins();
const adapters = {
  [claudeCodeAdapter.id()]: claudeCodeAdapter,
  [codexAdapter.id()]: codexAdapter,
  [geminiAdapter.id()]: geminiAdapter,
};

describe('resolver contract', () => {
  it('fails when requested model does not exist in registry', () => {
    const resolver = createResolverService(registry, adapters);
    const result = resolver.resolve({
      tool: 'claude-code',
      model: 'not-exist-model',
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe('MODEL_NOT_FOUND');
  });

  it('fails when requested capability is disallowed by profile', () => {
    const localRegistry = structuredClone(registry);
    localRegistry.profiles['claude-code:default'].constraints = {
      ...(localRegistry.profiles['claude-code:default'].constraints ?? {}),
      disallowCapabilities: ['skills'],
    };

    const resolver = createResolverService(localRegistry, adapters);
    const result = resolver.resolve({
      tool: 'claude-code',
      capabilities: ['skills'],
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe('RESOLVE_CONFLICT');
  });

  it('fails when requiredCapabilities are not satisfied by resolved model', () => {
    const localRegistry = structuredClone(registry);
    localRegistry.profiles['claude-code:default'].requiredCapabilities = ['image_input'];

    const resolver = createResolverService(localRegistry, adapters);
    const result = resolver.resolve({
      tool: 'claude-code',
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe('RESOLVE_CONFLICT');
  });
});
