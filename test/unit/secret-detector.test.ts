import { describe, it, expect } from 'vitest';
import { detectSecrets } from '../../src/core/git/secret-detector.js';

describe('detectSecrets', () => {
  it('detects OpenAI API key', () => {
    const diff = `diff --git a/config.ts b/config.ts
+const apiKey = "sk-abc123def456ghi789jkl012mno345pqr";`;
    const findings = detectSecrets(diff);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0].type).toBe('api_key');
  });

  it('detects OpenRouter API key', () => {
    const diff = `diff --git a/app.ts b/app.ts
+const key = "sk-or-v1-abcdef1234567890";`;
    const findings = detectSecrets(diff);
    expect(findings.some((f) => f.type === 'api_key')).toBe(true);
  });

  it('detects private key', () => {
    const diff = `+-----BEGIN RSA PRIVATE KEY-----
+MIIEpAIBAAKCAQEA...
+-----END RSA PRIVATE KEY-----`;
    const findings = detectSecrets(diff);
    expect(findings.some((f) => f.type === 'private_key')).toBe(true);
    expect(findings.some((f) => f.severity === 'high')).toBe(true);
  });

  it('detects password assignment', () => {
    const diff = `diff --git a/db.ts b/db.ts
+const password = "supersecret123";`;
    const findings = detectSecrets(diff);
    expect(findings.some((f) => f.type === 'password')).toBe(true);
  });

  it('does not flag normal code', () => {
    const diff = `diff --git a/hello.ts b/hello.ts
+function greet(name: string) {
+  return "Hello, " + name;
+}`;
    const findings = detectSecrets(diff);
    expect(findings).toHaveLength(0);
  });

  it('detects token assignment', () => {
    const diff = `+const token = "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ1234";`;
    const findings = detectSecrets(diff);
    expect(findings.some((f) => f.type === 'token')).toBe(true);
  });

  it('detects generic secret env variable', () => {
    const diff = `+const API_KEY = "abcdef1234567890abcdef1234567890ab";`;
    const findings = detectSecrets(diff);
    expect(findings.length).toBeGreaterThan(0);
  });
});
