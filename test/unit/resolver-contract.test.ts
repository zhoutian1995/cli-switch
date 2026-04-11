import { describe, expect, it } from 'vitest';
import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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

  it('fails when tool binary is required but not found', () => {
    const localRegistry = structuredClone(registry);
    localRegistry.tools['claude-code'].binaryNames = ['definitely-missing-cli-switch-binary'];
    localRegistry.profiles['claude-code:default'].constraints = {
      ...(localRegistry.profiles['claude-code:default'].constraints ?? {}),
      requiresBinary: true,
    };

    const resolver = createResolverService(localRegistry, adapters);
    const result = resolver.resolve({ tool: 'claude-code' });

    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe('BINARY_NOT_FOUND');
  });

  it('fails when current platform is not supported by profile constraints', () => {
    const localRegistry = structuredClone(registry);
    localRegistry.profiles['claude-code:default'].constraints = {
      ...(localRegistry.profiles['claude-code:default'].constraints ?? {}),
      supportedPlatforms: ['definitely-unsupported-platform' as never],
    };

    const resolver = createResolverService(localRegistry, adapters);
    const result = resolver.resolve({ tool: 'claude-code' });

    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe('PLATFORM_UNSUPPORTED');
  });

  it('validates requiredCapabilities against final adapter model capabilities', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'cli-switch-binary-'));
    const fakeBinary = join(tempDir, 'claude');
    writeFileSync(fakeBinary, '#!/bin/sh\nexit 0\n');
    chmodSync(fakeBinary, 0o755);

    const localRegistry = structuredClone(registry);
    localRegistry.tools['claude-code'].binaryNames = [fakeBinary];
    localRegistry.profiles['claude-code:default'].constraints = {
      ...(localRegistry.profiles['claude-code:default'].constraints ?? {}),
      requiresBinary: true,
    };
    localRegistry.models['sonnet'].capabilities = ['chat'];
    localRegistry.profiles['claude-code:default'].requiredCapabilities = ['function_calling'];

    const resolver = createResolverService(localRegistry, adapters);
    const result = resolver.resolve({ tool: 'claude-code', model: 'sonnet' });

    expect(result.ok).toBe(true);
    expect(result.runtime?.model.capabilities).toContain('function_calling');
  });
});
