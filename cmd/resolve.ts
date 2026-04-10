import { Command } from 'commander';

import {
  claudeCodeAdapter,
  codexAdapter,
  geminiAdapter,
} from '../src/adapters/index.js';
import { createAuthService } from '../src/core/auth/index.js';
import { createDoctorService } from '../src/core/doctor/index.js';
import { createResolverService } from '../src/core/resolver/index.js';
import { loadBuiltins, createRegistryService } from '../src/registry/index.js';
import { renderJson, renderResolveResult } from '../src/renderers/index.js';
import {
  EXIT_CODES,
  createPlatformService,
  printJson,
  toErrorEnvelope,
} from './_shared.js';

interface ResolveOptions {
  tool: string;
  profile?: string;
  model?: string;
  json?: boolean;
}

export function createResolveCommand(): Command {
  return new Command('resolve')
    .description('Resolve a tool, profile, and model into a runtime spec')
    .requiredOption('--tool <tool>', 'tool id to resolve')
    .option('--profile <profile>', 'profile name')
    .option('--model <model>', 'model alias or canonical model name')
    .option('--json', 'output JSON')
    .action((options: ResolveOptions) => {
      const registry = loadBuiltins();
      createRegistryService(registry);
      const platform = createPlatformService();
      const adapters = {
        [claudeCodeAdapter.id()]: claudeCodeAdapter,
        [codexAdapter.id()]: codexAdapter,
        [geminiAdapter.id()]: geminiAdapter,
      };
      const resolver = createResolverService(registry, adapters);
      createAuthService(platform);
      createDoctorService(platform, registry);

      const result = resolver.resolve({
        tool: options.tool,
        profile: options.profile,
        model: options.model,
      });

      if (options.json) {
        if (result.ok) {
          printJson({
            ok: true,
            data: {
              request: result.request,
              runtime: result.runtime,
            },
            warnings: result.warnings,
            diagnostics: result.diagnostics,
          });
        } else {
          console.log(
            renderJson(
              toErrorEnvelope(
                {
                  code: result.diagnostics[0]?.code ?? 'RESOLVE_CONFLICT',
                  message: result.diagnostics[0]?.message ?? 'Resolve failed',
                  hint: result.diagnostics[0]?.hint,
                  details: result.diagnostics[0]?.details,
                },
                result.diagnostics,
              ),
            ),
          );
        }
      } else {
        console.log(renderResolveResult(result));
      }

      process.exitCode = result.ok ? EXIT_CODES.success : EXIT_CODES.resolve;
    })
    .exitOverride((error) => {
      if (error.code === 'commander.missingMandatoryOptionValue' || error.code === 'commander.optionMissingArgument') {
        process.exitCode = EXIT_CODES.input;
      }
      throw error;
    });
}
