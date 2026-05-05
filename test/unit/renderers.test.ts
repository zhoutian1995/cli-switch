import { describe, expect, it } from 'vitest';

import { renderAuthResult, renderDoctorResult, renderResolveResult } from '../../src/renderers/index.js';
import type { AuthResultEnvelope } from '../../src/core/auth/auth-service.js';
import type { ResolveResult } from '../../src/types/index.js';

describe('text renderers', () => {
  it('renderResolveResult prints key runtime fields', () => {
    const input: ResolveResult = {
      ok: true,
      request: {
        tool: 'claude-code',
        profile: 'default',
        model: 'sonnet',
        capabilities: [],
      },
      runtime: {
        tool: 'claude-code',
        profile: 'default',
        adapter: 'claude-code',
        model: {
          input: 'sonnet',
          resolvedName: 'claude-3-7-sonnet',
          family: 'claude',
          vendor: 'anthropic',
          capabilities: ['code'],
          transport: 'native',
        },
        provider: {
          name: 'anthropic',
          vendor: 'anthropic',
          transport: 'native',
        },
        auth: {
          mode: 'login',
          status: 'ready',
          required: [],
          detected: [],
          source: 'native',
          hint: 'ready',
        },
        command: {
          program: 'claude',
          args: ['--model', 'claude-3-7-sonnet'],
          env: {},
          preview: 'claude --model claude-3-7-sonnet',
        },
        capabilities: {
          mcp: true,
          skills: false,
          toolPolicy: true,
          structuredOutput: false,
        },
      },
      warnings: ['warn-a'],
      diagnostics: [
        {
          level: 'warn',
          code: 'WARN_A',
          message: 'warning message',
        },
      ],
    };

    expect(renderResolveResult(input)).toMatchInlineSnapshot(`
      "Resolve OK
      Tool: claude-code
      Profile: default
      Model: claude-3-7-sonnet
      Auth: ready (login)
      Command: claude --model claude-3-7-sonnet
      
      Warnings:
        - warn-a
      
      Diagnostics:
        - [WARN] | WARN_A | warning message"
    `);
  });

  it('renderAuthResult prints auth status fields', () => {
    const input: AuthResultEnvelope = {
      tool: 'codex',
      profile: 'default',
      auth: {
        mode: 'api_key',
        status: 'missing',
        required: ['OPENAI_API_KEY'],
        detected: [],
        source: null,
        hint: '请配置 OPENAI_API_KEY',
      },
      warnings: [],
      diagnostics: [
        {
          level: 'warn',
          code: 'AUTH_MISSING',
          message: '请配置 OPENAI_API_KEY',
        },
      ],
    };

    expect(renderAuthResult(input)).toMatchInlineSnapshot(`
      "Auth Status
      Tool: codex
      Profile: default
      Mode: api_key
      Status: missing
      Source: -
      Detected: -
      Required: OPENAI_API_KEY
      Expires: -
      Hint: 请配置 OPENAI_API_KEY
      
      Diagnostics:
        - [WARN] | AUTH_MISSING | 请配置 OPENAI_API_KEY"
    `);
  });

  it('renderDoctorResult prints summary and checks', () => {
    const input = {
      tool: 'gemini',
      profile: 'default',
      summary: {
        status: 'fail' as const,
        checksTotal: 4,
        checksPassed: 2,
        checksWarn: 1,
        checksFailed: 1,
      },
      checks: [
        { name: 'binary_found', status: 'pass' as const, message: 'Found executable' },
        { name: 'profile_exists', status: 'pass' as const, message: 'Profile exists' },
        { name: 'auth_ready', status: 'fail' as const, message: 'Missing auth' },
        { name: 'model_valid', status: 'warn' as const, message: 'Deprecated model' },
      ],
      warnings: ['oauth placeholder'],
      diagnostics: [
        { level: 'error' as const, code: 'DOCTOR_AUTH_MISSING', message: 'Missing auth' },
      ],
    };

    expect(renderDoctorResult(input)).toMatchInlineSnapshot(`
      "Doctor Result
      Tool: gemini
      Profile: default
      Summary: 2 pass, 1 warn, 1 fail, 4 total
      
      Checks:
        - PASS binary_found: Found executable
        - PASS profile_exists: Profile exists
        - FAIL auth_ready: Missing auth
        - WARN model_valid: Deprecated model
      
      Warnings:
        - oauth placeholder
      
      Diagnostics:
        - [ERROR] | DOCTOR_AUTH_MISSING | Missing auth"
    `);
  });
});
