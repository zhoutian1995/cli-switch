import type { EffectiveRegistry } from '../types/registry.js';

export function mergeRegistry(
  base: EffectiveRegistry,
  override: Partial<EffectiveRegistry>,
): EffectiveRegistry {
  return {
    tools: { ...base.tools, ...(override.tools ?? {}) },
    profiles: { ...base.profiles, ...(override.profiles ?? {}) },
    models: { ...base.models, ...(override.models ?? {}) },
    providers: { ...base.providers, ...(override.providers ?? {}) },
    transports: { ...base.transports, ...(override.transports ?? {}) },
  };
}
