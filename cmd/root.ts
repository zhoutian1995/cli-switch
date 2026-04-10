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
  .description('Multi AI CLI compatibility and runtime orchestration layer')
  .version(readVersion())
  .addHelpText(
    'after',
    '\nCommands:\n  resolve  Resolve a runtime spec\n  env      Inspect environment and config\n  auth     Check authentication status\n  doctor   Run diagnostics\n  list     List supported static metadata',
  );

program.addCommand(createResolveCommand());
program.addCommand(createEnvCommand());
program.addCommand(createAuthCommand());
program.addCommand(createDoctorCommand());
program.addCommand(createListCommand());

try {
  await program.parseAsync(process.argv);
} catch (error) {
  if (error instanceof CommanderError) {
    process.exitCode = error.code.startsWith('commander.') ? 2 : error.exitCode;
  } else {
    process.exitCode = 1;
    throw error;
  }
}
