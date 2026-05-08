import { Command } from 'commander';

import { renderDoctorResult, renderJson } from '../src/renderers/index.js';
import {
  type CommandDoctorResult,
  EXIT_CODES,
  createCommandContext,
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
  const context = createCommandContext();

  const tools = options.tool
    ? [findToolOrThrow(context.registryService, options.tool)]
    : context.registryService.listTools();

  return tools.map((tool) => {
    const profile = findProfileOrThrow(context.registryService, tool, options.profile);
    const result = context.doctorService.run(tool, profile);
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
