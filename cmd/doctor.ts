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
import { renderDoctorResult, renderJson } from '../src/renderers/index.js';
import {
  type CommandDoctorResult,
  EXIT_CODES,
  createPlatformService,
  findProfileOrThrow,
  findToolOrThrow,
  printJson,
  printTextError,
  toErrorEnvelope,
} from './_shared.js';

interface DoctorOptions {
  tool?: string;
  profile?: string;
  json?: boolean;
}

function runDoctor(options: DoctorOptions): CommandDoctorResult[] {
  const registry = loadBuiltins();
  const registryService = createRegistryService(registry);
  const platform = createPlatformService();
  const adapters = {
    [claudeCodeAdapter.id()]: claudeCodeAdapter,
    [codexAdapter.id()]: codexAdapter,
    [geminiAdapter.id()]: geminiAdapter,
  };
  createResolverService(registry, adapters);
  createAuthService(platform);
  const doctorService = createDoctorService(platform, registry, adapters);

  const tools = options.tool
    ? [findToolOrThrow(registryService, options.tool)]
    : registryService.listTools();

  return tools.map((tool) => {
    const profile = findProfileOrThrow(registryService, tool, options.profile);
    const result = doctorService.run(tool, profile);
    return {
      tool: tool.id,
      profile: profile.name,
      ...result,
    };
  });
}

export function createDoctorCommand(): Command {
  return new Command('doctor')
    .description('Run installation and configuration diagnostics')
    .option('--tool <tool>', 'run doctor for one tool')
    .option('--profile <profile>', 'profile name')
    .option('--json', 'output JSON')
    .action((options: DoctorOptions) => {
      try {
        const results = runDoctor(options);
        const hasFailure = results.some((result) => result.summary.status === 'fail');

        if (options.json) {
          printJson({
            ok: !hasFailure,
            data: results.length === 1 ? results[0] : { items: results },
            warnings: results.flatMap((result) => result.warnings),
            diagnostics: results.flatMap((result) => result.diagnostics),
          });
        } else {
          console.log(results.map((result) => renderDoctorResult(result)).join('\n\n'));
        }

        process.exitCode = hasFailure ? EXIT_CODES.environment : EXIT_CODES.success;
      } catch (error) {
        if (options.json) {
          console.log(renderJson(toErrorEnvelope(error)));
        } else {
          printTextError(error);
        }
        process.exitCode = EXIT_CODES.environment;
      }
    });
}
