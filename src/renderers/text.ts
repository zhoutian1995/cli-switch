import type { DoctorCheck } from '../adapters/types.js';
import type { AuthResultEnvelope } from '../core/auth/auth-service.js';
import type { Diagnostic, ResolveResult } from '../types/index.js';

export interface DoctorResult {
  tool: string;
  profile: string;
  checks: DoctorCheck[];
  warnings: string[];
  diagnostics: Diagnostic[];
  summary: {
    status: 'pass' | 'warn' | 'fail';
    checksTotal: number;
    checksPassed: number;
    checksWarn: number;
    checksFailed: number;
  };
}

function renderSection(title: string, lines: string[]): string {
  if (lines.length === 0) {
    return '';
  }

  return `${title}:\n${lines.map((line) => `  - ${line}`).join('\n')}`;
}

function renderKeyValue(label: string, value: string | undefined): string {
  return `${label}: ${value && value.trim().length > 0 ? value : '-'}`;
}

function renderDiagnostics(diagnostics: Diagnostic[]): string {
  return renderSection(
    'Diagnostics',
    diagnostics.map((diagnostic) => {
      const parts = [`[${diagnostic.level.toUpperCase()}]`, diagnostic.code, diagnostic.message];
      if (diagnostic.hint) {
        parts.push(`hint: ${diagnostic.hint}`);
      }
      return parts.join(' | ');
    }),
  );
}

function renderWarnings(warnings: string[]): string {
  return renderSection('Warnings', warnings);
}

export function renderResolveResult(result: ResolveResult): string {
  const lines = [
    `Resolve ${result.ok ? 'OK' : 'FAILED'}`,
    renderKeyValue('Tool', result.runtime?.tool ?? result.request.tool),
    renderKeyValue('Profile', result.runtime?.profile ?? result.request.profile),
    renderKeyValue('Model', result.runtime?.model.resolvedName ?? result.request.model),
    renderKeyValue('Auth', result.runtime ? `${result.runtime.auth.status} (${result.runtime.auth.mode})` : undefined),
    renderKeyValue('Command', result.runtime?.command.preview),
  ];

  const sections = [
    lines.join('\n'),
    renderWarnings(result.warnings),
    renderDiagnostics(result.diagnostics),
  ].filter(Boolean);

  return sections.join('\n\n');
}

export function renderAuthResult(result: AuthResultEnvelope): string {
  const { auth } = result;
  const lines = [
    'Auth Status',
    renderKeyValue('Tool', result.tool),
    renderKeyValue('Profile', result.profile),
    renderKeyValue('Mode', auth.mode),
    renderKeyValue('Status', auth.status),
    renderKeyValue('Source', auth.source ?? undefined),
    renderKeyValue('Detected', auth.detected.join(', ')),
    renderKeyValue('Required', auth.required.join(', ')),
    renderKeyValue('Expires', auth.expiresAt ?? undefined),
    renderKeyValue('Hint', auth.hint),
  ];

  const sections = [
    lines.join('\n'),
    renderWarnings(result.warnings),
    renderDiagnostics(result.diagnostics),
  ].filter(Boolean);

  return sections.join('\n\n');
}

export function renderDoctorResult(result: DoctorResult): string {
  const checkLines = result.checks.map((check) => {
    const status = check.status.toUpperCase();
    return `${status} ${check.name}: ${check.message}`;
  });

  const summary = `Summary: ${result.summary.checksPassed} pass, ${result.summary.checksWarn} warn, ${result.summary.checksFailed} fail, ${result.summary.checksTotal} total`;

  const sections = [
    [
      'Doctor Result',
      renderKeyValue('Tool', result.tool),
      renderKeyValue('Profile', result.profile),
      summary,
    ].join('\n'),
    renderSection('Checks', checkLines),
    renderWarnings(result.warnings),
    renderDiagnostics(result.diagnostics),
  ].filter(Boolean);

  return sections.join('\n\n');
}

export function renderList(items: unknown[], label: string): string {
  if (items.length === 0) {
    return `${label}: (empty)`;
  }

  return `${label}:\n${items
    .map((item) => `  - ${typeof item === 'string' ? item : JSON.stringify(item)}`)
    .join('\n')}`;
}
