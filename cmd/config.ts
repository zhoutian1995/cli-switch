/**
 * Config command group — show, set, reset.
 *
 * @see .planning/phases/02-configuration-coverage/02-03-PLAN.md
 * @see .planning/phases/02-configuration-coverage/02-CONTEXT.md D-14..D-21
 */

import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { Command } from 'commander';
import * as yaml from 'js-yaml';

import { loadConfig } from '../src/core/config/index.js';
import { configSchema } from '../src/types/config.js';
import type { CliSwitchConfig } from '../src/types/config.js';
import { resolvePaths } from '../src/platform/paths.js';
import {
  EXIT_CODES,
  createError,
  printJson,
  printTextError,
  toErrorEnvelope,
  renderJson,
} from './_shared.js';

// ─── Shared helpers ────────────────────────────────────────

function getTargetPath(project: boolean | undefined, cwd?: string): string {
  if (project) {
    return join(cwd ?? process.cwd(), '.cli-switch.yaml');
  }
  return join(resolvePaths().configDir, 'config.yaml');
}

function readYamlConfig(filePath: string): Record<string, unknown> {
  if (!existsSync(filePath)) return {};
  const raw = readFileSync(filePath, 'utf-8');
  const parsed = yaml.load(raw);
  if (parsed == null || typeof parsed !== 'object') return {};
  return parsed as Record<string, unknown>;
}

function writeYamlConfig(filePath: string, data: Record<string, unknown>): void {
  const dir = filePath.substring(0, filePath.lastIndexOf('/'));
  if (dir && !existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const result = configSchema.safeParse(data);
  if (!result.success) {
    const msg = result.error.issues.map(i => i.message).join('; ');
    throw createError('CONFIG_INVALID', `Config validation failed: ${msg}`, 'Check the value against the schema.');
  }
  writeFileSync(filePath, yaml.dump(data, { lineWidth: 120, noRefs: true }), 'utf-8');
}

const VALID_TOP_LEVEL_KEYS = ['gateway', 'routing', 'execution', 'loop', 'output', 'skills'];

function setNestedValue(obj: Record<string, unknown>, keyPath: string, value: unknown): void {
  const parts = keyPath.split('.');
  const topKey = parts[0];
  if (!VALID_TOP_LEVEL_KEYS.includes(topKey)) {
    throw createError(
      'CONFIG_KEY_NOT_FOUND',
      `Unknown top-level key: ${topKey}`,
      `Valid keys: ${VALID_TOP_LEVEL_KEYS.join(', ')}`,
    );
  }

  let current: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (current[parts[i]] == null || typeof current[parts[i]] !== 'object') {
      current[parts[i]] = {};
    }
    current = current[parts[i]] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]] = value;
}

function deleteNestedValue(obj: Record<string, unknown>, keyPath: string): boolean {
  const parts = keyPath.split('.');
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (current[parts[i]] == null || typeof current[parts[i]] !== 'object') return false;
    current = current[parts[i]] as Record<string, unknown>;
  }
  const lastKey = parts[parts.length - 1];
  if (!(lastKey in current)) return false;
  delete current[lastKey];
  return true;
}

function parseValue(raw: string): unknown {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  const num = Number(raw);
  if (raw !== '' && !isNaN(num)) return num;
  return raw;
}

/** Recursively remove empty objects from config data. */
function cleanEmptyObjects(obj: Record<string, unknown>): void {
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val != null && typeof val === 'object' && !Array.isArray(val)) {
      cleanEmptyObjects(val as Record<string, unknown>);
      if (Object.keys(val as Record<string, unknown>).length === 0) {
        delete obj[key];
      }
    }
  }
}

function renderConfigText(config: CliSwitchConfig | null, sources: { global: { path: string; loaded: boolean }; project: { path: string; loaded: boolean } }, warnings: string[]): string {
  const lines: string[] = ['Configuration', ''];

  lines.push('Sources:');
  lines.push(`  global: ${sources.global.path} (${sources.global.loaded ? 'loaded' : 'not found'})`);
  lines.push(`  project: ${sources.project.path} (${sources.project.loaded ? 'loaded' : 'not found'})`);

  if (!config) {
    lines.push('', 'No configuration found.', 'Run `cli-switch config set <key> <value>` to set a value.');
    return lines.join('\n');
  }

  const sections = [
    { key: 'gateway' as const, label: 'Gateway' },
    { key: 'routing' as const, label: 'Routing' },
    { key: 'execution' as const, label: 'Execution' },
    { key: 'loop' as const, label: 'Loop' },
    { key: 'output' as const, label: 'Output' },
    { key: 'skills' as const, label: 'Skills' },
  ];

  for (const section of sections) {
    const data = config[section.key];
    if (data && Object.keys(data).length > 0) {
      lines.push('', `${section.label}:`);
      lines.push(formatYamlBlock(data as Record<string, unknown>, '  '));
    }
  }

  if (warnings.length > 0) {
    lines.push('', 'Warnings:');
    for (const w of warnings) {
      lines.push(`  - ${w}`);
    }
  }

  return lines.join('\n');
}

function formatYamlBlock(obj: Record<string, unknown>, indent: string): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      lines.push(`${indent}${key}:`);
      lines.push(formatYamlBlock(value as Record<string, unknown>, indent + '  '));
    } else if (Array.isArray(value)) {
      lines.push(`${indent}${key}: [${value.join(', ')}]`);
    } else {
      lines.push(`${indent}${key}: ${String(value)}`);
    }
  }
  return lines.join('\n');
}

// ─── Command factory ───────────────────────────────────────

export function createConfigCommand(): Command {
  return new Command('config')
    .description('Inspect and manage configuration')
    .addCommand(createShowCommand())
    .addCommand(createSetCommand())
    .addCommand(createResetCommand());
}

// ─── show ──────────────────────────────────────────────────

function createShowCommand(): Command {
  return new Command('show')
    .description('Display effective merged configuration')
    .option('--json', 'output JSON')
    .action((options: { json?: boolean }) => {
      try {
        const result = loadConfig(process.cwd());
        const config = result.config?.config ?? null;
        const sources = result.config?.sources ?? {
          global: { path: '', loaded: false },
          project: { path: '', loaded: false },
        };

        if (options.json) {
          printJson({
            ok: true,
            data: {
              config,
              sources: {
                global: { path: sources.global.path, loaded: sources.global.loaded },
                project: { path: sources.project.path, loaded: sources.project.loaded },
              },
            },
            warnings: result.errors.map(e => e.message),
            diagnostics: [],
          });
        } else {
          console.log(renderConfigText(config, sources, result.errors.map(e => e.message)));
        }
      } catch (error) {
        if (options.json) {
          console.log(renderJson(toErrorEnvelope(error)));
        } else {
          printTextError(error);
          process.exitCode = EXIT_CODES.input;
        }
      }
    });
}

// ─── set ───────────────────────────────────────────────────

function createSetCommand(): Command {
  return new Command('set')
    .description('Set a configuration value')
    .argument('<key>', 'dot-separated key path (e.g., gateway.base_url)')
    .argument('<value>', 'value to set')
    .option('--project', 'write to project config instead of global')
    .option('--json', 'output JSON')
    .action((key: string, value: string, options: { project?: boolean; json?: boolean }) => {
      try {
        const parsed = parseValue(value);
        const filePath = getTargetPath(options.project);
        const data = readYamlConfig(filePath);

        setNestedValue(data, key, parsed);
        writeYamlConfig(filePath, data);

        const target = options.project ? 'project' : 'global';

        if (options.json) {
          printJson({
            ok: true,
            data: { key, value: parsed, target, path: filePath },
            warnings: [],
            diagnostics: [],
          });
        } else {
          console.log(`Set ${key} = ${JSON.stringify(parsed)} in ${target} config (${filePath})`);
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

// ─── reset ─────────────────────────────────────────────────

function createResetCommand(): Command {
  return new Command('reset')
    .description('Reset configuration values')
    .argument('[key]', 'dot-separated key path to remove (omit with --all)')
    .option('--all', 'reset entire configuration file')
    .option('--project', 'target project config instead of global')
    .option('--json', 'output JSON')
    .action((key: string | undefined, options: { all?: boolean; project?: boolean; json?: boolean }) => {
      try {
        if (!options.all && !key) {
          throw createError(
            'INPUT_ERROR',
            'Specify a key or use --all to reset everything',
            'Usage: cli-switch config reset <key> | cli-switch config reset --all',
          );
        }

        const filePath = getTargetPath(options.project);
        const target = options.project ? 'project' : 'global';

        if (options.all) {
          if (existsSync(filePath)) {
            unlinkSync(filePath);
          }
          if (options.json) {
            printJson({
              ok: true,
              data: { target, path: filePath },
              warnings: ['All configuration reset'],
              diagnostics: [],
            });
          } else {
            console.log(`Reset all ${target} configuration (${filePath})`);
          }
          return;
        }

        // Single key reset
        if (!existsSync(filePath)) {
          const warning = `Key '${key}' not found in ${target} config (file does not exist)`;
          if (options.json) {
            printJson({
              ok: true,
              data: { key, target, path: filePath, found: false },
              warnings: [warning],
              diagnostics: [],
            });
          } else {
            console.log(warning);
          }
          return;
        }

        const data = readYamlConfig(filePath);
        const found = deleteNestedValue(data, key ?? '');

        if (!found) {
          const warning = `Key '${key}' not found in ${target} config`;
          if (options.json) {
            printJson({
              ok: true,
              data: { key, target, path: filePath, found: false },
              warnings: [warning],
              diagnostics: [],
            });
          } else {
            console.log(warning);
          }
          return;
        }

        // Write back (validate after deletion, clean empty objects)
        cleanEmptyObjects(data);
        const remaining = Object.keys(data);
        if (remaining.length === 0) {
          unlinkSync(filePath);
        } else {
          writeYamlConfig(filePath, data);
        }

        if (options.json) {
          printJson({
            ok: true,
            data: { key, target, path: filePath, found: true },
            warnings: [],
            diagnostics: [],
          });
        } else {
          console.log(`Reset ${key} in ${target} config (${filePath})`);
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
