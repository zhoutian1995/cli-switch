import { Command } from 'commander';

import {
  claudeCodeAdapter,
  codexAdapter,
} from '../src/adapters/index.js';
import { createAuthService } from '../src/core/auth/index.js';
import { createDoctorService } from '../src/core/doctor/index.js';
import { createResolverService } from '../src/core/resolver/index.js';
import { loadBuiltins, loadUserOverrides, mergeRegistry, createRegistryService } from '../src/registry/index.js';
import { renderAuthResult, renderJson } from '../src/renderers/index.js';
import {
  EXIT_CODES,
  createPlatformService,
  findProfileOrThrow,
  findToolOrThrow,
  printJson,
  printTextError,
  toErrorEnvelope,
} from './_shared.js';

interface AuthStatusOptions {
  tool: string;
  profile?: string;
  json?: boolean;
}

export function createAuthCommand(): Command {
  const status = new Command('status')
    .description('Show authentication status for a tool/profile')
    .requiredOption('--tool <tool>', 'tool id to inspect')
    .option('--profile <profile>', 'profile name')
    .option('--json', 'output JSON')
    .action((options: AuthStatusOptions) => {
      try {
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
        const authService = createAuthService(platform);
        createDoctorService(platform, registry, adapters);

        const tool = findToolOrThrow(registryService, options.tool);
        const profile = findProfileOrThrow(registryService, tool, options.profile);
        const result = authService.getStatus(tool, profile);

        if (options.json) {
          printJson({
            ok: true,
            data: {
              tool: result.tool,
              profile: result.profile,
              auth: result.auth,
            },
            warnings: result.warnings,
            diagnostics: result.diagnostics,
          });
        } else {
          console.log(renderAuthResult(result));
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

  return new Command('auth')
    .description('Inspect authentication status')
    .addCommand(status);
}
