#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command, CommanderError } from 'commander';

import { createAuthCommand } from './auth.js';
import { createDoctorCommand } from './doctor.js';
import { createEnvCommand } from './env.js';
import { createListCommand } from './list.js';
import { createResolveCommand } from './resolve.js';
import { createRunCommand } from './run.js';
import { createCapabilitiesCommand } from './capabilities.js';
import { createBenchmarkCommand } from './benchmark.js';
import { createConfigCommand } from './config.js';
import { createSkillCommand } from './skill.js';
import { EXIT_CODES, renderJson, toErrorEnvelope } from './_shared.js';

type PackageJson = {
  version: string;
};

function readVersion(): string {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const root = resolve(__dirname, __dirname.includes('dist') ? '../..' : '..');
  const packageJson = JSON.parse(
    readFileSync(resolve(root, 'package.json'), 'utf8'),
  ) as PackageJson;
  return packageJson.version;
}

const program = new Command();

program
  .name('cli-switch')
  .description('The smartest AI agent orchestration layer — route, benchmark, and rank your agents')
  .version(readVersion())
  .addHelpText(
    'after',
    '\\nCommands:\\n  resolve       Resolve a runtime spec\\n  env           Inspect environment and config\\n  config        Inspect and manage configuration\\n  auth          Check authentication status\\n  doctor        Run diagnostics\\n  list          List supported static metadata\\n  run           Run an AI agent with smart routing\\n  capabilities  Show agent capability matrix\\n  benchmark     Run performance benchmarks across agents\\n  skill         Manage and run skill definitions',
  );

program.addCommand(createResolveCommand());
program.addCommand(createEnvCommand());
program.addCommand(createAuthCommand());
program.addCommand(createDoctorCommand());
program.addCommand(createListCommand());
program.addCommand(createRunCommand());
program.addCommand(createCapabilitiesCommand());
program.addCommand(createBenchmarkCommand());
program.addCommand(createConfigCommand());
program.addCommand(createSkillCommand());

try {
  await program.parseAsync(process.argv);
} catch (error) {
  if (error instanceof CommanderError) {
    const wantsJson = process.argv.includes('--json');
    if (wantsJson) {
      console.log(
        renderJson(
          toErrorEnvelope({
            code: 'INPUT_ERROR',
            message: error.message,
            hint: '请检查命令参数是否正确。',
          }),
        ),
      );
    }
    process.exitCode = error.code.startsWith('commander.') ? EXIT_CODES.input : error.exitCode;
  } else {
    process.exitCode = 1;
    throw error;
  }
}
