import { existsSync } from 'node:fs';

import { Command } from 'commander';

import {
  claudeCodeAdapter,
  codexAdapter,
} from '../src/adapters/index.js';
import { createAuthService } from '../src/core/auth/index.js';
import { createDoctorService } from '../src/core/doctor/index.js';
import { createResolverService } from '../src/core/resolver/index.js';
import { maskValue } from '../src/platform/index.js';
import { loadBuiltins, createRegistryService } from '../src/registry/index.js';
import { renderJson } from '../src/renderers/index.js';
import {
  EXIT_CODES,
  createPlatformService,
  findToolOrThrow,
  printJson,
  printTextError,
  toErrorEnvelope,
} from './_shared.js';

interface EnvOptions {
  tool?: string;
  json?: boolean;
}

function collectEnvironment(toolId?: string): Record<string, string | { present: boolean; masked: boolean; value?: string }> {
  const keys = [
    'XDG_CONFIG_HOME',
    'XDG_DATA_HOME',
    'XDG_CACHE_HOME',
    'SWITCH_API_KEY',
    'SWITCH_BASE_URL',
    'SWITCH_RELAY_API_KEY',
    'SWITCH_RELAY_BASE_URL',
    'OPENROUTER_API_KEY',
    'OPENROUTER_BASE_URL',
  ];

  if (toolId === 'codex') {
    keys.push('OPENAI_API_KEY');
  } else if (toolId === 'claude-code') {
    keys.push('ANTHROPIC_API_KEY');
  } else if (!toolId) {
    keys.push('OPENAI_API_KEY', 'ANTHROPIC_API_KEY');
  }

  return Object.fromEntries(
    keys.map((key) => {
      const value = process.env[key];
      if (key.startsWith('XDG_')) {
        return [key, value ?? ''];
      }
      return [
        key,
        value
          ? { present: true, masked: true, value: maskValue(value) }
          : { present: false, masked: true },
      ];
    }),
  );
}

function renderEnvText(data: {
  paths: { config_dir: string; data_dir: string; cache_dir: string };
  config_files: Array<{ path: string; exists: boolean; loaded: boolean }>;
  environment: Record<string, unknown>;
  executables: Array<{ tool: string; path: string | null; found: boolean }>;
}): string {
  const lines = [
    'Environment',
    `config_dir: ${data.paths.config_dir}`,
    `data_dir: ${data.paths.data_dir}`,
    `cache_dir: ${data.paths.cache_dir}`,
    '',
    'Config files:',
    ...data.config_files.map((item) => `  - ${item.path} | exists=${item.exists} loaded=${item.loaded}`),
    '',
    'Environment variables:',
    ...Object.entries(data.environment).map(([key, value]) => `  - ${key}: ${typeof value === 'string' ? value || '-' : JSON.stringify(value)}`),
    '',
    'Executables:',
    ...data.executables.map((item) => `  - ${item.tool}: ${item.found ? item.path : 'not found'}`),
  ];

  return lines.join('\n');
}

export function createEnvCommand(): Command {
  return new Command('env')
    .description('Inspect environment and configuration sources')
    .option('--tool <tool>', 'filter environment for one tool')
    .option('--json', 'output JSON')
    .action((options: EnvOptions) => {
      try {
        const registry = loadBuiltins();
        const registryService = createRegistryService(registry);
        const platform = createPlatformService();
        const adapters = {
          [claudeCodeAdapter.id()]: claudeCodeAdapter,
          [codexAdapter.id()]: codexAdapter,
        };
        createResolverService(registry, adapters);
        createAuthService(platform);
        createDoctorService(platform, registry);

        const paths = platform.resolvePaths();
        const configFile = `${paths.configDir}/config.toml`;

        const tools = options.tool
          ? [findToolOrThrow(registryService, options.tool)]
          : registryService.listTools();

        const data = {
          paths: {
            config_dir: paths.configDir,
            data_dir: paths.dataDir,
            cache_dir: paths.cacheDir,
          },
          config_files: [
            {
              path: configFile,
              exists: existsSync(configFile),
              loaded: false,
            },
          ],
          environment: collectEnvironment(options.tool),
          executables: tools.map((tool) => {
            const executable = platform.findExecutable(tool.binaryNames);
            return {
              tool: tool.id,
              path: executable,
              found: executable !== null,
            };
          }),
        };

        if (options.json) {
          printJson({ ok: true, data, warnings: [], diagnostics: [] });
        } else {
          console.log(renderEnvText(data));
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
}
