import { Command } from 'commander';

import {
  claudeCodeAdapter,
  codexAdapter,
} from '../src/adapters/index.js';
import { createAuthService } from '../src/core/auth/index.js';
import { createDoctorService } from '../src/core/doctor/index.js';
import { createResolverService } from '../src/core/resolver/index.js';
import { loadBuiltins, loadUserOverrides, mergeRegistry, createRegistryService } from '../src/registry/index.js';
import { renderJson, renderList } from '../src/renderers/index.js';
import {
  EXIT_CODES,
  createPlatformService,
  findToolOrThrow,
  printJson,
  printTextError,
  toErrorEnvelope,
} from './_shared.js';

interface ListOptions {
  tool?: string;
  json?: boolean;
}

function filterByTool<T extends { tools?: string[]; tool?: string }>(items: T[], tool?: string): T[] {
  if (!tool) {
    return items;
  }

  return items.filter((item) => item.tool === tool || item.tools?.includes(tool));
}

function createListDependencies() {
  const builtins = loadBuiltins();
  const platform = createPlatformService();
  const overrides = loadUserOverrides(platform.resolvePaths().configDir);
  const registry = mergeRegistry(builtins, overrides);
  const registryService = createRegistryService(registry);
  const adapters = {
    [claudeCodeAdapter.id()]: claudeCodeAdapter,
    [codexAdapter.id()]: codexAdapter,
  };
  createResolverService(registry, adapters);
  createAuthService(platform);
  createDoctorService(platform, registry, adapters);

  return { registry, registryService };
}

export function createListCommand(): Command {
  const buildSubcommand = (
    name: 'models' | 'providers' | 'profiles',
    description: string,
    resolveItems: (options: ListOptions) => unknown[],
  ): Command =>
    new Command(name)
      .description(description)
      .option('--tool <tool>', 'filter by tool')
      .option('--json', 'output JSON')
      .action((options: ListOptions) => {
        try {
          const { registryService } = createListDependencies();
          if (options.tool) {
            findToolOrThrow(registryService, options.tool);
          }

          const items = resolveItems(options);
          if (options.json) {
            printJson({ ok: true, data: { items }, warnings: [], diagnostics: [] });
          } else {
            console.log(renderList(items, name));
          }
        } catch (error) {
          if (options.json) {
            console.log(renderJson(toErrorEnvelope(error)));
          } else {
            printTextError(error);
          }
          process.exitCode = EXIT_CODES.input;
        }
      });

  return new Command('list')
    .description('List supported models, providers, and profiles')
    .addCommand(
      buildSubcommand('models', 'List registered models', (options) => {
        const { registryService } = createListDependencies();
        const items = registryService.listModels().map((model) => ({
          alias: model.alias,
          resolved_name: model.resolvedName,
          vendor: model.vendor,
          family: model.family,
          capabilities: model.capabilities,
          tools: registryService
            .listProfiles()
            .filter((profile) => profile.defaultModel === model.alias)
            .map((profile) => profile.tool),
        }));
        return filterByTool(items, options.tool);
      }),
    )
    .addCommand(
      buildSubcommand('providers', 'List registered providers', (options) => {
        const { registry } = createListDependencies();
        const items = Object.values(registry.providers).map((provider) => ({
          name: provider.id,
          transports: provider.transports,
          auth_modes: provider.authModes,
          tools: provider.supportedTools,
        }));
        return filterByTool(items, options.tool);
      }),
    )
    .addCommand(
      buildSubcommand('profiles', 'List registered profiles', (options) => {
        const { registryService } = createListDependencies();
        const items = registryService.listProfiles().map((profile) => ({
          tool: profile.tool,
          name: profile.name,
          description: profile.description,
          default_model: profile.defaultModel,
          auth_mode: profile.authMode,
          transport: profile.defaultTransport,
          capabilities: {
            mcp: profile.capabilities.mcp,
            skills: profile.capabilities.skills,
            tool_policy: profile.capabilities.toolPolicy,
            structured_output: profile.capabilities.structuredOutput,
          },
        }));
        return filterByTool(items, options.tool);
      }),
    );
}
