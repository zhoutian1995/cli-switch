import type {
  EffectiveRegistry,
  ModelDefinition,
  ProfileDefinition,
  ToolDefinition,
} from '../types/registry.js';

export interface RegistryService {
  getTool(id: string): ToolDefinition | undefined;
  getModel(alias: string): ModelDefinition | undefined;
  getProfile(key: string): ProfileDefinition | undefined;
  listTools(): ToolDefinition[];
  listModels(): ModelDefinition[];
  listProfiles(): ProfileDefinition[];
  getEffectiveRegistry(): EffectiveRegistry;
}

export function createRegistryService(
  registry: EffectiveRegistry,
): RegistryService {
  return {
    getTool(id: string): ToolDefinition | undefined {
      return registry.tools[id];
    },

    getModel(alias: string): ModelDefinition | undefined {
      return registry.models[alias];
    },

    getProfile(key: string): ProfileDefinition | undefined {
      return registry.profiles[key];
    },

    listTools(): ToolDefinition[] {
      return Object.values(registry.tools);
    },

    listModels(): ModelDefinition[] {
      return Object.values(registry.models);
    },

    listProfiles(): ProfileDefinition[] {
      return Object.values(registry.profiles);
    },

    getEffectiveRegistry(): EffectiveRegistry {
      return registry;
    },
  };
}
