import { Command } from 'commander';

import {
  claudeCodeAdapter,
  codexAdapter,
} from '../src/adapters/index.js';
import { createResolverService } from '../src/core/resolver/index.js';
import { loadBuiltins, loadUserOverrides, mergeRegistry } from '../src/registry/index.js';
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
  provider?: string;
  vendor?: string;
  transport?: string;
  json?: boolean;
}

export function createResolveCommand(): Command {
  return new Command('resolve')
    .description('Resolve a tool, profile, and model into a runtime spec')
    .requiredOption('--tool <tool>', 'tool id to resolve')
    .option('--profile <profile>', 'profile name')
    .option('--model <model>', 'model alias or canonical model name')
    .option('--provider <provider>', 'provider id')
    .option('--vendor <vendor>', 'vendor id')
    .option('--transport <transport>', 'transport id')
    .option('--json', 'output JSON')
    .action((options: ResolveOptions) => {
      const builtins = loadBuiltins();
      const platform = createPlatformService();
      const overrides = loadUserOverrides(platform.resolvePaths().configDir);
      const registry = mergeRegistry(builtins, overrides);
      const adapters = {
        [claudeCodeAdapter.id()]: claudeCodeAdapter,
        [codexAdapter.id()]: codexAdapter,
      };
      const resolver = createResolverService(registry, adapters);

      const result = resolver.resolve({
        tool: options.tool,
        profile: options.profile,
        model: options.model,
        provider: options.provider,
        vendor: options.vendor,
        transport: options.transport,
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
